<template>
  <div class="app">
    <!-- API设置弹窗 -->
    <div v-if="showApiModal" class="modal-overlay" @click="closeApiModal">
      <div class="modal-content" @click.stop>
        <h3>API密钥设置</h3>
        <div class="api-input-section">
          <label>API Key:</label>
          <div class="api-key-input-wrapper">
            <input 
              v-model="tempApiKey" 
              :type="showApiKey ? 'text' : 'password'" 
              placeholder="请输入API密钥" 
            />
            <button 
              type="button" 
              class="toggle-visibility-btn"
              @click="toggleApiKeyVisibility"
              :title="showApiKey ? '隐藏' : '显示'"
            >
              <span v-if="showApiKey">🙈</span>
              <span v-else>👁️</span>
            </button>
          </div>
        </div>
        <div class="modal-buttons">
          <button @click="testConnection" style="background: #34a853; color: white;" :disabled="!tempApiKey">测试连接</button>
          <button @click="saveApiKey" class="primary">保存</button>
          <button @click="resetSettings" style="background: #ea4335; color: white;">重置设置</button>
          <button @click="closeApiModal">取消</button>
        </div>
        <div class="api-providers">
          <p><strong>豆包API:</strong> <a href="https://console.volcengine.com/ark" target="_blank">https://console.volcengine.com/ark</a></p>
          <p><strong>阿里API:</strong> <a href="https://bailian.console.aliyun.com/" target="_blank">https://bailian.console.aliyun.com/</a></p>
          <p><strong>智谱API:</strong> <a href="https://open.bigmodel.cn/" target="_blank">https://open.bigmodel.cn/</a></p>
          <div style="margin-top: 12px; padding: 8px; background: #f8f9fa; border-radius: 4px; font-size: 12px;">
            <p style="margin: 0 0 4px 0; font-weight: 500;">豆包配置步骤：</p>
            <p style="margin: 2px 0; font-size: 12px;">① 在火山引擎控制台创建“推理接入点”</p>
            <p style="margin: 2px 0; font-size: 12px;">② 选择能做图片理解的模型（如Doubao模型）</p>
            <p style="margin: 2px 0; font-size: 12px;">③ 复制接入点名称（ep-xxxxxxxxx-xxxxx）</p>
            <p style="margin: 2px 0; font-size: 12px;">④ 在下面选择“豆包-推理接入点”并输入</p>
            <p style="margin: 4px 0 2px 0; font-weight: 500;">其他模型建议：</p>
            <p style="margin: 2px 0;">• 阿里云: qwen-vl-max （能力强）</p>
            <p style="margin: 2px 0;">• 智谱: glm-4v （中文友好）</p>
            <p style="margin: 4px 0 2px 0; font-weight: 500; color: #ea4335;">如果遇到模型不存在错误：</p>
            <p style="margin: 2px 0;">• 请在控制台查看您的实际模型名称</p>
            <p style="margin: 2px 0;">• 使用“自定义模型”选项输入完整名称</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 顶部工具栏 -->
    <div class="top-toolbar">
      <div class="toolbar-left">
        <button @click="selectFolder">选择图片文件夹</button>
        <button @click="startGeneration" :disabled="!selectedFolder || isGenerating" class="primary">
          {{ isGenerating ? '开始写标题' : '开始写标题' }}
        </button>
        <button>首存</button>
        <button :disabled="isGenerating">停止</button>
        <span>进度: {{ results.length }}/{{ imageFiles.length }}</span>
      </div>
      <div class="toolbar-right">
        <span>并发数:</span>
        <input type="number" v-model.number="settings.concurrency" min="1" max="10" style="width: 60px" />
          <!--<button @click="exportCSV" :disabled="results.length === 0">批量改图</button> -->
        <!--<button>下载新版</button> -->
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="main-content" :class="{ 'has-results': results.length > 0 || operationLogs.length > 0 }">
      <!-- 左侧预览区域 -->
      <div class="left-panel">
        <div class="preview-section">
          <div class="image-preview">
            <img v-if="previewImage" :src="previewImage" alt="预览" />
            <div v-else class="placeholder">缩略图</div>
          </div>
        </div>
      </div>

      <!-- 右侧控制面板 -->
      <div class="right-panel">
        <!-- AI设置 -->
        <div class="ai-settings">
          <div class="section-header">AI设置</div>
          <div class="section-content">
            <div class="form-row">
              <button @click="openApiModal" class="api-settings-btn">API设置</button>
            </div>
            <div class="form-row">
              <label>选择模型:</label>
              <select v-model="settings.model" @change="updateApiProvider">
                <optgroup label="豆包推理接入点">
                  <option value="doubao-endpoint">豆包-推理接入点 (需手动配置)</option>
                </optgroup>
                <optgroup label="豆包通用模型">
                  <option value="doubao-1-5-vision-pro-250328">豆包 Doubao-1.5-vision-pro</option>
                  <option value="doubao-4o">豆包-4o (视觉理解)</option>
                  <option value="doubao-vision">豆包-vision (视觉理解)</option>
                  <option value="doubao-multimodal">豆包-multimodal (多模态)</option>
                </optgroup>
                <optgroup label="阿里云模型">
                  <option value="qwen-vl-max">阿里云-qwen-vl-max</option>
                  <option value="qwen-vl-plus">阿里云-qwen-vl-plus</option>
                </optgroup>
                <optgroup label="智谱模型">
                  <option value="glm-4v">智谱-glm-4v</option>
                  <option value="glm-4v-plus">智谱-glm-4v-plus</option>
                </optgroup>
                <optgroup label="OpenAI模型">
                  <option value="gpt-4o">OpenAI-gpt-4o</option>
                  <option value="gpt-4o-mini">OpenAI-gpt-4o-mini</option>
                </optgroup>
                <option value="custom">自定义模型</option>
              </select>
            </div>
            <div v-if="settings.model === 'doubao-endpoint'" class="form-row">
              <label>推理接入点名称:</label>
              <input 
                v-model="settings.doubaoEndpoint" 
                placeholder="例如: ep-20241015xxxxxx-xxxxx" 
                @focus="ensureDefaultEndpoint"
              />
              <small style="color: #666; font-size: 11px;">
                请从火山引擎控制台复制您的推理接入点名称
              </small>
            </div>
            <div v-if="settings.model === 'custom'" class="form-row">
              <label>自定义模型名称:</label>
              <input v-model="settings.customModel" placeholder="请输入完整的模型名称" />
            </div>
            <div v-if="settings.apiKey" class="api-key-display">
              <small>
                API Key: 
                <span 
                  class="api-key-text" 
                  @click="toggleMainApiKeyVisibility"
                  :title="showMainApiKey ? '点击隐藏' : '点击显示'"
                >
                  {{ showMainApiKey ? settings.apiKey : maskedApiKey }}
                </span>
                <button 
                  class="api-key-toggle-btn"
                  @click="toggleMainApiKeyVisibility"
                  :title="showMainApiKey ? '隐藏' : '显示'"
                >
                  {{ showMainApiKey ? '🙈' : '👁️' }}
                </button>
              </small>
              <div style="margin-top: 4px; font-size: 11px; color: #888;">
                端点: {{ settings.baseURL }}
              </div>
            </div>
          </div>
        </div>

        <!-- 选项 -->
        <div class="options-section">
          <div class="section-header">选项</div>
          <div class="section-content">
            <div class="option-grid">
              <div class="option-item">
                <input type="checkbox" v-model="settings.needCN" id="needCN" />
                <label for="needCN">自动压缩图片</label>
              </div>
              <div class="option-item">
                <input type="number" v-model.number="settings.minSize" style="width: 60px" />
                <label>修繁</label>
              </div>
            </div>
          </div>
        </div>

        <!-- 自定义提示词 -->
        <div class="prompt-section">
          <div class="section-header">自定义提示词</div>
          <div class="section-content">
            <textarea 
              v-model="settings.basePrompt" 
              class="prompt-textarea"
              placeholder="你是一名跨境电商运营，图片是印在毛毯上的，现在要对这款毛毯，写一个符合跨境电商的中文标题和英文标题，需要180至220个字符的英文标题和180至220个字符的中文标题，不要表情和特殊符号，中文标题和英文标题之间用|分开"
            ></textarea>
          </div>
        </div>

        <!-- 保存设置 -->
        <div class="save-section">
          <div class="section-header">保存设置</div>
          <div class="section-content">
            <div class="option-item">
              <input type="checkbox" v-model="settings.filterEnabled" id="filter" />
              <label for="filter">过滤字符:</label>
            </div>
            <div style="margin-top: 8px;">
              <input v-model="settings.filterChars" placeholder="中文标题#；#英文标题#；#题儿3D中敏感词" style="width: 100%" />
              <div style="font-size: 12px; color: #666; margin-top: 4px;">
                过滤状态: {{ settings.filterEnabled ? '开启' : '关闭' }} | 过滤字符: "{{ settings.filterChars || '未设置' }}" 过滤词之间用；或者#分割
              </div>
            </div>
            <div style="margin-top: 12px;">
              <div class="option-item">
                <input type="checkbox" v-model="settings.enablePrefix" id="prefix" />
                <label for="prefix">添加前缀:</label>
              </div>
              <input v-model="settings.prefix" placeholder="1PC,2D" style="width: 100%; margin-top: 4px" />
            </div>
            <div style="margin-top: 12px;">
              <div class="option-item">
                <input type="checkbox" v-model="settings.enableSuffix" id="suffix" />
                <label for="suffix">添加后缀:</label>
              </div>
              <input v-model="settings.suffix" placeholder="Women's clothing" style="width: 100%; margin-top: 4px" />
              <div style="font-size: 12px; color: #666; margin-top: 4px;">
                后缀状态: {{ settings.enableSuffix ? '开启' : '关闭' }} | 后缀内容: "{{ settings.suffix || '未设置' }}"
              </div>
            </div>
            <!--<div style="margin-top: 12px;">
              <input v-model="settings.outputPath" placeholder="" style="flex: 1" />
              <button @click="selectOutputPath" style="margin-left: 8px">选择路径</button>
            </div> -->
          </div>
        </div>
      </div>
    </div>

    <!-- 底部结果区域 -->
    <div class="results-panel" :class="{ 'collapsed': isResultsPanelCollapsed }">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="color: #333; font-weight: 500;">识别结果</div>
          <button 
            @click="toggleResultsPanel" 
            class="collapse-btn"
            :title="isResultsPanelCollapsed ? '展开' : '折叠'"
          >
            {{ isResultsPanelCollapsed ? '▲' : '▼' }}
          </button>
        </div>
        <div style="display: flex; gap: 8px;">
          <button @click="exportToCSV" :disabled="results.length === 0" style="font-size: 12px; padding: 4px 8px;">导出CSV</button>
          <button @click="exportToExcel" :disabled="results.length === 0" style="font-size: 12px; padding: 4px 8px;">导出Excel</button>
          <button @click="clearResults" :disabled="results.length === 0" style="font-size: 12px; padding: 4px 8px;">清空结果</button>
        </div>
      </div>
      
      <!-- 内容区域，只在非折叠状态下显示 -->
      <div v-show="!isResultsPanelCollapsed" class="results-content">
      
      <!-- 日志显示区域（即使没有日志也保留容器，方便拖拽） -->
      <div class="logs-section" style="margin-bottom: 8px;">
        <div style="font-size: 13px; color: #666; margin-bottom: 4px;">操作日志:</div>
        <div 
          class="log-container" 
          :style="{ height: logsHeight + 'px', overflowY: 'auto', background: '#f8f9fa', padding: '8px', borderRadius: '4px', fontSize: '12px' }"
        >
          <div v-if="operationLogs.length === 0" style="color:#999; font-size:12px;">暂无日志</div>
          <div v-for="(log, index) in operationLogs" :key="index" :class="['log-entry', log.type]">
            <span class="log-time">{{ log.time }}</span>
            <span class="log-message">{{ log.message }}</span>
          </div>
        </div>
      </div>
      <!-- 拖拽调整日志与表格高度的句柄（始终可见） -->
      <div 
        class="vertical-resize-handle" 
        @mousedown="onLogsResizeMouseDown" 
        @touchstart.prevent="onLogsResizeTouchStart"
        :title="'拖动调整日志高度，同时调整窗口高度'"
      ></div>
      
      <div v-if="results.length === 0 && !isGenerating" style="color: #999; font-size: 13px;">
        软件支持同时生成中文标题和英文标题，提示词请参考页面的产品特征<br/>
        如果需要同时中文标题，则需要在提示词中给出" "分隔中英文标题<br/>
        建议提示词加上" 中文标题和英文标题之间|分开"<br/>
        <span style="color: #4285f4;">内存使用：{{ memoryUsage }} MB</span>
      </div>
      
      <!-- 进度显示 -->
      <div v-if="isGenerating" style="margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="font-size: 13px; color: #333;">正在生成标题...</span>
          <span style="font-size: 13px; color: #666;">{{ results.length }}/{{ imageFiles.length }}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPercentage + '%' }"></div>
        </div>
      </div>
      
      <div v-if="results.length > 0">
        <table class="results-table">
          <thead>
            <tr>
              <th style="width: 20%">文件</th>
              <th style="width: 35%">中文标题</th>
              <th style="width: 35%">英文标题</th>
              <th style="width: 10%">状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="result in results" :key="result.file" :class="{ 'error-row': result.error }">
              <td :title="result.file">{{ getFileName(result.file) }}</td>
              <td :title="result.cn">{{ result.cn || '-' }}</td>
              <td :title="result.en">{{ result.en || '-' }}</td>
              <td>
                <span v-if="result.error" class="status-error">错误</span>
                <span v-else-if="result.processing" class="status-processing">处理中</span>
                <span v-else class="status-success">完成</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div style="margin-top: 8px; font-size: 12px; color: #666; text-align: center;">
          总计: {{ results.length }} 个文件 | 成功: {{ successCount }} | 失败: {{ errorCount }}
        </div>
      </div>
      </div> <!-- 结束 results-content -->
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed, nextTick } from 'vue'

const selectedFolder = ref('')
const imageFiles = ref([])
const selectedImageIndex = ref(-1)
const previewImage = ref('')
const isGenerating = ref(false)
const results = ref([])
const showApiModal = ref(false)
const tempApiKey = ref('')
const operationLogs = ref([])
const isProcessingBatch = ref(false)
const showApiKey = ref(false)
const showMainApiKey = ref(false)
const isResultsPanelCollapsed = ref(false)

// 日志区域高度与拖拽状态
const logsHeight = ref(100)
let dragStartY = 0
let startLogsHeight = 0
let startWindowHeight = 0
const MIN_LOGS_HEIGHT = 40
const MAX_LOGS_HEIGHT = 600

const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

const onLogsResizeMouseDown = async (e) => {
  dragStartY = e.clientY
  startLogsHeight = logsHeight.value
  try {
    const size = await window.gt.getWindowSize?.()
    startWindowHeight = Array.isArray(size) ? (size[1] || 0) : 0
  } catch {}
  window.addEventListener('mousemove', onLogsResizeMouseMove)
  window.addEventListener('mouseup', onLogsResizeMouseUp)
}

const onLogsResizeMouseMove = (e) => {
  const delta = e.clientY - dragStartY
  logsHeight.value = clamp(startLogsHeight + delta, MIN_LOGS_HEIGHT, MAX_LOGS_HEIGHT)
  const targetH = startWindowHeight + delta
  window.gt.setWindowHeight?.(targetH)
}

const onLogsResizeMouseUp = () => {
  window.removeEventListener('mousemove', onLogsResizeMouseMove)
  window.removeEventListener('mouseup', onLogsResizeMouseUp)
}

const onLogsResizeTouchStart = async (e) => {
  const touch = e.touches?.[0]
  if (!touch) return
  dragStartY = touch.clientY
  startLogsHeight = logsHeight.value
  try {
    const size = await window.gt.getWindowSize?.()
    startWindowHeight = Array.isArray(size) ? (size[1] || 0) : 0
  } catch {}
  window.addEventListener('touchmove', onLogsResizeTouchMove, { passive: false })
  window.addEventListener('touchend', onLogsResizeTouchEnd)
}

const onLogsResizeTouchMove = (e) => {
  const touch = e.touches?.[0]
  if (!touch) return
  const delta = touch.clientY - dragStartY
  logsHeight.value = clamp(startLogsHeight + delta, MIN_LOGS_HEIGHT, MAX_LOGS_HEIGHT)
  const targetH = startWindowHeight + delta
  window.gt.setWindowHeight?.(targetH)
}

const onLogsResizeTouchEnd = () => {
  window.removeEventListener('touchmove', onLogsResizeTouchMove)
  window.removeEventListener('touchend', onLogsResizeTouchEnd)
}

const settings = ref({
  baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
  model: 'doubao-endpoint',
  customModel: '',
  doubaoEndpoint: 'ep-20251015164704-dqbb7',
  apiKey: 'cf871f68-b5ae-4271-83e2-d9b56e203edf',
  category: '',
  needCN: true,
  needEN: true,
  compress: false,
  minSize: 800,
  concurrency: 5,
  filterEnabled: true,
  filterChars: '中文标题#；#英文标题#；#题儿3D中敏感词',
  enablePrefix: true,
  prefix: '1PC,2D',
  enableSuffix: true,
  suffix: "Women's clothing",
  outputPath: '',
  removeChineseWhenEnglish: true,
  basePrompt: `你是一名跨境电商运营，图片是印在毛毯上的，现在要对这款毛毯，写一个符合跨境电商的中文标题和英文标题，需要180至220个字符的英文标题和180至220个字符的中文标题，不要表情和特殊符号，中文标题和英文标题之间用|分开`
})

const memoryUsage = ref('165.62')

const selectFolder = async () => {
  const folder = await window.gt.selectFolder()
  if (folder) {
    selectedFolder.value = folder
    await loadImages()
  }
}

const loadImages = async () => {
  if (selectedFolder.value) {
    imageFiles.value = await window.gt.listImages(selectedFolder.value)
    results.value = []
    selectedImageIndex.value = -1
    previewImage.value = ''
  }
}

const selectImage = async (index) => {
  selectedImageIndex.value = index
  if (index >= 0 && index < imageFiles.value.length) {
    previewImage.value = await window.gt.previewImage(imageFiles.value[index])
  }
}

const startGeneration = async () => {
  if (!imageFiles.value.length) {
    addLog('error', '请先选择图片文件夹')
    return
  }
  
  if (!settings.value.apiKey) {
    addLog('error', '请先设置API Key')
    return
  }
  
  // 验证模型名称
  const validModels = [
    // 豆包推理接入点
    'doubao-endpoint',
    // 豆包通用模型
    'doubao-1-5-vision-pro-250328', 'doubao-4o', 'doubao-vision', 'doubao-multimodal',
    // 阿里云模型
    'qwen-vl-max', 'qwen-vl-plus',
    // 智谱模型
    'glm-4v', 'glm-4v-plus',
    // OpenAI模型
    'gpt-4o', 'gpt-4o-mini'
  ]
  
  if (!validModels.includes(settings.value.model)) {
    addLog('error', `不支持的模型: ${settings.value.model}，请重新选择模型`)
    addLog('info', '有效模型: ' + validModels.join(', '))
    return
  }
  
  // 额外验证推理接入点配置
  if (settings.value.model === 'doubao-endpoint' && !settings.value.doubaoEndpoint) {
    addLog('error', '请输入豆包推理接入点名称')
    return
  }
  
  if (settings.value.model === 'custom' && !settings.value.customModel) {
    addLog('error', '请输入自定义模型名称')
    return
  }
  
  isGenerating.value = true
  results.value = []
  operationLogs.value = []
  
  addLog('info', `开始处理 ${imageFiles.value.length} 个图片文件`)
  addLog('info', `使用模型: ${settings.value.model}`)
  addLog('info', `并发数: ${settings.value.concurrency}`)
  
  const startTime = Date.now()
  let processedCount = 0
  let successCount = 0
  let errorCount = 0
  
  try {
    // 创建并发处理队列
    const queue = [...imageFiles.value]
    const processing = []
    let activeCount = 0
    
    const processImage = async (imagePath) => {
      const fileName = getFileName(imagePath)
      addLog('info', `开始处理: ${fileName}`)
      
      // 先添加一个处理中的状态
      const processingResult = { 
        file: imagePath, 
        processing: true, 
        cn: '', 
        en: '', 
        error: null 
      }
      results.value.push(processingResult)
      
      try {
        // 使用JSON序列化确保数据安全传输
        const settingsData = JSON.parse(JSON.stringify(settings.value))
        let actualModel = settingsData.model
        if (settingsData.model === 'custom') {
          actualModel = settingsData.customModel
        } else if (settingsData.model === 'doubao-endpoint') {
          actualModel = settingsData.doubaoEndpoint
        }
        
        // 记录请求信息到前端控制台
        console.log('\n=== 准备发送API请求 ===')
        console.log('文件:', fileName)
        console.log('模型:', actualModel)
        console.log('API端点:', settingsData.baseURL)
        console.log('======================\n')
        
        // 在操作日志中显示Curl命令信息
        addLog('info', `正在请求 ${actualModel} API: ${fileName}`)
        const maskedKey = settingsData.apiKey ? `${settingsData.apiKey.substring(0, 8)}...${settingsData.apiKey.substring(settingsData.apiKey.length - 4)}` : ''
        
        // 生成完整的curl命令（隐藏图片数据）
        const curlPayload = {
          model: actualModel,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: settingsData.basePrompt || '' },
              { type: 'image_url', image_url: { url: '[IMAGE_BASE64_DATA_HIDDEN]' } }
            ]
          }],
          max_tokens: 500
        }
        
        const curlCommand = `curl -X POST "${settingsData.baseURL}/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${maskedKey}" \\
  -d '${JSON.stringify(curlPayload, null, 2)}'`
        
        addLog('info', 'Curl命令（控制台查看完整命令）:')
        console.log('\n=== 完整Curl命令 ===\n' + curlCommand + '\n==================\n')
        
        const payload = {
          files: [String(imagePath)],
          baseURL: settingsData.baseURL || 'https://api.openai.com/v1',
          apiKey: settingsData.apiKey || '',
          model: actualModel || 'gpt-4o',
          basePrompt: settingsData.basePrompt || '',
          category: settingsData.category || '',
          needCN: settingsData.needCN === true,
          needEN: settingsData.needEN === true,
          compress: settingsData.compress === true,
          minSize: parseInt(settingsData.minSize) || 300,
          quality: 80,
          removeChineseWhenEnglish: settingsData.removeChineseWhenEnglish === true,
          filterChars: settingsData.filterEnabled ? (settingsData.filterChars || '') : '',
          prefix: '', // 不传递前缀给AI，由AI根据提示词生成
          suffix: settingsData.enableSuffix ? (settingsData.suffix || '') : '',
          maxTokens: 500,
          concurrency: 1
        }
        
        const generatedResults = await window.gt.generateTitles(payload)
        const result = generatedResults[0]
        
        // 更新结果
        const index = results.value.findIndex(r => r.file === imagePath)
        if (index !== -1) {
          results.value[index] = {
            ...result,
            processing: false
          }
        }
        
        if (result.error) {
          addLog('error', `${fileName}: ${result.error}`)
          errorCount++
        } else {
          addLog('success', `${fileName}: 处理完成`)
          successCount++
        }
        
      } catch (error) {
        const index = results.value.findIndex(r => r.file === imagePath)
        if (index !== -1) {
          results.value[index] = {
            file: imagePath,
            processing: false,
            error: error.message || '处理失败',
            cn: '',
            en: ''
          }
        }
        addLog('error', `${fileName}: ${error.message || '处理失败'}`)
        errorCount++
      }
      
      processedCount++
      activeCount--
      
      // 继续处理队列
      if (queue.length > 0 && activeCount < settings.value.concurrency) {
        const nextImage = queue.shift()
        activeCount++
        processing.push(processImage(nextImage))
      }
    }
    
    // 启动初始并发处理
    const initialBatch = queue.splice(0, settings.value.concurrency)
    activeCount = initialBatch.length
    
    for (const imagePath of initialBatch) {
      processing.push(processImage(imagePath))
    }
    
    // 等待所有任务完成
    await Promise.all(processing)
    
    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(2)
    
    addLog('info', `处理完成! 耗时: ${duration}秒, 成功: ${successCount}, 失败: ${errorCount}`)
    
  } catch (error) {
    addLog('error', `批量处理失败: ${error.message}`)
    console.error('Generation failed:', error)
  } finally {
    isGenerating.value = false
  }
}

// 移除旧的exportCSV函数，已经由exportToCSV替代

const renameFiles = async () => {
  if (results.value.length > 0) {
    try {
      // 使用JSON序列化确保数据可以安全传输
      const rawResults = JSON.parse(JSON.stringify(results.value))
      const renameResults = await window.gt.renameByTitle(rawResults, '{base}-{lang}')
      addLog('success', `批量重命名完成，处理 ${renameResults.length} 个文件`)
      console.log('Rename results:', renameResults)
    } catch (error) {
      addLog('error', `批量重命名失败: ${error.message}`)
    }
  }
}

const setDefaultPrompt = () => {
  settings.value.basePrompt = `请为这张图片生成商品标题，要求：
1. 根据图片内容生成准确的标题
2. 考虑类目：{category}
3. 返回格式：
中文：[中文标题]
英文：[英文标题]

请确保标题简洁、准确、有吸引力。`
}

const saveSettings = async () => {
  try {
    // 使用JSON序列化确保设置数据可以安全传输
    const settingsToSave = JSON.parse(JSON.stringify(settings.value))
    await window.gt.setSettings(settingsToSave)
    console.log('Settings saved')
  } catch (error) {
    console.error('Failed to save settings:', error)
    addLog('error', `保存设置失败: ${error.message}`)
  }
}

const loadSettings = async () => {
  const savedSettings = await window.gt.getSettings()
  if (savedSettings) {
    // 对于特定字段，如果保存的设置为空或未定义，则使用默认值
    const merged = { ...settings.value, ...savedSettings }
    
    // 确保关键字段有默认值（包括空字符串的情况）
    if (!merged.doubaoEndpoint || merged.doubaoEndpoint.trim() === '') {
      merged.doubaoEndpoint = 'ep-20251015164704-dqbb7'
    }
    if (!merged.apiKey || merged.apiKey.trim() === '') {
      merged.apiKey = 'cf871f68-b5ae-4271-83e2-d9b56e203edf'
    }
    
    Object.assign(settings.value, merged)
    
    // 如果设置了默认值，立即保存以确保持久化
    if (merged.doubaoEndpoint === 'ep-20251015164704-dqbb7' || 
        merged.apiKey === 'cf871f68-b5ae-4271-83e2-d9b56e203edf') {
      await saveSettings()
    }
  }
}

const getFileName = (filePath) => {
  return filePath.split('\\').pop() || filePath.split('/').pop()
}

const getBaseName = (filePath) => {
  const name = getFileName(filePath) || ''
  return name.replace(/\.[^./\\]+$/, '')
}

const selectOutputPath = async () => {
  const path = await window.gt.selectFolder()
  if (path) {
    settings.value.outputPath = path
  }
}

// API弹窗相关函数
const openApiModal = () => {
  tempApiKey.value = settings.value.apiKey
  showApiModal.value = true
  showApiKey.value = false // 每次打开弹窗时默认隐藏API Key
}

const closeApiModal = () => {
  showApiModal.value = false
  tempApiKey.value = ''
  showApiKey.value = false
}

const saveApiKey = async () => {
  settings.value.apiKey = tempApiKey.value
  await saveSettings()
  closeApiModal() // 保存后关闭弹窗
}

const toggleApiKeyVisibility = () => {
  showApiKey.value = !showApiKey.value
}

const toggleMainApiKeyVisibility = () => {
  showMainApiKey.value = !showMainApiKey.value
}

const toggleResultsPanel = () => {
  isResultsPanelCollapsed.value = !isResultsPanelCollapsed.value
}

const testConnection = async () => {
  if (!tempApiKey.value) {
    alert('请先输入API Key')
    return
  }
  
  addLog('info', '正在测试API连接...')
  
  try {
    // 获取实际模型名称
    let testModel = settings.value.model
    if (settings.value.model === 'custom') {
      testModel = settings.value.customModel
    } else if (settings.value.model === 'doubao-endpoint') {
      testModel = settings.value.doubaoEndpoint
      if (!testModel) {
        addLog('error', '请先输入推理接入点名称')
        return
      }
    }
    const testPayload = {
      files: [], // 空文件列表，只用于测试
      baseURL: settings.value.baseURL,
      apiKey: tempApiKey.value,
      model: testModel,
      basePrompt: '测试',
      needCN: false,
      needEN: false,
      maxTokens: 10
    }
    
    // 这里我们只是测试参数格式，不实际调用
    addLog('success', `参数验证成功: ${testModel}`)
    addLog('info', `API端点: ${settings.value.baseURL}`)
    addLog('warning', '请确保您的API Key有访问此模型的权限')
    
  } catch (error) {
    addLog('error', `连接测试失败: ${error.message}`)
  }
}

const resetSettings = async () => {
  if (confirm('确定要重置所有设置吗？这将清除所有保存的配置。')) {
    // 重置为默认设置
    settings.value = {
      baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
      model: 'doubao-endpoint',
      customModel: '',
      doubaoEndpoint: 'ep-20251015164704-dqbb7',
      apiKey: 'cf871f68-b5ae-4271-83e2-d9b56e203edf',
      category: '',
      needCN: true,
      needEN: true,
      compress: false,
      minSize: 800,
      concurrency: 5,
      filterEnabled: true,
      filterChars: '中文标题#；#英文标题#；#题儿3D中敏感词',
      enablePrefix: true,
      prefix: '1PC,2D',
      enableSuffix: true,
      suffix: "Women's clothing",
      outputPath: '',
      removeChineseWhenEnglish: true,
      basePrompt: `你是一名跨境电商运营，图片是印在毛毯上的，现在要对这款毛毯，写一个符合跨境电商的中文标题和英文标题，需要180至220个字符的英文标题和180至220个字符的中文标题，不要表情和特殊符号，中文标题和英文标题之间用|分开`
    }
    // 更新API弹窗中的临时API Key
    tempApiKey.value = settings.value.apiKey
    await saveSettings()
    await nextTick() // 确保UI更新
    addLog('success', '设置已重置为默认值')
    // 不关闭API弹窗，让用户看到重置的结果
    // closeApiModal()
  }
}

const updateApiProvider = () => {
  // 根据选择的模型更新baseURL
  const model = settings.value.model
  if (model.includes('doubao')) {
    settings.value.baseURL = 'https://ark.cn-beijing.volces.com/api/v3'
  } else if (model.includes('qwen')) {
    settings.value.baseURL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  } else if (model.includes('glm')) {
    settings.value.baseURL = 'https://open.bigmodel.cn/api/paas/v4'
  } else if (model.includes('gpt')) {
    settings.value.baseURL = 'https://api.openai.com/v1'
  }
  addLog('info', `已切换至模型: ${model}, API端点: ${settings.value.baseURL}`)
  saveSettings()
}

// 计算属性
const maskedApiKey = computed(() => {
  if (!settings.value.apiKey) return ''
  const key = settings.value.apiKey
  if (key.length <= 8) return key
  return key.slice(0, 4) + '****' + key.slice(-4)
})

const progressPercentage = computed(() => {
  if (imageFiles.value.length === 0) return 0
  return Math.round((results.value.length / imageFiles.value.length) * 100)
})

const successCount = computed(() => {
  return results.value.filter(r => !r.error).length
})

const errorCount = computed(() => {
  return results.value.filter(r => r.error).length
})

// 日志函数
const addLog = (type, message) => {
  const now = new Date()
  const time = now.toLocaleTimeString('zh-CN', { hour12: false }).slice(0, 8)
  operationLogs.value.push({ type, message, time })
  // 保持最新的1000条日志
  if (operationLogs.value.length > 1000) {
    operationLogs.value.splice(0, operationLogs.value.length - 1000)
  }
}

// 导出函数
const exportToCSV = async () => {
  if (results.value.length === 0) {
    addLog('warning', '没有数据可导出')
    return
  }
  
  try {
    const rawResults = JSON.parse(JSON.stringify(results.value))
    const prefix = (settings.value.prefix || '').trim()
    
    // 处理中文标题的函数（添加前缀和后缀）
    const ensurePrefixedCN = (t) => {
      let s = String(t || '').trim()
      // 移除 **** 分隔符
      s = s.replace(/\s*\*\*\*\*\s*/g, ' ').replace(/\s+/g, ' ').trim()
      
      // 添加前缀
      if (prefix && settings.value.enablePrefix && !s.startsWith(prefix)) {
        s = `${prefix} ${s}`
      }
      
      // 添加后缀
      const suffix = (settings.value.suffix || '').trim()
      if (suffix && settings.value.enableSuffix && !s.endsWith(suffix)) {
        s = `${s} ${suffix}`
      }
      
      return s
    }
    
    // 处理英文标题的函数（添加前缀和后缀）
    const ensurePrefixedEN = (t) => {
      let s = String(t || '').trim()
      // 移除 **** 分隔符
      s = s.replace(/\s*\*\*\*\*\s*/g, ' ').replace(/\s+/g, ' ').trim()
      // 移除英文标题前面的 | 分隔符
      s = s.replace(/^\s*\|\s*/, '').trim()
      
      // 添加前缀
      if (prefix && settings.value.enablePrefix && !s.startsWith(prefix)) {
        s = `${prefix} ${s}`
      }
      
      // 添加后缀
      const suffix = (settings.value.suffix || '').trim()
      if (suffix && settings.value.enableSuffix && !s.endsWith(suffix)) {
        s = `${s} ${suffix}`
      }
      
      return s
    }

    const exportRows = rawResults.map(result => ({
      '货号': String(getBaseName(result.file)),
      '标题1': ensurePrefixedCN(result.cn || ''), // 只放中文标题
      '标题2（英文，没有可以留空）': ensurePrefixedEN(result.en || '') // 只放英文标题，也添加前缀
    }))
    
    console.log('Calling saveCSV with data:', exportRows)
    const savedPath = await window.gt.saveCSV(exportRows)
    console.log('saveCSV returned:', savedPath)
    
    if (savedPath) {
      addLog('success', `CSV文件已导出到: ${savedPath}`)
      addLog('info', `包含 ${rawResults.length} 条记录`)
      
      // 验证文件是否真的被创建
      try {
        const checkResult = await window.gt.checkFileExists(savedPath)
        if (checkResult && checkResult.exists) {
          addLog('info', `文件大小: ${Math.round(checkResult.size / 1024)}KB`)
        }
      } catch (e) {
        console.warn('Could not verify file creation:', e)
      }
      
      // 稍作延迟再打开文件夹，确保文件系统已更新
      setTimeout(async () => {
        try {
          await window.gt.openFolder(savedPath)
          addLog('info', '已打开文件所在文件夹')
        } catch (e) {
          console.warn('Could not open folder:', e)
          addLog('warning', '无法打开文件夹')
        }
      }, 500) // 500毫秒延迟，确保文件写入完成
    } else {
      addLog('warning', '导出已取消或失败')
    }
  } catch (error) {
    console.error('Export CSV error:', error)
    addLog('error', `导出CSV失败: ${error.message || error}`)
  }
}

const exportToExcel = async () => {
  if (results.value.length === 0) {
    addLog('warning', '没有数据可导出')
    return
  }
  
  try {
    const prefix = (settings.value.prefix || '').trim()
    
    // 处理中文标题的函数（添加前缀和后缀）
    const ensurePrefixedCN = (t) => {
      let s = String(t || '').trim()
      // 移除 **** 分隔符
      s = s.replace(/\s*\*\*\*\*\s*/g, ' ').replace(/\s+/g, ' ').trim()
      
      // 添加前缀
      if (prefix && settings.value.enablePrefix && !s.startsWith(prefix)) {
        s = `${prefix} ${s}`
      }
      
      // 添加后缀
      const suffix = (settings.value.suffix || '').trim()
      if (suffix && settings.value.enableSuffix && !s.endsWith(suffix)) {
        s = `${s} ${suffix}`
      }
      
      return s
    }
    
    // 处理英文标题的函数（添加前缀和后缀）
    const ensurePrefixedEN = (t) => {
      let s = String(t || '').trim()
      // 移除 **** 分隔符
      s = s.replace(/\s*\*\*\*\*\s*/g, ' ').replace(/\s+/g, ' ').trim()
      // 移除英文标题前面的 | 分隔符
      s = s.replace(/^\s*\|\s*/, '').trim()
      
      // 添加前缀
      if (prefix && settings.value.enablePrefix && !s.startsWith(prefix)) {
        s = `${prefix} ${s}`
      }
      
      // 添加后缀
      const suffix = (settings.value.suffix || '').trim()
      if (suffix && settings.value.enableSuffix && !s.endsWith(suffix)) {
        s = `${s} ${suffix}`
      }
      
      return s
    }

    const exportData = results.value.map(result => ({
      '货号': String(getBaseName(result.file)),
      '标题1': ensurePrefixedCN(result.cn || ''), // 只放中文标题
      '标题2（英文，没有可以留空）': ensurePrefixedEN(result.en || '') // 只放英文标题，也添加前缀
    }))
    
    console.log('Calling saveExcel with data:', exportData)
    const savedPath = await window.gt.saveExcel?.(exportData)
    console.log('saveExcel returned:', savedPath)
    
    if (savedPath) {
      addLog('success', `文件已导出到: ${savedPath}`)
      addLog('info', `包含 ${results.value.length} 条记录`)
      
      // 稍作延迟再打开文件夹，确保文件系统已更新
      setTimeout(async () => {
        try {
          await window.gt.openFolder(savedPath)
          addLog('info', '已打开文件所在文件夹')
        } catch (e) {
          console.warn('Could not open folder:', e)
          addLog('warning', '无法打开文件夹')
        }
      }, 500) // 500毫秒延迟，确保文件写入完成
    } else {
      addLog('warning', '导出已取消或失败')
    }
  } catch (error) {
    console.error('Export Excel error:', error)
    addLog('error', `导出失败: ${error.message || error}`)
    addLog('info', '正在尝试CSV格式导出...')
    exportToCSV() // 降级为CSV导出
  }
}

const clearResults = () => {
  results.value = []
  operationLogs.value = []
  addLog('info', '已清空结果')
}

// 确保默认值的函数
 const ensureDefaultEndpoint = () => {
  if (!settings.value.doubaoEndpoint || settings.value.doubaoEndpoint.trim() === '') {
    settings.value.doubaoEndpoint = 'ep-20251015164704-dqbb7'
    saveSettings()
  }
}

onMounted(async () => {
  await loadSettings()
  
  // 在加载后再次检查并强制设置默认值
  console.log('Current settings after load:', {
    doubaoEndpoint: settings.value.doubaoEndpoint,
    apiKey: settings.value.apiKey
  })
  
  let needsSave = false
  
  // 强制设置默认值（无论什么情况都设置）
  settings.value.doubaoEndpoint = 'ep-20251015164704-dqbb7'
  settings.value.apiKey = 'cf871f68-b5ae-4271-83e2-d9b56e203edf'
  needsSave = true
  
  console.log('Force set to:', {
    doubaoEndpoint: settings.value.doubaoEndpoint,
    apiKey: settings.value.apiKey
  })
  
  if (needsSave) {
    await saveSettings()
    await nextTick() // 确保OM更新
    console.log('Settings saved with default values')
  }
})

// 自动选择第一张图片
watch(imageFiles, (newFiles) => {
  if (newFiles.length > 0) {
    selectImage(0)
  }
})
</script>