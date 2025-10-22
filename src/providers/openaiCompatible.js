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
  const base = (baseURL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const url = base + '/chat/completions';

  // 兼容 火山方舟(豆包) OpenAI 风格：其 content.type 常用 input_text/input_image
  const useArkTypes = /ark\.cn-beijing\.volces\.com|volcengine\.com/i.test(base);

  const content = useArkTypes ? [
    { type: 'input_text', text: prompt || 'Describe the image and generate CN/EN titles.' },
    { type: 'input_image', image_url: { url: fileToDataUrl(imagePath) } }
  ] : [
    { type: 'text', text: prompt || 'Describe the image and generate CN/EN titles.' },
    { type: 'image_url', image_url: { url: fileToDataUrl(imagePath) } }
  ];

  const body = {
    model: model,
    messages: [
      { role: 'user', content }
    ],
    max_tokens: maxTokens
  };
  
  // 生成 curl 命令用于日志记录（隐藏图片与密钥）
  const safeKey = typeof apiKey === 'string' && apiKey.length > 12
    ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`
    : '***';

  const curlBody = {
    ...body,
    messages: body.messages.map(msg => ({
      ...msg,
      content: msg.content.map(item => {
        if (item.image_url) {
          return { ...item, image_url: { url: '[IMAGE_DATA_BASE64_HIDDEN]' } };
        }
        return item;
      })
    }))
  };
  
  const curlCommand = `curl -X POST "${url}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${safeKey}" \\
  -d '${JSON.stringify(curlBody, null, 2)}'`;
  
  console.log('\n=== API 请求 Curl 命令 ===');
  console.log('模型:', model);
  console.log('端点:', url);
  if (useArkTypes) console.log('模式: Doubao/Ark(OpenAI兼容)');
  console.log('Curl 命令:');
  console.log(curlCommand);
  console.log('注意: 图片数据已隐藏，实际请求包含完整的base64图片数据');
  console.log('=========================\n');
  
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
