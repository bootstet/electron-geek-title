const path = require('path');
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

function fileToDataUrl(p) {
  const ext = path.extname(p).toLowerCase();
  const mime = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.webp': 'image/webp', '.bmp': 'image/bmp'
  }[ext] || 'application/octet-stream';
  const b64 = fs.readFileSync(p).toString('base64');
  return `data:${mime};base64,${b64}`;
}

async function chatWithVision({ baseURL, apiKey, model, imagePath, prompt, maxTokens = 256 }) {
  const url = (baseURL || 'https://api.openai.com/v1').replace(/\/$/, '') + '/chat/completions';
  const body = {
    model: model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt || 'Describe the image and generate CN/EN titles.' },
          { type: 'image_url', image_url: { url: fileToDataUrl(imagePath) } }
        ]
      }
    ],
    max_tokens: maxTokens
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '';
  // 期望模型按模板返回，简单解析“中文：/英文：”两段
  let cn = '', en = '';
  const m1 = text.match(/中文[:：]\s*([\s\S]*?)(?:\n|$)/);
  const m2 = text.match(/英文[:：]\s*([\s\S]*?)(?:\n|$)/);
  if (m1) cn = m1[1].trim();
  if (m2) en = m2[1].trim();
  return { text, cn, en };
}

module.exports = { chatWithVision };
