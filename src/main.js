const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const sharp = require('sharp');
const { chatWithVision } = require('./providers/openaiCompatible');

let Store;
let store;

// 动态导入 electron-store
async function initStore() {
  Store = (await import('electron-store')).default;
  store = new Store({ name: 'settings' });
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  // 开发模式下加载原始文件，生产模式下加载构建后的文件
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'renderer', 'index.html'));
  }
  mainWindow.once('ready-to-show', () => mainWindow.show());
}

app.whenReady().then(async () => {
  await initStore();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Utils
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.bmp'];
function isImage(p) { return IMAGE_EXTS.includes(path.extname(p).toLowerCase()); }

// IPC handlers
ipcMain.handle('select-folder', async () => {
  const res = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (res.canceled || res.filePaths.length === 0) return null;
  return res.filePaths[0];
});

ipcMain.handle('list-images', async (_evt, dir) => {
  if (!dir) return [];
  const files = fs.readdirSync(dir).filter(f => isImage(f)).map(f => path.join(dir, f));
  return files;
});

ipcMain.handle('get-settings', async () => {
  return store.store || {};
});

ipcMain.handle('set-settings', async (_evt, obj) => {
  store.set(obj || {});
  return store.store;
});

ipcMain.handle('preview-image', async (_evt, file) => {
  const buf = fs.readFileSync(file);
  const mime = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.webp': 'image/webp', '.bmp': 'image/bmp'
  }[path.extname(file).toLowerCase()] || 'image/png';
  return `data:${mime};base64,${buf.toString('base64')}`;
});

ipcMain.handle('compress-image', async (_evt, file, opts) => {
  const { minSize = 300, quality = 80 } = opts || {};
  const img = sharp(file).rotate();
  const meta = await img.metadata();
  const scale = Math.min(1, Math.max(minSize / (meta.width || minSize), minSize / (meta.height || minSize)));
  let pipeline = img;
  if (scale < 1) pipeline = pipeline.resize(Math.round((meta.width || 0) * scale));
  const ext = path.extname(file).toLowerCase();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-'));
  const out = path.join(tmpDir, path.basename(file));
  if (ext === '.png') await pipeline.png({ quality }).toFile(out);
  else await pipeline.jpeg({ quality }).toFile(out);
  return out;
});

function makePrompt(basePrompt, variables) {
  let p = basePrompt || '';
  for (const [k, v] of Object.entries(variables || {})) {
    p = p.replace(new RegExp(`{${k}}`, 'g'), v ?? '');
  }
  return p;
}

function sanitizeTitle(s, { language, filterChars, prefix, suffix, removeChineseWhenEnglish }) {
  let t = (s || '').trim();
  if (filterChars) {
    const reg = new RegExp(`[${filterChars.replace(/[.*+?^${}()|[\]\\]/g, r => `\\${r}`)}]`, 'g');
    t = t.replace(reg, '');
  }
  if (removeChineseWhenEnglish && language === 'en') {
    t = t.replace(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/g, '');
  }
  if (prefix) t = `${prefix}${t}`;
  if (suffix) t = `${t}${suffix}`;
  return t.replace(/\s+/g, ' ').trim();
}

ipcMain.handle('generate-titles', async (_evt, payload) => {
  const {
    files, baseURL, apiKey, model, basePrompt, category, needCN, needEN,
    removeChineseWhenEnglish, filterChars, prefix, suffix, compress, minSize, quality,
    maxTokens = 256, concurrency = 3
  } = payload;

  const queue = [...files];
  let active = 0; let results = [];

  async function runOne(file) {
    try {
      const src = compress ? (await exportsHandlers.compressForCall(file, { minSize, quality })) : file;
      const variables = { category: category || '' };
      const prompt = makePrompt(basePrompt, variables);
      const res = await chatWithVision({ baseURL, apiKey, model, imagePath: src, prompt, maxTokens });
      const cn = needCN ? sanitizeTitle(res.cn || res.text || '', { language: 'zh', filterChars, prefix, suffix }) : '';
      const enBase = res.en || res.text || '';
      const en = needEN ? sanitizeTitle(enBase, { language: 'en', filterChars, prefix, suffix, removeChineseWhenEnglish }) : '';
      results.push({ file, cn, en });
      return { file, cn, en };
    } catch (e) {
      results.push({ file, error: e.message || String(e) });
      return { file, error: e.message || String(e) };
    }
  }

  return await new Promise(resolve => {
    function pump() {
      if (queue.length === 0 && active === 0) return resolve(results);
      while (active < concurrency && queue.length > 0) {
        active++;
        const f = queue.shift();
        runOne(f).finally(() => { active--; pump(); });
      }
    }
    pump();
  });
});

exportsHandlers = {
  async compressForCall(file, opts) {
    try { return await ipcMain.handle('compress-image')(null, file, opts); }
    catch { return file; }
  }
};

ipcMain.handle('rename-by-title', async (_evt, items, pattern = '{base}-{lang}') => {
  // pattern: {base} 原文件名无扩展, {lang} cn/en, {title}
  const out = [];
  for (const it of items) {
    const dir = path.dirname(it.file);
    const ext = path.extname(it.file).toLowerCase();
    const base = path.basename(it.file, ext);
    const slug = (s) => (s || '').toLowerCase().replace(/[^a-z0-9\-\s_]/g, '').replace(/\s+/g, '-').slice(0, 100);
    const plan = [];
    if (it.cn) plan.push({ lang: 'cn', title: it.cn });
    if (it.en) plan.push({ lang: 'en', title: it.en });
    for (const p of plan) {
      const name = pattern.replace('{base}', base).replace('{lang}', p.lang).replace('{title}', slug(p.title));
      const target = path.join(dir, `${name}${ext}`);
      try {
        if (it.file !== target) fs.copyFileSync(it.file, target); // 不覆盖原图，保守策略
        out.push({ from: it.file, to: target, ok: true });
      } catch (e) {
        out.push({ from: it.file, to: target, ok: false, error: e.message });
      }
    }
  }
  return out;
});

ipcMain.handle('save-csv', async (_evt, rows, filePath) => {
  const csv = ['file,cn,en']
    .concat(rows.map(r => `"${r.file.replace(/"/g, '""')}","${(r.cn||'').replace(/"/g, '""')}","${(r.en||'').replace(/"/g, '""')}"`))
    .join('\n');
  const target = filePath || dialog.showSaveDialogSync(mainWindow, { defaultPath: 'titles.csv' });
  if (!target) return null;
  fs.writeFileSync(target, csv, 'utf8');
  return target;
});
