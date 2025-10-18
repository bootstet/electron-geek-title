# 极客标题 v1.07 - AI图片标题生成器

基于 Electron + Vue 3 的批量图片AI标题生成工具，支持多种AI服务商，专为跨境电商设计。

![应用界面](https://via.placeholder.com/800x600?text=极客标题应用界面)

## ✨ 主要特性

- 🤖 **多AI服务商支持**：豆包、阿里云、智谱、OpenAI
- 🔄 **批量处理**：支持同时处理多张图片，可调节并发数
- 🌐 **双语标题**：同时生成中英文标题，适合跨境电商
- 📊 **实时监控**：显示处理进度、成功率和详细日志
- 🎛️ **灵活配置**：自定义提示词、过滤规则、前后缀
- 📁 **智能导出**：支持CSV格式，便于后续处理
- 🖼️ **图片压缩**：可选的图片压缩功能，节省API调用成本

## 🚀 快速开始

### 环境要求

- Node.js 16.0+ 
- Windows/macOS/Linux

### 安装步骤

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd electron-geek-title
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动开发模式**
   ```bash
   npm run dev         # 启动Vite开发服务器
   npm run dev:electron # 启动Electron应用
   ```

4. **构建生产版本**
   ```bash
   npm run build:renderer  # 构建Vue应用
   npm run start           # 启动Electron应用
   npm run build           # 打包为安装程序
   ```

## 📖 使用指南

### 1. 配置AI服务

#### 豆包/火山引擎配置 ⭐ 推荐

豆包使用推理接入点方式，配置步骤：

1. **创建推理接入点**
   - 访问 [火山引擎控制台](https://console.volcengine.com/ark)
   - 选择"推理接入点"→"创建接入点"
   - 选择支持**视觉理解**的Doubao模型（非图像生成模型）
   - 获取接入点ID（格式：ep-xxxxxxxxx-xxxxx）

2. **应用配置**
   - 选择"豆包-推理接入点"
   - 输入接入点ID和API Key
   - 使用测试连接功能验证

**详细指南**: [豆包推理接入点配置指南.md](./豆包推理接入点配置指南.md)

#### 阿里云DashScope配置
1. 访问 [百炼平台](https://bailian.console.aliyun.com/)
2. 开通DashScope服务
3. 获取API Key
4. 选择相应的通义千问视觉模型

#### 智谱AI配置
1. 访问 [智谱AI开放平台](https://open.bigmodel.cn/)
2. 注册并获取API Key
3. 选择GLM-4V系列模型

### 2. 基础使用流程

1. **选择图片文件夹**
   - 点击"选择图片文件夹"按钮
   - 支持JPG、PNG、WebP、BMP格式

2. **配置AI设置**
   - 点击"API设置"配置密钥
   - 选择合适的模型
   - 可使用"测试连接"验证配置

3. **自定义生成参数**
   - 调整提示词模板
   - 设置过滤字符和前后缀
   - 选择是否压缩图片

4. **开始生成标题**
   - 点击"开始写标题"
   - 实时查看处理进度和日志

5. **导出结果**
   - 支持CSV格式导出
   - 可选择批量重命名文件

### 3. 高级功能

#### 自定义提示词
应用支持使用变量的提示词模板：

```text
你是一名跨境电商运营，图片是{category}产品，现在要写一个符合跨境电商的中文标题和英文标题，要求180至220个字符的英文标题和180至220个字符的中文标题之间|分开
```

支持的变量：
- `{category}`: 产品类目

#### 批量处理优化
- **并发数控制**：根据API限制调整（建议1-5）
- **图片压缩**：大图片建议开启压缩功能
- **错误重试**：单个文件失败不影响整体进度

#### 结果过滤和格式化
- **字符过滤**：自动移除不合规字符
- **前缀后缀**：统一添加品牌标识
- **语言优化**：英文标题可选择移除中文字符

## 🔧 故障排除

### 常见错误解决

#### 1. HTTP 404 模型不存在错误
```
HTTP 404 {"error":{"code":"InvalidEndpointOrModel.NotFound"}}
```

**解决方法：**
1. 确认API Key有效且有余额
2. 使用"自定义模型"输入正确的模型名称
3. 检查API端点URL是否正确
4. 使用"测试连接"功能验证配置

#### 2. 应用启动失败
**解决方法：**
```bash
# 重新安装依赖
npm install

# 重新构建
npm run build:renderer

# 清除缓存
rm -rf node_modules package-lock.json
npm install
```

#### 3. 图片处理失败
**解决方法：**
- 确认图片格式支持（JPG/PNG/WebP/BMP）
- 检查图片文件大小（建议<10MB）
- 确认文件路径无特殊字符

**相关文档**：
- [故障排除指南.md](./故障排除指南.md) - 全面的问题解决方案
- [豆包推理接入点配置指南.md](./豆包推理接入点配置指南.md) - 豆包专门配置指南

## 📁 项目结构

```
electron-geek-title/
├── src/
│   ├── main.js              # Electron主进程
│   ├── preload.js           # 预加载脚本
│   ├── providers/           # AI服务商接口
│   │   └── openaiCompatible.js
│   └── renderer/            # Vue渲染进程
│       ├── index.html       # 入口HTML
│       ├── main.js          # Vue应用入口
│       ├── App.vue          # 主组件
│       └── style.css        # 样式文件
├── dist/                    # 构建输出
├── package.json
├── vite.config.js           # Vite配置
├── README.md                # 使用说明
└── 故障排除指南.md           # 故障排除文档
```

## 🛠️ 技术栈

- **前端框架**：Vue 3 + Composition API
- **桌面应用**：Electron 31+
- **构建工具**：Vite
- **UI组件**：原生HTML/CSS
- **图片处理**：Sharp
- **数据存储**：Electron Store

## 🔮 支持的AI模型

### 豆包/火山引擎
- `doubao-vision-32k`
- `doubao-vision-128k`
- 自定义接入点格式

### 阿里云DashScope  
- `qwen-vl-max`
- `qwen-vl-plus`
- `qwen-vl-chat-v1`

### 智谱AI
- `glm-4v`
- `glm-4v-plus`

### OpenAI
- `gpt-4o`
- `gpt-4o-mini`
- `gpt-4-vision-preview`

## 📊 性能优化建议

1. **API调用优化**
   - 控制并发数避免触发限流
   - 启用图片压缩减少传输时间
   - 合理设置max_tokens参数

2. **内存管理**
   - 处理大量图片时建议分批进行
   - 定期清理操作日志
   - 关闭不必要的功能

3. **网络优化**
   - 确保网络连接稳定
   - 考虑使用代理服务器
   - 设置合适的超时时间

## 🤝 贡献指南

1. Fork本项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

## 📄 许可证

本项目采用 MIT 许可证。详情请参阅 [LICENSE](LICENSE) 文件。

## 🆕 更新日志

### v1.0.7 (2024-10-15)
- ✅ 添加Vue 3支持，全面重构UI
- ✅ 支持自定义模型名称
- ✅ 添加API连接测试功能
- ✅ **重要**: 支持豆包推理接入点配置
- ✅ 优化批量处理逻辑和错误处理
- ✅ 完善操作日志和进度显示
- ✅ 支持结果面板折叠/展开
- ✅ 添加API Key显示/隐藏切换
- ✅ 新增豆包专门配置指南文档

### v1.0.6
- ✅ 修复Electron Store导入问题
- ✅ 优化图片压缩功能
- ✅ 改进错误处理机制

## 💡 使用技巧

1. **提示词优化**：使用具体的产品描述可以获得更好的标题
2. **批量处理**：建议单次处理不超过50张图片
3. **模型选择**：豆包性价比高，阿里云能力强，智谱中文友好
4. **结果验证**：使用测试连接功能确保配置正确

---

**如果这个项目对您有帮助，请给个 ⭐ Star 支持一下！**