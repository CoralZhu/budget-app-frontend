<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { importAlipay, importWechat } from '@/api/import'

const router = useRouter()
const fileInput = ref(null)
const selectedPlatform = ref('')
const selectedFile = ref(null)
const importing = ref(false)
const importResult = ref(null)
const failedPanelOpen = ref(false)

const MAX_FILE_SIZE = 10 * 1024 * 1024

const fileSizeText = computed(() => {
  if (!selectedFile.value) return ''

  const size = selectedFile.value.size
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(2)} MB`
})

const failedSamples = computed(() => importResult.value?.failedSamples || [])

const fileAccept = computed(() =>
  selectedPlatform.value === 'wechat' ? '.xlsx,.csv,text/csv' : '.csv,text/csv',
)

const uploadTitle = computed(() =>
  selectedPlatform.value === 'wechat' ? '点击选择账单文件' : '点击选择 CSV 文件',
)

const uploadHint = computed(() =>
  selectedPlatform.value === 'wechat'
    ? '支持微信 XLSX 或 CSV，文件不超过 10MB'
    : '仅支持支付宝 CSV，文件不超过 10MB',
)

function selectPlatform(platform) {
  selectedPlatform.value = platform
  selectedFile.value = null
  importResult.value = null
  failedPanelOpen.value = false
  clearFileInput()
}

function openFilePicker() {
  if (!selectedPlatform.value || importing.value) return
  fileInput.value?.click()
}

function clearFileInput() {
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

function validateFile(file) {
  const filename = file.name.toLowerCase()
  const acceptsWechatFile = filename.endsWith('.xlsx') || filename.endsWith('.csv')

  if (selectedPlatform.value === 'wechat' && !acceptsWechatFile) {
    showToast('请上传 XLSX 或 CSV 文件')
    return false
  }

  if (selectedPlatform.value === 'alipay' && !filename.endsWith('.csv')) {
    showToast('请上传 CSV 文件')
    return false
  }

  if (file.size > MAX_FILE_SIZE) {
    showToast('文件不能超过 10MB')
    return false
  }

  return true
}

function onFileChange(event) {
  const file = event.target.files?.[0]
  clearFileInput()

  if (!file || !validateFile(file)) return

  selectedFile.value = file
  importResult.value = null
  failedPanelOpen.value = false
}

function extractErrorMessage(error) {
  const data = error.response?.data
  if (typeof data === 'string' && data.trim()) return data
  if (data?.message) return data.message
  if (data?.error) return data.error
  return '导入失败，请稍后重试'
}

function formatFailedSample(sample) {
  if (typeof sample === 'string') return sample

  const rowText = sample?.row ? `第 ${sample.row} 行: ` : ''
  return `${rowText}${sample?.reason || '导入失败'}`
}

async function startImport() {
  if (!selectedFile.value || importing.value) return

  importing.value = true
  try {
    const importFile = selectedPlatform.value === 'wechat' ? importWechat : importAlipay
    importResult.value = await importFile(selectedFile.value)
    showToast({ message: '导入完成', icon: 'success' })
  } catch (error) {
    showToast(extractErrorMessage(error))
  } finally {
    importing.value = false
  }
}

function resetImport() {
  selectedFile.value = null
  importResult.value = null
  failedPanelOpen.value = false
  clearFileInput()
}

function viewTransactions() {
  router.push({ name: 'detail' })
}
</script>

<template>
  <div class="page">
    <header class="nav-bar">
      <button class="nav-back" type="button" aria-label="返回" @click="router.back()">
        <van-icon name="arrow-left" size="22" />
      </button>
      <h1>导入账单</h1>
      <span class="nav-spacer"></span>
    </header>

    <section class="platform-section">
      <p class="section-label">选择平台</p>
      <button
        class="platform-card alipay"
        :class="{ active: selectedPlatform === 'alipay' }"
        type="button"
        @click="selectPlatform('alipay')"
      >
        <span class="platform-icon">支</span>
        <span class="platform-copy">
          <strong>支付宝账单</strong>
          <small>导出方式: 支付宝 App → 我的 → 账单 → 开具流水</small>
        </span>
        <van-icon name="checked" class="checked-icon" size="20" />
      </button>

      <button
        class="platform-card wechat"
        :class="{ active: selectedPlatform === 'wechat' }"
        type="button"
        @click="selectPlatform('wechat')"
      >
        <span class="platform-icon">微</span>
        <span class="platform-copy">
          <strong>微信账单</strong>
          <small>导出方式: 微信 → 我 → 服务 → 钱包 → 账单 → 常见问题 → 下载账单</small>
        </span>
        <van-icon name="checked" class="checked-icon" size="20" />
      </button>
    </section>

    <section v-if="selectedPlatform && !importResult" class="upload-card">
      <div class="upload-zone" role="button" tabindex="0" @click="openFilePicker" @keyup.enter="openFilePicker">
        <span class="upload-icon">
          <van-icon name="upgrade" size="28" />
        </span>
        <strong>{{ uploadTitle }}</strong>
        <small>{{ uploadHint }}</small>
      </div>

      <input ref="fileInput" type="file" :accept="fileAccept" class="hidden-input" @change="onFileChange" />

      <div v-if="selectedFile" class="file-row">
        <div class="file-copy">
          <van-icon name="description" size="22" />
          <div>
            <p>{{ selectedFile.name }}</p>
            <span>{{ fileSizeText }}</span>
          </div>
        </div>
        <button class="reselect-btn" type="button" @click="openFilePicker">重新选</button>
      </div>

      <van-button
        v-if="selectedFile"
        block
        class="import-btn"
        :loading="importing"
        loading-text="正在导入..."
        @click="startImport"
      >
        导入
      </van-button>

      <div v-if="importing" class="loading-mask">
        <van-loading color="#6e73f2" size="28px">正在导入...</van-loading>
      </div>
    </section>

    <section v-if="importResult" class="result-card">
      <div class="result-mark">
        <van-icon name="success" size="22" />
      </div>
      <p class="result-title">导入完成</p>
      <strong class="result-total">成功导入 {{ importResult.imported || 0 }} 笔</strong>

      <div class="result-metrics">
        <div>
          <strong>{{ importResult.skippedFailedStatus || 0 }}</strong>
          <span>跳过(状态失败)</span>
        </div>
        <div>
          <strong>{{ importResult.skippedDuplicate || 0 }}</strong>
          <span>跳过(重复)</span>
        </div>
        <div>
          <strong>{{ importResult.skippedNotExpense || 0 }}</strong>
          <span>跳过(收入)</span>
        </div>
        <div>
          <strong>{{ importResult.failed || 0 }}</strong>
          <span>失败</span>
        </div>
      </div>

      <div v-if="failedSamples.length" class="failed-panel">
        <button class="failed-toggle" type="button" @click="failedPanelOpen = !failedPanelOpen">
          <span>失败详情</span>
          <van-icon :name="failedPanelOpen ? 'arrow-up' : 'arrow-down'" />
        </button>
        <div v-show="failedPanelOpen" class="failed-list">
          <p v-for="(sample, index) in failedSamples" :key="`${sample.row || sample}-${index}`">
            {{ formatFailedSample(sample) }}
          </p>
        </div>
      </div>

      <div class="result-actions">
        <van-button class="detail-btn" @click="viewTransactions">查看明细</van-button>
        <van-button class="again-btn" @click="resetImport">再次导入</van-button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page {
  min-height: -webkit-fill-available;
  min-height: 100dvh;
  padding: 0 16px 32px;
  background: #f3f4f8;
  color: #1f2338;
}

.nav-bar {
  display: grid;
  grid-template-columns: 32px 1fr 32px;
  align-items: center;
  min-height: 68px;
  padding-top: 10px;
}

.nav-bar h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0;
  text-align: center;
}

.nav-back {
  display: grid;
  width: 32px;
  height: 32px;
  padding: 0;
  color: inherit;
  border: 0;
  border-radius: 10px;
  background: transparent;
  place-items: center;
}

.nav-spacer {
  width: 32px;
}

.section-label {
  margin: 2px 2px 10px;
  color: #8d93ab;
  font-size: 13px;
}

.platform-section {
  display: grid;
  gap: 12px;
}

.platform-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 88px;
  padding: 16px;
  color: inherit;
  text-align: left;
  border: 1px solid transparent;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 4px 18px rgba(41, 46, 74, 0.06);
}

button.platform-card {
  cursor: pointer;
}

.platform-card.active {
  border-color: rgba(110, 115, 242, 0.42);
  box-shadow: 0 10px 24px rgba(110, 115, 242, 0.16);
}

.platform-icon {
  display: grid;
  width: 48px;
  height: 48px;
  flex: 0 0 48px;
  border-radius: 10px;
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  place-items: center;
}

.alipay .platform-icon {
  background: #1677ff;
}

.wechat .platform-icon {
  background: #07c160;
}

.platform-copy {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.platform-copy strong {
  font-size: 16px;
  font-weight: 650;
}

.platform-copy small {
  color: #7d849d;
  font-size: 12px;
  line-height: 18px;
}

.checked-icon {
  position: absolute;
  top: 16px;
  right: 16px;
  color: #6e73f2;
  opacity: 0;
}

.active .checked-icon {
  opacity: 1;
}

.upload-card,
.result-card {
  position: relative;
  margin-top: 16px;
  padding: 16px;
  overflow: hidden;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 4px 18px rgba(41, 46, 74, 0.06);
}

.upload-zone {
  display: grid;
  min-height: 204px;
  padding: 24px 18px;
  align-content: center;
  justify-items: center;
  gap: 10px;
  border: 2px dashed rgba(110, 115, 242, 0.36);
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(110, 115, 242, 0.07), rgba(110, 115, 242, 0.02));
  cursor: pointer;
  text-align: center;
}

.upload-zone strong {
  font-size: 16px;
  font-weight: 650;
}

.upload-zone small {
  color: #8d93ab;
  font-size: 13px;
}

.upload-icon {
  display: grid;
  width: 58px;
  height: 58px;
  border-radius: 16px;
  color: #6e73f2;
  background: #eef0fe;
  place-items: center;
}

.hidden-input {
  display: none;
}

.file-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  padding: 12px;
  border-radius: 10px;
  background: #f5f6fc;
}

.file-copy {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  color: #6e73f2;
}

.file-copy div {
  min-width: 0;
}

.file-copy p {
  overflow: hidden;
  margin: 0 0 3px;
  color: #252a40;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-copy span {
  color: #8d93ab;
  font-size: 12px;
}

.reselect-btn {
  flex: 0 0 auto;
  padding: 8px 10px;
  color: #6e73f2;
  border: 0;
  border-radius: 10px;
  background: #eef0fe;
  font-size: 13px;
  font-weight: 600;
}

.import-btn {
  height: 48px;
  margin-top: 14px;
  color: #fff;
  border: 0;
  border-radius: 16px;
  background: #6e73f2;
  font-size: 16px;
  font-weight: 650;
}

.loading-mask {
  position: absolute;
  inset: 0;
  display: grid;
  background: rgba(255, 255, 255, 0.9);
  place-items: center;
}

.result-card {
  text-align: center;
}

.result-mark {
  display: grid;
  width: 48px;
  height: 48px;
  margin: 4px auto 10px;
  color: #fff;
  border-radius: 50%;
  background: #6e73f2;
  place-items: center;
}

.result-title {
  margin: 0 0 6px;
  color: #7d849d;
  font-size: 14px;
}

.result-total {
  display: block;
  margin-bottom: 16px;
  color: #1f2338;
  font-size: 28px;
  letter-spacing: 0;
}

.result-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  padding: 12px 4px;
  border-radius: 16px;
  background: #f5f6fc;
}

.result-metrics div {
  display: grid;
  gap: 5px;
  align-content: start;
}

.result-metrics strong {
  font-size: 18px;
}

.result-metrics span {
  color: #7d849d;
  font-size: 11px;
  line-height: 15px;
}

.failed-panel {
  margin-top: 14px;
  border: 1px solid #eef0fe;
  border-radius: 16px;
  text-align: left;
}

.failed-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 14px;
  color: #3a4160;
  border: 0;
  border-radius: 16px;
  background: #fff;
  font-size: 14px;
  font-weight: 600;
}

.failed-list {
  display: grid;
  gap: 8px;
  padding: 0 14px 14px;
}

.failed-list p {
  margin: 0;
  padding: 10px;
  border-radius: 10px;
  color: #b42318;
  background: #fef2f2;
  font-size: 12px;
  line-height: 18px;
  word-break: break-word;
}

.result-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.result-actions :deep(.van-button) {
  height: 46px;
  border-radius: 16px;
  font-size: 15px;
  font-weight: 650;
}

.detail-btn {
  color: #fff;
  border: 0;
  background: #6e73f2;
}

.again-btn {
  color: #6e73f2;
  border-color: rgba(110, 115, 242, 0.28);
  background: #eef0fe;
}

@media (max-width: 360px) {
  .result-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
