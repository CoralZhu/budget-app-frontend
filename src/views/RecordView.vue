<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import { useTransactionsStore } from '@/stores/transactions'
import { useCategoriesStore } from '@/stores/categories'
import { createTransaction } from '@/api/transaction'

const router = useRouter()
const txStore = useTransactionsStore()
const catStore = useCategoriesStore()

// --- Shared state ---
const mode = ref('manual') // 'manual' | 'photo' | 'voice'
const txType = ref('expense') // 'expense' | 'income'

// --- Manual mode state ---
const amountStr = ref('0')
const selectedCategoryId = ref(1)
const spentAt = ref(toLocalDateTimeString(new Date()))
const showDateTimePicker = ref(false)
const datePickerValue = ref(getDatePickerValue(new Date()))
const timePickerValue = ref(getTimePickerValue(new Date()))
const minDate = new Date(2020, 0, 1)
const maxDate = new Date(2035, 11, 31)
const merchant = ref('')
const note = ref('')
const manualSaving = ref(false)
const initialSpentAt = spentAt.value

function pad(value) {
  return String(value).padStart(2, '0')
}

function toLocalDateTimeString(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
}

function getDatePickerValue(date) {
  return [String(date.getFullYear()), pad(date.getMonth() + 1), pad(date.getDate())]
}

function getTimePickerValue(date) {
  return [pad(date.getHours()), pad(date.getMinutes())]
}

function openDateTimePicker() {
  const date = new Date(spentAt.value)
  datePickerValue.value = getDatePickerValue(date)
  timePickerValue.value = getTimePickerValue(date)
  showDateTimePicker.value = true
}

function confirmDateTime() {
  const [year, month, day] = datePickerValue.value.map(Number)
  const [hour, minute] = timePickerValue.value.map(Number)
  spentAt.value = toLocalDateTimeString(new Date(year, month - 1, day, hour, minute, 0))
  showDateTimePicker.value = false
}

function hasUnsavedContent() {
  const hasManualContent =
    amountStr.value !== '0' ||
    txType.value !== 'expense' ||
    selectedCategoryId.value !== 1 ||
    merchant.value.trim() ||
    note.value.trim() ||
    spentAt.value !== initialSpentAt

  const hasPhotoContent = photoState.value !== 'idle' || !!photoResult.value
  const hasVoiceContent =
    voiceState.value !== 'idle' || !!voiceText.value || !!voiceResult.value || voiceSeconds.value > 0

  return Boolean(hasManualContent || hasPhotoContent || hasVoiceContent)
}

function goBack() {
  if (window.history.state?.back) {
    router.back()
  } else {
    router.replace({ name: 'home' })
  }
}

async function handleBack() {
  if (manualSaving.value) return

  if (hasUnsavedContent()) {
    try {
      await showConfirmDialog({
        title: '确认离开?',
        message: '未保存的内容会丢失,确认离开?',
        confirmButtonText: '离开',
        cancelButtonText: '继续编辑',
      })
    } catch {
      return
    }
  }

  goBack()
}

function formatDisplayDate(value) {
  const d = new Date(value)
  const now = new Date()
  const dateText =
    d.toDateString() === now.toDateString()
      ? `今天 ${d.getMonth() + 1}月${d.getDate()}日`
      : `${d.getMonth() + 1}月${d.getDate()}日`
  return `${dateText} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const expenseCategories = computed(() =>
  catStore.categories.filter((c) => c.type === 'expense').slice(0, 8),
)
const incomeCategories = computed(() =>
  catStore.categories.filter((c) => c.type === 'income'),
)
const displayCategories = computed(() =>
  txType.value === 'expense' ? expenseCategories.value : incomeCategories.value,
)

async function saveManual() {
  if (manualSaving.value) return

  const amount = parseFloat(amountStr.value)
  if (!amount || amount <= 0) {
    showToast('请输入金额')
    return
  }

  const cat = catStore.getCategoryById(selectedCategoryId.value)
  const payload = {
    type: txType.value,
    amount,
    category: cat?.name || '其他',
    merchant: merchant.value,
    note: note.value,
    spentAt: spentAt.value,
    inputMethod: 'manual',
  }

  manualSaving.value = true
  try {
    const { data } = await createTransaction(payload)

    txStore.addTransaction({
      id: data.id,
      categoryId: selectedCategoryId.value,
      categoryName: data.category,
      amount: Number(data.amount),
      type: data.type,
      merchant: data.merchant || '',
      note: data.note || '',
      spentAt: new Date(data.spentAt),
      inputMethod: data.inputMethod,
      aiConfidence: null,
    })

    showToast({ message: '记账成功', icon: 'success' })
    router.replace({ name: 'home' })
  } catch (error) {
    showToast(error.response?.data?.message || '保存失败，请稍后重试')
  } finally {
    manualSaving.value = false
  }
}

// --- Photo mode state ---
const photoState = ref('idle') // 'idle' | 'capturing' | 'recognizing' | 'done'
const photoResult = ref(null)
const fileInput = ref(null)

function triggerCapture() {
  photoState.value = 'recognizing'
  setTimeout(() => {
    photoResult.value = {
      merchant: '星巴克',
      amount: '37.00',
      category: '饮品',
      time: '今天 08:20',
    }
    photoState.value = 'done'
  }, 2000)
}

function openGallery() {
  fileInput.value?.click()
}

function retryPhoto() {
  photoState.value = 'idle'
  photoResult.value = null
}

function savePhoto() {
  if (!photoResult.value) return
  txStore.addTransaction({
    categoryId: 2,
    categoryName: photoResult.value.category,
    amount: parseFloat(photoResult.value.amount),
    type: 'expense',
    merchant: photoResult.value.merchant,
    note: '',
    spentAt: new Date(),
    inputMethod: 'photo',
    aiConfidence: 0.96,
  })
  showToast({ message: '保存成功', icon: 'success' })
  router.replace({ name: 'home' })
}

// --- Voice mode state ---
const voiceState = ref('idle') // 'idle' | 'recording' | 'done'
const voiceSeconds = ref(0)
const voiceText = ref('')
const voiceResult = ref(null)
let voiceTimer = null

function startRecording() {
  voiceState.value = 'recording'
  voiceSeconds.value = 0
  voiceTimer = setInterval(() => {
    voiceSeconds.value++
    if (voiceSeconds.value === 3) {
      voiceText.value = '"今天中午在瑞幸花了23买了两杯咖啡，然后去..."'
    }
    if (voiceSeconds.value >= 5) {
      stopRecording()
    }
  }, 1000)
}

function stopRecording() {
  clearInterval(voiceTimer)
  voiceState.value = 'done'
  voiceResult.value = { amount: '23.00', category: '饮品', categoryId: 2 }
}

function saveVoice() {
  if (!voiceResult.value) return
  txStore.addTransaction({
    categoryId: voiceResult.value.categoryId,
    categoryName: voiceResult.value.category,
    amount: parseFloat(voiceResult.value.amount),
    type: 'expense',
    merchant: '瑞幸咖啡',
    note: '',
    spentAt: new Date(),
    inputMethod: 'voice',
    aiConfidence: 0.88,
  })
  showToast({ message: '保存成功', icon: 'success' })
  router.replace({ name: 'home' })
}

function formatVoiceTime(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

onUnmounted(() => clearInterval(voiceTimer))
</script>

<template>
  <div class="page">
    <!-- ========== MANUAL MODE ========== -->
    <template v-if="mode === 'manual'">
      <div class="nav-bar">
        <button class="nav-icon-btn" @click="handleBack">
          <van-icon name="arrow-left" size="22" />
        </button>
        <span class="nav-title">记一笔 ✏️</span>
        <span
          :class="['nav-action', { disabled: manualSaving }]"
          @click="saveManual"
        >
          {{ manualSaving ? '保存中...' : '保存' }}
        </span>
      </div>

      <div class="card">
        <div class="type-toggle">
          <button :class="['type-btn', { active: txType === 'expense' }]" @click="txType = 'expense'">
            支出
          </button>
          <button :class="['type-btn income', { active: txType === 'income' }]" @click="txType = 'income'">
            收入
          </button>
        </div>
        <p class="amount-label">金额</p>
        <div class="amount-row">
          <span class="currency">¥</span>
          <input
            v-model="amountStr"
            type="text"
            class="amount-input"
            placeholder="0.00"
            inputmode="decimal"
          />
        </div>
      </div>

      <div class="card">
        <p class="field-label">选择分类</p>
        <div class="cat-grid">
          <div
            v-for="cat in displayCategories"
            :key="cat.id"
            :class="['cat-item', { selected: selectedCategoryId === cat.id }]"
            @click="selectedCategoryId = cat.id"
          >
            <div class="cat-icon" :style="{ background: cat.bg }">{{ cat.icon }}</div>
            <span class="cat-name" :class="{ 'active-text': selectedCategoryId === cat.id }">
              {{ cat.name }}
            </span>
          </div>
          <div class="cat-item">
            <div class="cat-icon" style="background: #f3f4f6">···</div>
            <span class="cat-name">更多</span>
          </div>
        </div>
      </div>

      <div class="card info-card">
        <van-field
          :model-value="formatDisplayDate(spentAt)"
          label="日期时间"
          :border="false"
          class="info-field"
          readonly
          is-link
          @click="openDateTimePicker"
        />
        <van-field
          v-model="merchant"
          placeholder="商家（选填）"
          :border="false"
          class="info-field"
          clearable
        />
        <van-field
          v-model="note"
          placeholder="添加备注（选填）"
          :border="false"
          class="info-field"
          clearable
        />
      </div>

      <van-popup
        v-model:show="showDateTimePicker"
        round
        position="bottom"
        class="date-time-popup"
        overlay-class="date-time-overlay"
      >
        <van-picker-group
          title="选择日期时间"
          :tabs="['日期', '时间']"
          @confirm="confirmDateTime"
          @cancel="showDateTimePicker = false"
        >
          <van-date-picker
            v-model="datePickerValue"
            :min-date="minDate"
            :max-date="maxDate"
          />
          <van-time-picker
            v-model="timePickerValue"
            :columns-type="['hour', 'minute']"
          />
        </van-picker-group>
      </van-popup>
    </template>

    <!-- ========== PHOTO MODE ========== -->
    <template v-else-if="mode === 'photo'">
      <div class="nav-bar">
        <button class="nav-icon-btn" @click="handleBack">
          <van-icon name="arrow-left" size="22" />
        </button>
        <span class="nav-title">拍小票自动记账</span>
        <span class="nav-placeholder"></span>
      </div>

      <div class="viewfinder">
        <div v-if="photoState === 'idle'" class="vf-idle">
          <div class="vf-icon">📸</div>
          <p class="vf-hint">点击拍照识别小票</p>
        </div>

        <template v-else>
          <div v-if="photoState === 'recognizing' || photoState === 'done'" class="vf-receipt">
            <div class="ai-pill">
              <span class="ai-dot"></span>
              {{ photoState === 'recognizing' ? 'AI 识别中...' : 'AI 识别完成' }}
            </div>
            <div class="receipt-mock">
              <p class="r-title">星巴克咖啡</p>
              <p class="r-sub">国贸店 No.2358</p>
              <div class="r-divider"></div>
              <div class="r-row"><span>拿铁 大杯</span><span>¥37.00</span></div>
              <div class="r-row"><span>糖浆 ×1</span><span>¥0.00</span></div>
              <div class="r-divider"></div>
              <div class="r-row bold"><span>合计</span><span>¥37.00</span></div>
              <p class="r-date">2026-05-09 08:20</p>
            </div>
            <div v-if="photoState === 'recognizing'" class="scan-line"></div>
          </div>
        </template>
        <div class="vf-corners">
          <span class="corner tl"></span>
          <span class="corner tr"></span>
          <span class="corner bl"></span>
          <span class="corner br"></span>
        </div>
      </div>

      <div v-if="photoResult" class="ai-result-card">
        <div class="ar-header">
          <span class="ar-title">AI 识别结果</span>
          <van-button size="small" round class="done-btn" @click="savePhoto">完成</van-button>
        </div>
        <div class="ar-grid">
          <div class="ar-field">
            <p class="ar-label">商家</p>
            <p class="ar-value">{{ photoResult.merchant }}</p>
          </div>
          <div class="ar-field">
            <p class="ar-label">金额</p>
            <div class="ar-value-row">
              <span class="ar-value">¥{{ photoResult.amount }}</span>
              <van-icon name="edit" size="16" color="rgba(255,255,255,0.7)" />
            </div>
          </div>
          <div class="ar-field">
            <p class="ar-label">分类</p>
            <div class="ar-value-row">
              <span class="ar-value">☕ {{ photoResult.category }}</span>
              <van-icon name="edit" size="16" color="rgba(255,255,255,0.7)" />
            </div>
          </div>
          <div class="ar-field">
            <p class="ar-label">时间</p>
            <div class="ar-value-row">
              <span class="ar-value">{{ photoResult.time }}</span>
              <van-icon name="edit" size="16" color="rgba(255,255,255,0.7)" />
            </div>
          </div>
        </div>
      </div>

      <div class="photo-actions">
        <button class="photo-act-btn" @click="openGallery">
          <van-icon name="photo-o" size="24" color="#6b7280" />
        </button>
        <button class="photo-shoot-btn" @click="triggerCapture">
          <div class="shoot-inner"></div>
        </button>
        <button class="photo-act-btn" @click="retryPhoto">
          <van-icon name="replay" size="24" color="#6b7280" />
        </button>
      </div>

      <input ref="fileInput" type="file" accept="image/*" class="hidden-input" />
    </template>

    <!-- ========== VOICE MODE ========== -->
    <template v-else>
      <div class="nav-bar">
        <button class="nav-icon-btn" @click="handleBack">
          <van-icon name="arrow-left" size="22" />
        </button>
        <span class="nav-title">语音记账</span>
        <span v-if="voiceResult" class="nav-action" @click="saveVoice">保存</span>
        <span v-else class="nav-placeholder"></span>
      </div>

      <div class="card voice-card">
        <div class="rec-indicator">
          <span v-if="voiceState === 'recording'" class="rec-dot"></span>
          <span v-if="voiceState === 'recording'" class="rec-text">录音中 {{ formatVoiceTime(voiceSeconds) }}</span>
          <span v-else-if="voiceState === 'done'" class="rec-done">识别完成</span>
          <span v-else class="rec-hint">点击开始录音</span>
        </div>
        <div class="waveform">
          <div
            v-for="i in 14"
            :key="i"
            class="wave-bar"
            :class="{ active: voiceState === 'recording' }"
            :style="{ animationDelay: `${(i * 0.06).toFixed(2)}s` }"
          ></div>
        </div>
        <div v-if="voiceText" class="voice-text-box">
          <p class="vt-label">听到的是</p>
          <p class="vt-content">{{ voiceText }}</p>
        </div>
      </div>

      <template v-if="voiceResult">
        <div class="card">
          <p class="ai-extracted-title">AI 帮你提取了这些信息</p>
          <div class="extracted-amount">
            <p class="ea-label">金额</p>
            <p class="ea-value">¥ {{ voiceResult.amount }}</p>
          </div>
          <div class="extracted-cat">
            <p class="ea-label">分类</p>
            <div class="ea-cat-row">
              <div class="ea-cat-icon" style="background: #ede9fe">☕</div>
              <span class="ea-cat-name">{{ voiceResult.category }}</span>
              <span class="link-btn">更改</span>
            </div>
          </div>
        </div>
      </template>

      <div class="voice-ctrl">
        <van-button
          v-if="voiceState === 'idle'"
          type="primary"
          round
          class="rec-btn"
          @click="startRecording"
        >
          开始录音
        </van-button>
        <van-button
          v-else-if="voiceState === 'recording'"
          round
          class="rec-btn stop"
          @click="stopRecording"
        >
          结束录音
        </van-button>
        <van-button
          v-else
          round
          class="rec-btn retry"
          @click="voiceState = 'idle'; voiceText = ''; voiceResult = null; voiceSeconds = 0"
        >
          重新录音
        </van-button>
      </div>
    </template>

    <!-- ========== BOTTOM MODE BAR ========== -->
    <div class="mode-bar">
      <button :class="['mode-item', { active: mode === 'manual' }]" @click="mode = 'manual'">
        <van-icon name="records-o" size="22" />
        <span>手动</span>
      </button>
      <button :class="['mode-item', { active: mode === 'photo' }]" @click="mode = 'photo'">
        <van-icon name="photograph" size="22" />
        <span>拍照</span>
      </button>
      <button :class="['mode-item', { active: mode === 'voice' }]" @click="mode = 'voice'">
        <van-icon name="volume-o" size="22" />
        <span>语音</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f3f4f8;
  padding: 0 16px;
  padding-bottom: 80px;
  display: flex;
  flex-direction: column;
}

.nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 4px 16px;
}

.nav-bar.centered {
  justify-content: center;
}

.nav-icon-btn,
.nav-placeholder {
  width: 48px;
  height: 32px;
  flex-shrink: 0;
}

.nav-icon-btn {
  border: none;
  background: transparent;
  color: #1a1a2e;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  cursor: pointer;
  padding: 0;
}

.nav-title {
  font-size: 20px;
  font-weight: 700;
}

.nav-action {
  font-size: 16px;
  color: #6b6ef5;
  font-weight: 500;
  cursor: pointer;
}

.nav-action.disabled {
  color: #9ca3af;
  cursor: not-allowed;
  pointer-events: none;
}

.card {
  background: white;
  border-radius: 20px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

/* Type toggle */
.type-toggle {
  display: flex;
  background: #f5f6fa;
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 20px;
}

.type-btn {
  flex: 1;
  height: 38px;
  border: none;
  border-radius: 9px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  background: transparent;
  color: #6b7280;
  transition: all 0.2s;
}

.type-btn.active {
  background: #ffe4e4;
  color: #ef4444;
}

.type-btn.income.active {
  background: #d1fae5;
  color: #059669;
}

/* Amount */
.amount-label {
  font-size: 14px;
  color: #9ca3af;
  margin-bottom: 8px;
}

.amount-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.currency {
  font-size: 28px;
  color: #9ca3af;
  font-weight: 300;
}

.amount-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 40px;
  font-weight: 700;
  color: #1a1a2e;
  background: transparent;
  caret-color: #6b6ef5;
  min-width: 0;
}

/* Category grid */
.field-label {
  font-size: 14px;
  color: #9ca3af;
  margin-bottom: 12px;
}

.cat-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px 8px;
}

.cat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.cat-icon {
  width: 48px;
  height: 48px;
  border-radius: 15px;
  font-size: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s;
}

.cat-item.selected .cat-icon {
  transform: scale(1.08);
  box-shadow: 0 4px 12px rgba(107, 110, 245, 0.25);
}

.cat-name {
  font-size: 12px;
  color: #6b7280;
  text-align: center;
}

.cat-name.active-text {
  color: #6b6ef5;
  font-weight: 500;
}

/* Info fields */
.info-card {
  padding: 0;
  overflow: hidden;
}

.info-field {
  padding: 14px 16px;
  border-bottom: 1px solid #f5f6fa;
}

.info-field:last-child {
  border-bottom: none;
}

:deep(.date-time-popup),
:deep(.date-time-overlay) {
  left: max(0px, calc((100vw - 480px) / 2));
  width: min(100vw, 480px);
}

/* Photo viewfinder */
.viewfinder {
  flex: 1;
  background: #d0d0d8;
  border-radius: 20px;
  margin-bottom: 12px;
  min-height: 280px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.vf-idle {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.vf-icon {
  font-size: 48px;
}

.vf-hint {
  font-size: 15px;
  color: #6b7280;
}

.ai-pill {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: #6b6ef5;
  color: white;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
  z-index: 2;
}

.ai-dot {
  width: 8px;
  height: 8px;
  background: white;
  border-radius: 50%;
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1 }
  50% { opacity: 0.3 }
}

.receipt-mock {
  background: white;
  border-radius: 12px;
  padding: 16px 20px;
  width: calc(100% - 48px);
  position: relative;
  z-index: 1;
}

.r-title {
  font-size: 16px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 4px;
}

.r-sub {
  font-size: 12px;
  color: #9ca3af;
  text-align: center;
  margin-bottom: 12px;
}

.r-divider {
  height: 1px;
  background: #e5e7eb;
  margin: 8px 0;
}

.r-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin: 6px 0;
}

.r-row.bold {
  font-weight: 700;
  font-size: 15px;
}

.r-date {
  font-size: 11px;
  color: #9ca3af;
  text-align: center;
  margin-top: 8px;
}

.scan-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, #6b6ef5, transparent);
  animation: scan 1.5s linear infinite;
  z-index: 3;
}

@keyframes scan {
  0% { top: 20% }
  100% { top: 80% }
}

.vf-corners {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.corner {
  position: absolute;
  width: 20px;
  height: 20px;
  border-color: white;
  border-style: solid;
}

.corner.tl { top: 12px; left: 12px; border-width: 3px 0 0 3px; border-radius: 2px 0 0 0 }
.corner.tr { top: 12px; right: 12px; border-width: 3px 3px 0 0; border-radius: 0 2px 0 0 }
.corner.bl { bottom: 12px; left: 12px; border-width: 0 0 3px 3px; border-radius: 0 0 0 2px }
.corner.br { bottom: 12px; right: 12px; border-width: 0 3px 3px 0; border-radius: 0 0 2px 0 }

.ai-result-card {
  background: #6b6ef5;
  border-radius: 20px;
  padding: 16px;
  margin-bottom: 12px;
  color: white;
}

.ar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.ar-title {
  font-size: 16px;
  font-weight: 600;
}

/* 完成 button on purple card: white semi-transparent */
.done-btn {
  background: rgba(255, 255, 255, 0.22) !important;
  border-color: rgba(255, 255, 255, 0.55) !important;
  color: white !important;
  font-weight: 600;
}

.ar-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.ar-field {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 10px 12px;
}

.ar-label {
  font-size: 12px;
  opacity: 0.7;
  margin-bottom: 6px;
}

.ar-value {
  font-size: 16px;
  font-weight: 600;
}

.ar-value-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Photo action buttons */
.photo-actions {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 12px 0;
}

.photo-act-btn {
  width: 48px;
  height: 48px;
  background: #e8e9fd;
  border: none;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.photo-shoot-btn {
  width: 64px;
  height: 64px;
  background: #6b6ef5;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(107, 110, 245, 0.5);
}

.shoot-inner {
  width: 48px;
  height: 48px;
  background: white;
  border-radius: 50%;
}

.hidden-input {
  display: none;
}

/* Voice mode */
.voice-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rec-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 500;
  color: #6b6ef5;
}

.rec-dot {
  width: 10px;
  height: 10px;
  background: #ef4444;
  border-radius: 50%;
  animation: blink 1s infinite;
}

.rec-text {
  color: #6b6ef5;
}

.rec-done {
  color: #10b981;
}

.rec-hint {
  color: #9ca3af;
}

.waveform {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 48px;
}

.wave-bar {
  width: 4px;
  height: 8px;
  border-radius: 2px;
  background: #d1d5db;
  transition: height 0.1s;
}

.wave-bar.active {
  background: #6b6ef5;
  animation: wave 0.7s ease-in-out infinite alternate;
}

.wave-bar:nth-child(odd).active { animation-delay: 0.1s }
.wave-bar:nth-child(3n).active { animation-delay: 0.2s }

@keyframes wave {
  0% { height: 8px }
  100% { height: 40px }
}

.voice-text-box {
  background: #f5f6fa;
  border-radius: 12px;
  padding: 12px;
}

.vt-label {
  font-size: 12px;
  color: #9ca3af;
  margin-bottom: 6px;
}

.vt-content {
  font-size: 14px;
  color: #374151;
  line-height: 1.6;
}

.ai-extracted-title {
  font-size: 14px;
  color: #6b6ef5;
  font-weight: 500;
  margin-bottom: 14px;
}

.extracted-amount {
  margin-bottom: 16px;
}

.extracted-cat {}

.ea-label {
  font-size: 13px;
  color: #9ca3af;
  margin-bottom: 6px;
}

.ea-value {
  font-size: 32px;
  font-weight: 700;
}

.ea-cat-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ea-cat-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ea-cat-name {
  font-size: 16px;
  font-weight: 500;
  flex: 1;
}

.link-btn {
  font-size: 14px;
  color: #6b6ef5;
  cursor: pointer;
}

.voice-ctrl {
  display: flex;
  justify-content: center;
  padding: 16px 0;
}

.rec-btn {
  width: 180px;
  height: 52px;
  font-size: 17px;
  font-weight: 600;
  background: #6b6ef5 !important;
  border-color: #6b6ef5 !important;
  color: white !important;
}

.rec-btn.stop {
  background: #6b6ef5 !important;
  border-color: #6b6ef5 !important;
}

.rec-btn.retry {
  background: #6b6ef5 !important;
  border-color: #6b6ef5 !important;
  color: white !important;
}

/* Bottom mode bar — uses transform centering to stay within max-width */
.mode-bar {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  background: white;
  border-top: 1px solid #f0f0f5;
  display: flex;
  align-items: center;
  height: 64px;
  padding-bottom: env(safe-area-inset-bottom);
}

.mode-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 11px;
  cursor: pointer;
  transition: color 0.2s;
}

.mode-item.active {
  color: #6b6ef5;
}
</style>
