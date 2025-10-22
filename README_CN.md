# 增哥标题（Electron 版）

功能
- 批量选择图片，调用“OpenAI 兼容”视觉对话接口生成中/英标题
- 可选自动压缩图片（最小边300px），降低费用与超时
- 标题过滤敏感字符、添加前后缀；英文可自动去除中文字符
- 批量按标题复制改名、导出 CSV
- 本地保存 API/模型/提示词等设置

安装与运行
1) 安装依赖
   npm install
2) 开发启动
   npm start
3) 打包（可选）
   npm run build

使用说明
- 基址(baseURL)：支持 OpenAI 标准接口（/v1/chat/completions）。若接入豆包/通义千问，请使用其 OpenAI 兼容网关或自行代理到兼容网关。
- 模型(model)：如 gpt-4o、qwen-vl-max、doubao-vision 等（以实际服务商为准）。
- API Key：粘贴服务商的密钥。
- 提示词：可编辑，点击“默认提示词”恢复。
- 结果表格：生成后可导出 CSV 或按标题复制改名。

注意
- 你的图片会被发送到选定的模型服务商进行推理，请按需勾选压缩、留意隐私与费用。
- 不同服务商的“视觉+聊天”接口在细节上可能有差异；本项目按 OpenAI 规范实现，若不兼容，请根据服务商文档在 src/providers/openaiCompatible.js 中调整。
