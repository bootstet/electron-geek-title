<template>
  <div class="app">
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
        <button @click="exportCSV" :disabled="results.length === 0">批量改图名</button>
        <button>下载新版</button>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="main-content">
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
              <label>API设置</label>
              <input v-model="settings.apiKey" placeholder="" />
            </div>
            <div class="form-row">
              <label>选择模型:</label>
              <select v-model="settings.model">
                <option value="qwen-vl-max">qwen-vl-max</option>
                <option value="gpt-4o">gpt-4o</option>
                <option value="doubao-vision">doubao-vision</option>
              </select>
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
              placeholder="你是一名跨境电商运营，图片是印在毛衣上的，现在要对这款毛衣，写一个符合跨境电商的中文标题和英文标题，要求180至220个字符的英文标题和180至220个字符的中文标题之间|分开"
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
            </div>
            <div style="margin-top: 12px;">
              <input v-model="settings.outputPath" placeholder="" style="flex: 1" />
              <button @click="selectOutputPath" style="margin-left: 8px">选择路径</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部结果区域 -->
    <div style="padding: 12px; background: white; border-top: 1px solid #e5e6e8; max-height: 200px; overflow-y: auto;">
      <div style="color: #333; margin-bottom: 8px;">识别结果</div>
      <div v-if="results.length === 0" style="color: #999; font-size: 13px;">
        软件支持同时生成中文标题和英文标题，提示词请参考页面的产品特征<br/>
        如果需要同时中文标题，则需要在提示词中给出" "分隔中英文标题<br/>
        建议提示词加上" 中文标题和英文标题之间|分开"<br/>
        <span style="color: #4285f4;">内存使用：{{ memoryUsage }} MB</span>
      </div>
      <div v-if="results.length > 0">
        <table class="results-table">
          <thead>
            <tr>
              <th>文件</th>
              <th>中文标题</th>
              <th>英文标题</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="result in results" :key="result.file">
              <td>{{ getFileName(result.file) }}</td>
              <td>{{ result.cn || '' }}</td>
              <td>{{ result.en || '' }}</td>
              <td>{{ result.error ? '错误: ' + result.error : '完成' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'

const selectedFolder = ref('')
const imageFiles = ref([])
const selectedImageIndex = ref(-1)
const previewImage = ref('')
const isGenerating = ref(false)
const results = ref([])

const settings = ref({
  baseURL: 'https://api.openai.com/v1',
  model: 'qwen-vl-max',
  apiKey: '',
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
  enableSuffix: false,
  suffix: "Women's clothing",
  outputPath: '',
  removeChineseWhenEnglish: true,
  basePrompt: `你是一名跨境电商运营，图片是印在毛衣上的，现在要对这款毛衣，写一个符合跨境电商的中文标题和英文标题，要求180至220个字符的英文标题和180至220个字符的中文标题之间|分开`
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
  if (!imageFiles.value.length) return
  
  isGenerating.value = true
  results.value = []
  
  try {
    const payload = {
      files: imageFiles.value,
      ...settings.value
    }
    
    const generatedResults = await window.gt.generateTitles(payload)
    results.value = generatedResults
  } catch (error) {
    console.error('Generation failed:', error)
  } finally {
    isGenerating.value = false
  }
}

const exportCSV = async () => {
  if (results.value.length > 0) {
    await window.gt.saveCSV(results.value)
  }
}

const renameFiles = async () => {
  if (results.value.length > 0) {
    const renameResults = await window.gt.renameByTitle(results.value, '{base}-{lang}')
    console.log('Rename results:', renameResults)
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
  await window.gt.setSettings(settings.value)
  console.log('Settings saved')
}

const loadSettings = async () => {
  const savedSettings = await window.gt.getSettings()
  if (savedSettings) {
    Object.assign(settings.value, savedSettings)
  }
}

const getFileName = (filePath) => {
  return filePath.split('\\').pop() || filePath.split('/').pop()
}

const selectOutputPath = async () => {
  const path = await window.gt.selectFolder()
  if (path) {
    settings.value.outputPath = path
  }
}

onMounted(() => {
  loadSettings()
})

// 自动选择第一张图片
watch(imageFiles, (newFiles) => {
  if (newFiles.length > 0) {
    selectImage(0)
  }
})
</script>