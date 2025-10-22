const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
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
  
  // 移除 **** 分隔符和周围的空格
  t = t.replace(/\s*\*\*\*\*\s*/g, ' ');
  
  if (filterChars) {
    const reg = new RegExp(`[${filterChars.replace(/[.*+?^${}()|[\]\\]/g, r => `\\${r}`)}]`, 'g');
    t = t.replace(reg, '');
  }
  if (removeChineseWhenEnglish && language === 'en') {
    t = t.replace(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/g, '');
  }
  
  // 智能添加前缀：只有当标题不是以前缀开始时才添加
  if (prefix) {
    const prefixTrimmed = prefix.trim();
    if (!t.startsWith(prefixTrimmed)) {
      t = `${prefixTrimmed} ${t}`;
    }
  }
  
  if (suffix) t = `${t} ${suffix}`;
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
      const src = compress ? (await compressImageInternal(file, { minSize, quality })) : file;
      const variables = { category: category || '' };
      const prompt = makePrompt(basePrompt, variables);
      
      console.log(`\n=== 开始处理图片: ${path.basename(file)} ===`);
      console.log(`使用模型: ${model}`);
      console.log(`API端点: ${baseURL}`);
      console.log(`图片路径: ${src}`);
      console.log('===================================\n');
      
      const res = await chatWithVision({ baseURL, apiKey, model, imagePath: src, prompt, maxTokens });
      console.log('接口响应结果:', res)
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

// 直接在这里定义压缩函数
async function compressImageInternal(file, opts = {}) {
  const { minSize = 300, quality = 80 } = opts;
  try {
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
  } catch (error) {
    console.error('Compression failed:', error);
    return file;
  }
}

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
  console.log('=== CSV Export Debug ===');
  console.log('Rows count:', rows?.length);
  console.log('First row sample:', rows?.[0]);
  console.log('FilePath provided:', filePath);

  if (!rows || rows.length === 0) {
    console.error('No data to export');
    throw new Error('没有数据可导出');
  }

  // 通用 CSV 生成：从对象数组的键生成表头
  let csvRows = [];
  if (Array.isArray(rows) && typeof rows[0] === 'object' && rows[0] !== null) {
    const headers = Object.keys(rows[0]);
    csvRows.push(headers.join(','));
    for (const row of rows) {
      const line = headers
        .map(h => `"${String((row[h] ?? '')).replace(/"/g, '""')}"`)
        .join(',');
      csvRows.push(line);
    }
  } else {
    // 兜底：保持旧格式（file/cn/en/...）
    csvRows = ['File Path,Chinese Title,English Title,Status,Error Message'];
    (rows || []).forEach(row => {
      const safePath = String(row.file || '').replace(/"/g, '""');
      const safeCN = String(row.cn || '').replace(/"/g, '""');
      const safeEN = String(row.en || '').replace(/"/g, '""');
      const safeStatus = String(row.status || '');
      const safeError = String(row.error || '').replace(/"/g, '""');
      csvRows.push(`"${safePath}","${safeCN}","${safeEN}","${safeStatus}","${safeError}"`);
    });
  }

  // 使用 CRLF 换行，并添加 UTF-8 BOM 以避免 Excel 下中文乱码
  const csvContent = '\uFEFF' + csvRows.join('\r\n');
  console.log('CSV content preview:', csvContent.substring(0, 200));

  let target = filePath;
  console.log('Target file path before dialog:', target);
  
  if (!target) {
    try {
      // 生成带时间戳的默认文件名
      const now = new Date();
      const timestamp = now.getFullYear().toString() + 
                       (now.getMonth() + 1).toString().padStart(2, '0') + 
                       now.getDate().toString().padStart(2, '0') + '_' +
                       now.getHours().toString().padStart(2, '0') + 
                       now.getMinutes().toString().padStart(2, '0') + 
                       now.getSeconds().toString().padStart(2, '0');
      const defaultFileName = `titles_${timestamp}.csv`;
      console.log('Generated default filename:', defaultFileName);
      
      console.log('Showing save dialog...');
      
      // 设置默认保存路径为D:\2-file\image
      const defaultDir = 'D:\\2-file\\image';
      const fullDefaultPath = path.join(defaultDir, defaultFileName);
      console.log('Default save path:', fullDefaultPath);
      
      // 确保目标目录存在，如果不存在则创建
      let finalDefaultPath;
      if (!fs.existsSync(defaultDir)) {
        try {
          fs.mkdirSync(defaultDir, { recursive: true });
        } catch (error) {
          console.warn('无法创建目标目录，使用桌面:', error);
          const desktopPath = path.join(os.homedir(), 'Desktop');
          finalDefaultPath = path.join(desktopPath, defaultFileName);
        }
      }
      if (!finalDefaultPath) {
        finalDefaultPath = fullDefaultPath;
      }
      console.log('Final default save path:', finalDefaultPath);
      
      const result = dialog.showSaveDialogSync(mainWindow, {
        title: '保存CSV文件',
        defaultPath: finalDefaultPath,
        filters: [
          { name: 'CSV文件', extensions: ['csv'] },
          { name: '所有文件', extensions: ['*'] }
        ]
      });
      target = result;
      console.log('Dialog result:', target);
    } catch (dialogError) {
      console.error('Dialog error:', dialogError);
      throw new Error(`对话框错误: ${dialogError.message}`);
    }
  }

  if (!target) {
    console.log('No target selected');
    return null;
  }

  try {
    console.log('Writing to:', target);
    // 确保目录存在
    const targetDir = path.dirname(target);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.writeFileSync(target, csvContent, 'utf8');
    console.log('File written successfully');
    return target;
  } catch (error) {
    console.error('Write file error:', error);
    throw new Error(`保存文件失败: ${error.message}`);
  }
});

// 添加Excel导出功能
ipcMain.handle('check-file-exists', async (_evt, filePath) => {
  try {
    const stats = fs.statSync(filePath);
    return { exists: true, size: stats.size };
  } catch (error) {
    return { exists: false, error: error.message };
  }
});

// 添加打开文件夹的功能
ipcMain.handle('open-folder', async (_evt, filePath) => {
  try {
    const path = require('path');
    const folderPath = path.dirname(filePath);
    await shell.openPath(folderPath);
    return true;
  } catch (error) {
    console.error('Open folder error:', error);
    return false;
  }
});

ipcMain.handle('save-excel', async (_evt, data) => {
  try {
    // 生成带时间戳的默认文件名
    const now = new Date();
    const timestamp = now.getFullYear().toString() + 
                     (now.getMonth() + 1).toString().padStart(2, '0') + 
                     now.getDate().toString().padStart(2, '0') + '_' +
                     now.getHours().toString().padStart(2, '0') + 
                     now.getMinutes().toString().padStart(2, '0') + 
                     now.getSeconds().toString().padStart(2, '0');
    const defaultFileName = `titles_${timestamp}.xlsx`;
    
    // 设置默认保存路径为D:\2-file\image
    const defaultDir = 'D:\\2-file\\image';
    const fullDefaultPath = path.join(defaultDir, defaultFileName);
    console.log('Excel default save path:', fullDefaultPath);
    
    // 确保目标目录存在，如果不存在则创建
    let finalDefaultPath;
    if (!fs.existsSync(defaultDir)) {
      try {
        fs.mkdirSync(defaultDir, { recursive: true });
      } catch (error) {
        console.warn('无法创建目标目录，使用桌面:', error);
        const desktopPath = path.join(os.homedir(), 'Desktop');
        finalDefaultPath = path.join(desktopPath, defaultFileName);
      }
    }
    if (!finalDefaultPath) {
      finalDefaultPath = fullDefaultPath;
    }
    console.log('Excel final default save path:', finalDefaultPath);
    
    const result = dialog.showSaveDialogSync(mainWindow, {
      title: '保存Excel文件',
      defaultPath: finalDefaultPath,
      filters: [
        { name: 'Excel文件', extensions: ['xlsx'] },
        { name: 'CSV文件', extensions: ['csv'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    
    if (!result) return null;
    
    // 不需要替换路径中的字符，只需要使用用户选择的路径
    const target = result;
    
    // 由于没有xlsx库，创建 CSV格式(但保持用户选择的扩展名)
    const headers = Object.keys(data[0] || {});
    const csv = [headers.join(',')]
      .concat(data.map(row => 
        headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(',')
      ))
      .join('\r\n'); // 使用 CRLF 换行
    
    // 确保目录存在
    const targetDir = path.dirname(target);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    fs.writeFileSync(target, '\uFEFF' + csv, 'utf8');
    console.log('Excel file written successfully to:', target);
    return target;
  } catch (error) {
    console.error('Excel export failed:', error);
    throw new Error(`导出文件失败: ${error.message}`);
  }
});
