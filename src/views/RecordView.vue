<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import { useTransactionsStore } from '@/stores/transactions'
import { useCategoriesStore } from '@/stores/categories'
import { parseVoice } from '@/api/ai'
import { recognizeReceipt } from '@/api/ocr'
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
const showCreateCategory = ref(false)
const newCategoryName = ref('')
const newCategoryIcon = ref('')
const showAllCategories = ref(false)

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

function formatReceiptDate(date) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''

  const now = new Date()
  const timeText = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (d.toDateString() === now.toDateString()) {
    return `今天 ${timeText}`
  }

  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${timeText}`
}

const expenseCategories = computed(() =>
  catStore.categories.filter((c) => c.type === 'expense'),
)
const incomeCategories = computed(() =>
  catStore.categories.filter((c) => c.type === 'income'),
)
const displayCategories = computed(() =>
  txType.value === 'expense' ? expenseCategories.value : incomeCategories.value,
)
const visibleCategories = computed(() =>
  showAllCategories.value ? displayCategories.value : displayCategories.value.slice(0, 8),
)
const hasMoreCategories = computed(() => displayCategories.value.length > 8)

async function loadCategories() {
  try {
    await catStore.fetchCategories(txType.value)
    const first = displayCategories.value[0]
    if (first && !displayCategories.value.some((cat) => cat.id === selectedCategoryId.value)) {
      selectedCategoryId.value = first.id
    }
  } catch (error) {
    showToast(error.response?.data?.message || '获取分类失败')
  }
}

watch(txType, () => {
  showAllCategories.value = false
  loadCategories()
  const first = displayCategories.value[0]
  if (first && !displayCategories.value.some((cat) => cat.id === selectedCategoryId.value)) {
    selectedCategoryId.value = first.id
  }
})

function openCreateCategory() {
  newCategoryName.value = ''
  newCategoryIcon.value = ''
  showCreateCategory.value = true
}

function createCategory() {
  const name = newCategoryName.value.trim()
  if (!name) {
    showToast('请输入分类名称')
    return
  }

  const exists = catStore.categories.some(
    (cat) => cat.type === txType.value && cat.name === name,
  )
  if (exists) {
    showToast('这个分类已存在')
    return
  }

  const created = catStore.addCategory({
    name,
    icon: newCategoryIcon.value.trim() || (txType.value === 'income' ? '💰' : '📌'),
    bg: txType.value === 'income' ? '#d1fae5' : '#eaebfe',
    color: txType.value === 'income' ? '#059669' : '#6b6ef5',
    type: txType.value,
  })

  selectedCategoryId.value = created.id
  showCreateCategory.value = false
  showToast({ message: '分类已创建', icon: 'success' })
}

onMounted(loadCategories)

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
const editablePhotoResult = ref(null)
const photoSaving = ref(false)
const uploadedImage = ref('')
const fileInput = ref(null)
const cameraInput = ref(null)
const showPhotoMerchantEditor = ref(false)
const showPhotoAmountEditor = ref(false)
const showPhotoCategoryPicker = ref(false)
const showPhotoDateTimePicker = ref(false)
const photoMerchantDraft = ref('')
const photoAmountDraft = ref('')
const photoDatePickerValue = ref(getDatePickerValue(new Date()))
const photoTimePickerValue = ref(getTimePickerValue(new Date()))

function triggerCapture() {
  cameraInput.value?.click()
}

function openGallery() {
  fileInput.value?.click()
}

function clearUploadedImage() {
  if (uploadedImage.value) {
    URL.revokeObjectURL(uploadedImage.value)
    uploadedImage.value = ''
  }
}

function normalizeReceiptResult(data) {
  const spentAtDate = data?.spentAt ? new Date(data.spentAt) : new Date()
  const normalizedDate = Number.isNaN(spentAtDate.getTime()) ? new Date() : spentAtDate
  const amount = Number(data?.amount) || 0
  const confidence = Number(data?.confidence) || 0
  const category = data?.category || '其他'
  const categoryItem =
    expenseCategories.value.find((cat) => cat.name === category) ||
    expenseCategories.value.find((cat) => cat.name === '其他') ||
    expenseCategories.value[0]

  return {
    merchant: data?.merchant || '未知商家',
    amount: amount.toFixed(2),
    amountValue: amount,
    category,
    categoryId: categoryItem?.id || null,
    spentAt: normalizedDate,
    spentAtValue: toLocalDateTimeString(normalizedDate),
    time: formatReceiptDate(normalizedDate),
    confidence,
  }
}

function syncEditablePhotoResult(result) {
  editablePhotoResult.value = result ? { ...result } : null
}

async function handlePhotoSelected(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file || photoState.value === 'recognizing') return

  clearUploadedImage()
  uploadedImage.value = URL.createObjectURL(file)
  photoResult.value = null
  photoState.value = 'recognizing'

  try {
    const data = await recognizeReceipt(file)
    photoResult.value = normalizeReceiptResult(data)
    syncEditablePhotoResult(photoResult.value)
    photoState.value = 'done'
  } catch (error) {
    photoState.value = 'idle'
    photoResult.value = null
    syncEditablePhotoResult(null)
    clearUploadedImage()
    showToast(error.response?.data?.message || 'AI 识别失败,请手动记账')
    mode.value = 'manual'
  }
}

function retryPhoto() {
  if (photoState.value === 'recognizing') return
  photoState.value = 'idle'
  photoResult.value = null
  syncEditablePhotoResult(null)
  showPhotoMerchantEditor.value = false
  showPhotoAmountEditor.value = false
  showPhotoCategoryPicker.value = false
  showPhotoDateTimePicker.value = false
  clearUploadedImage()
}

function openPhotoMerchantEditor() {
  if (!editablePhotoResult.value) return
  photoMerchantDraft.value = editablePhotoResult.value.merchant || ''
  showPhotoMerchantEditor.value = true
}

function confirmPhotoMerchant() {
  if (!editablePhotoResult.value) return
  editablePhotoResult.value.merchant = photoMerchantDraft.value.trim()
  showPhotoMerchantEditor.value = false
}

function openPhotoAmountEditor() {
  if (!editablePhotoResult.value) return
  photoAmountDraft.value = String(editablePhotoResult.value.amount || '')
  showPhotoAmountEditor.value = true
}

function confirmPhotoAmount() {
  if (!editablePhotoResult.value) return

  const amount = Number(photoAmountDraft.value)
  if (!amount || amount <= 0) {
    showToast('请输入有效金额')
    return
  }

  editablePhotoResult.value.amountValue = amount
  editablePhotoResult.value.amount = amount.toFixed(2)
  showPhotoAmountEditor.value = false
}

async function openPhotoCategoryPicker() {
  if (!editablePhotoResult.value) return
  try {
    await catStore.fetchCategories('expense')
  } catch (error) {
    showToast(error.response?.data?.message || '获取分类失败')
  }
  showPhotoCategoryPicker.value = true
}

function selectPhotoCategory(category) {
  if (!editablePhotoResult.value) return
  editablePhotoResult.value.category = category.name
  editablePhotoResult.value.categoryId = category.id
  showPhotoCategoryPicker.value = false
}

function openPhotoDateTimePicker() {
  if (!editablePhotoResult.value) return
  const date = new Date(editablePhotoResult.value.spentAtValue)
  const normalizedDate = Number.isNaN(date.getTime()) ? new Date() : date
  photoDatePickerValue.value = getDatePickerValue(normalizedDate)
  photoTimePickerValue.value = getTimePickerValue(normalizedDate)
  showPhotoDateTimePicker.value = true
}

function confirmPhotoDateTime() {
  if (!editablePhotoResult.value) return
  const [year, month, day] = photoDatePickerValue.value.map(Number)
  const [hour, minute] = photoTimePickerValue.value.map(Number)
  const date = new Date(year, month - 1, day, hour, minute, 0)
  editablePhotoResult.value.spentAt = date
  editablePhotoResult.value.spentAtValue = toLocalDateTimeString(date)
  editablePhotoResult.value.time = formatReceiptDate(date)
  showPhotoDateTimePicker.value = false
}

async function savePhoto() {
  if (!editablePhotoResult.value || photoSaving.value) return

  const amount = Number(editablePhotoResult.value.amountValue)
  if (!amount || amount <= 0) {
    showToast('请输入有效金额')
    return
  }

  const payload = {
    type: 'expense',
    amount,
    category: editablePhotoResult.value.category,
    merchant: editablePhotoResult.value.merchant,
    spentAt: editablePhotoResult.value.spentAtValue,
    inputMethod: 'photo',
  }

  photoSaving.value = true
  try {
    const { data } = await createTransaction(payload)

    txStore.addTransaction({
      id: data.id,
      categoryId: editablePhotoResult.value.categoryId,
      categoryName: data.category,
      amount: Number(data.amount),
      type: data.type,
      merchant: data.merchant || '',
      note: data.note || '',
      spentAt: new Date(data.spentAt),
      inputMethod: data.inputMethod,
      aiConfidence: editablePhotoResult.value.confidence / 100,
    })

    showToast({ message: '已保存', icon: 'success' })
    router.replace({ name: 'home' })
  } catch (error) {
    showToast(error.response?.data?.message || '保存失败，请稍后重试')
  } finally {
    photoSaving.value = false
  }
}

// --- Voice mode state ---
const voiceState = ref('idle') // 'idle' | 'recording' | 'parsing' | 'done'
const voiceSeconds = ref(0)
const voiceText = ref('')
const voiceResult = ref(null)
const editableVoiceResult = ref(null)
const voiceSupported = ref(true)
const voiceSaving = ref(false)
const showVoiceMerchantEditor = ref(false)
const showVoiceAmountEditor = ref(false)
const showVoiceCategoryPicker = ref(false)
const showVoiceDateTimePicker = ref(false)
const voiceMerchantDraft = ref('')
const voiceAmountDraft = ref('')
const voiceDatePickerValue = ref(getDatePickerValue(new Date()))
const voiceTimePickerValue = ref(getTimePickerValue(new Date()))
let voiceTimer = null
let voiceSilenceTimer = null
let speechRecognition = null
let SpeechRecognitionCtor = null
let voiceParseStarted = false
const VOICE_SILENCE_MS = 2500

onMounted(() => {
  SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition
  voiceSupported.value = Boolean(SpeechRecognitionCtor)
})

function resetVoiceSilenceTimer() {
  clearTimeout(voiceSilenceTimer)
  voiceSilenceTimer = setTimeout(() => {
    if (voiceState.value === 'recording') {
      stopRecording()
    }
  }, VOICE_SILENCE_MS)
}

function cleanupVoiceRecognition() {
  clearInterval(voiceTimer)
  clearTimeout(voiceSilenceTimer)
  voiceTimer = null
  voiceSilenceTimer = null
  speechRecognition = null
}

function normalizeVoiceResult(data) {
  const spentAtDate = data?.spentAt ? new Date(data.spentAt) : new Date()
  const normalizedDate = Number.isNaN(spentAtDate.getTime()) ? new Date() : spentAtDate
  const amount = Number(data?.amount) || 0
  const confidence = Number(data?.confidence) || 0
  const category = data?.category || '其他'
  const categoryItem =
    expenseCategories.value.find((cat) => cat.name === category) ||
    expenseCategories.value.find((cat) => cat.name === '其他') ||
    expenseCategories.value[0]

  return {
    merchant: data?.merchant || '',
    amount: amount.toFixed(2),
    amountValue: amount,
    category,
    categoryId: categoryItem?.id || null,
    spentAt: normalizedDate,
    spentAtValue: toLocalDateTimeString(normalizedDate),
    time: formatReceiptDate(normalizedDate),
    confidence,
  }
}

function syncEditableVoiceResult(result) {
  editableVoiceResult.value = result ? { ...result } : null
}

function resetVoice() {
  if (speechRecognition && voiceState.value === 'recording') {
    speechRecognition.stop()
  }
  cleanupVoiceRecognition()
  voiceState.value = 'idle'
  voiceSeconds.value = 0
  voiceText.value = ''
  voiceResult.value = null
  syncEditableVoiceResult(null)
  voiceParseStarted = false
  showVoiceMerchantEditor.value = false
  showVoiceAmountEditor.value = false
  showVoiceCategoryPicker.value = false
  showVoiceDateTimePicker.value = false
}

function startRecording() {
  if (!voiceSupported.value || !SpeechRecognitionCtor) {
    showToast('你的浏览器不支持语音识别,请用 Chrome 或 Edge')
    return
  }

  resetVoice()
  speechRecognition = new SpeechRecognitionCtor()
  speechRecognition.lang = 'zh-CN'
  speechRecognition.continuous = true
  speechRecognition.interimResults = true
  voiceParseStarted = false

  speechRecognition.onresult = (event) => {
    let finalText = ''
    let interimText = ''
    for (let i = 0; i < event.results.length; i++) {
      const text = event.results[i][0]?.transcript || ''
      if (event.results[i].isFinal) {
        finalText += text
      } else {
        interimText += text
      }
    }
    voiceText.value = `${finalText}${interimText}`.trim()
    resetVoiceSilenceTimer()
  }

  speechRecognition.onerror = (event) => {
    cleanupVoiceRecognition()
    voiceState.value = 'idle'
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      showToast('请允许麦克风访问')
    } else {
      showToast('录音失败,请重试')
    }
  }

  speechRecognition.onend = () => {
    if (voiceState.value === 'recording') {
      parseRecordedVoice()
    }
  }

  try {
    speechRecognition.start()
    voiceState.value = 'recording'
    voiceSeconds.value = 0
    voiceTimer = setInterval(() => {
      voiceSeconds.value++
    }, 1000)
    resetVoiceSilenceTimer()
  } catch {
    cleanupVoiceRecognition()
    voiceState.value = 'idle'
    showToast('录音失败,请重试')
  }
}

function stopRecording() {
  if (voiceState.value !== 'recording') return
  clearInterval(voiceTimer)
  clearTimeout(voiceSilenceTimer)
  if (speechRecognition) {
    speechRecognition.stop()
  } else {
    parseRecordedVoice()
  }
}

async function parseRecordedVoice() {
  if (voiceParseStarted) return
  voiceParseStarted = true
  cleanupVoiceRecognition()

  const text = voiceText.value.trim()
  if (!text) {
    voiceState.value = 'idle'
    voiceParseStarted = false
    showToast('没有识别到内容,请重试')
    return
  }

  voiceState.value = 'parsing'
  try {
    const data = await parseVoice(text)
    voiceResult.value = normalizeVoiceResult(data)
    syncEditableVoiceResult(voiceResult.value)
    voiceState.value = 'done'
  } catch (error) {
    voiceState.value = 'idle'
    voiceParseStarted = false
    showToast(error.response?.data?.message || 'AI 解析失败,请稍后重试')
  }
}

function openVoiceMerchantEditor() {
  if (!editableVoiceResult.value) return
  voiceMerchantDraft.value = editableVoiceResult.value.merchant || ''
  showVoiceMerchantEditor.value = true
}

function confirmVoiceMerchant() {
  if (!editableVoiceResult.value) return
  editableVoiceResult.value.merchant = voiceMerchantDraft.value.trim()
  showVoiceMerchantEditor.value = false
}

function openVoiceAmountEditor() {
  if (!editableVoiceResult.value) return
  voiceAmountDraft.value = String(editableVoiceResult.value.amount || '')
  showVoiceAmountEditor.value = true
}

function confirmVoiceAmount() {
  if (!editableVoiceResult.value) return

  const amount = Number(voiceAmountDraft.value)
  if (!amount || amount <= 0) {
    showToast('请输入有效金额')
    return
  }

  editableVoiceResult.value.amountValue = amount
  editableVoiceResult.value.amount = amount.toFixed(2)
  showVoiceAmountEditor.value = false
}

async function openVoiceCategoryPicker() {
  if (!editableVoiceResult.value) return
  try {
    await catStore.fetchCategories('expense')
  } catch (error) {
    showToast(error.response?.data?.message || '获取分类失败')
  }
  showVoiceCategoryPicker.value = true
}

function selectVoiceCategory(category) {
  if (!editableVoiceResult.value) return
  editableVoiceResult.value.category = category.name
  editableVoiceResult.value.categoryId = category.id
  showVoiceCategoryPicker.value = false
}

function openVoiceDateTimePicker() {
  if (!editableVoiceResult.value) return
  const date = new Date(editableVoiceResult.value.spentAtValue)
  const normalizedDate = Number.isNaN(date.getTime()) ? new Date() : date
  voiceDatePickerValue.value = getDatePickerValue(normalizedDate)
  voiceTimePickerValue.value = getTimePickerValue(normalizedDate)
  showVoiceDateTimePicker.value = true
}

function confirmVoiceDateTime() {
  if (!editableVoiceResult.value) return
  const [year, month, day] = voiceDatePickerValue.value.map(Number)
  const [hour, minute] = voiceTimePickerValue.value.map(Number)
  const date = new Date(year, month - 1, day, hour, minute, 0)
  editableVoiceResult.value.spentAt = date
  editableVoiceResult.value.spentAtValue = toLocalDateTimeString(date)
  editableVoiceResult.value.time = formatReceiptDate(date)
  showVoiceDateTimePicker.value = false
}

async function saveVoice() {
  if (!editableVoiceResult.value || voiceSaving.value) return

  const amount = Number(editableVoiceResult.value.amountValue)
  if (!amount || amount <= 0) {
    showToast('请输入有效金额')
    return
  }

  const payload = {
    type: 'expense',
    amount,
    category: editableVoiceResult.value.category,
    merchant: editableVoiceResult.value.merchant,
    note: voiceText.value,
    spentAt: editableVoiceResult.value.spentAtValue,
    inputMethod: 'voice',
  }

  voiceSaving.value = true
  try {
    const { data } = await createTransaction(payload)

    txStore.addTransaction({
      id: data.id,
      categoryId: editableVoiceResult.value.categoryId,
      categoryName: data.category,
      amount: Number(data.amount),
      type: data.type,
      merchant: data.merchant || '',
      note: data.note || '',
      spentAt: new Date(data.spentAt),
      inputMethod: data.inputMethod,
      aiConfidence: editableVoiceResult.value.confidence / 100,
    })

    showToast({ message: '已保存', icon: 'success' })
    router.replace({ name: 'home' })
  } catch (error) {
    showToast(error.response?.data?.message || '保存失败，请稍后重试')
  } finally {
    voiceSaving.value = false
  }
}

function formatVoiceTime(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

onUnmounted(() => {
  clearInterval(voiceTimer)
  clearTimeout(voiceSilenceTimer)
  if (speechRecognition && voiceState.value === 'recording') {
    speechRecognition.stop()
  }
  clearUploadedImage()
})
</script>

<template>
  <div class="page">
    <!-- ========== MANUAL MODE ========== -->
    <template v-if="mode === 'manual'">
      <div class="manual-form">
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
              v-for="cat in visibleCategories"
              :key="cat.id"
              :class="['cat-item', { selected: selectedCategoryId === cat.id }]"
              @click="selectedCategoryId = cat.id"
            >
              <div class="cat-icon" :style="{ background: cat.bg }">{{ cat.icon }}</div>
              <span class="cat-name" :class="{ 'active-text': selectedCategoryId === cat.id }">
                {{ cat.name }}
              </span>
            </div>
            <div
              v-if="hasMoreCategories"
              class="cat-item"
              @click="showAllCategories = !showAllCategories"
            >
              <div class="cat-icon" style="background: #f3f4f6">···</div>
              <span class="cat-name">{{ showAllCategories ? '收起' : '更多' }}</span>
            </div>
          </div>
        </div>

        <div v-if="showCreateCategory" class="page-layer center">
          <div class="page-layer-mask" @click="showCreateCategory = false"></div>
          <div class="category-dialog">
            <p class="category-dialog-title">新建分类</p>
            <van-field
              v-model="newCategoryName"
              label="名称"
              placeholder="例如: 早餐"
              clearable
            />
            <van-field
              v-model="newCategoryIcon"
              label="图标"
              placeholder="例如: 🥐"
              maxlength="2"
              clearable
            />
            <div class="category-dialog-actions">
              <button type="button" class="dialog-cancel" @click="showCreateCategory = false">
                取消
              </button>
              <button type="button" class="dialog-confirm" @click="createCategory">
                创建
              </button>
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
        <div v-if="!uploadedImage" class="vf-idle">
          <div class="vf-icon">📸</div>
          <p class="vf-hint">点击拍照识别小票</p>
        </div>

        <template v-else-if="photoState === 'recognizing' || photoState === 'done'">
          <div class="vf-receipt">
            <img :src="uploadedImage" class="receipt-image" alt="已上传的小票照片" />
            <div v-if="photoState === 'recognizing'" class="recognizing-overlay"></div>
            <div class="ai-pill">
              <span class="ai-dot"></span>
              {{ photoState === 'recognizing' ? 'AI 识别中...' : 'AI 识别完成' }}
            </div>
            <p v-if="photoState === 'recognizing'" class="ai-loading-hint">
              真识别通常需要 5-10 秒,请稍候
            </p>
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

      <div v-if="editablePhotoResult" class="ai-result-card">
        <div class="ar-header">
          <span class="ar-title">AI 识别结果</span>
          <van-button size="small" round class="done-btn" :loading="photoSaving" @click="savePhoto">
            完成
          </van-button>
        </div>
        <div class="ar-grid">
          <div class="ar-field">
            <p class="ar-label">商家</p>
            <div class="ar-value-row">
              <span class="ar-value">{{ editablePhotoResult.merchant || '未填写' }}</span>
              <button type="button" class="ar-edit-btn" @click="openPhotoMerchantEditor">
                <van-icon name="edit" size="16" color="rgba(255,255,255,0.7)" />
              </button>
            </div>
          </div>
          <div class="ar-field">
            <p class="ar-label">金额</p>
            <div class="ar-value-row">
              <span class="ar-value">¥{{ editablePhotoResult.amount }}</span>
              <button type="button" class="ar-edit-btn" @click="openPhotoAmountEditor">
                <van-icon name="edit" size="16" color="rgba(255,255,255,0.7)" />
              </button>
            </div>
          </div>
          <div class="ar-field">
            <p class="ar-label">分类</p>
            <div class="ar-value-row">
              <span class="ar-value">{{ editablePhotoResult.category }}</span>
              <button type="button" class="ar-edit-btn" @click="openPhotoCategoryPicker">
                <van-icon name="edit" size="16" color="rgba(255,255,255,0.7)" />
              </button>
            </div>
          </div>
          <div class="ar-field">
            <p class="ar-label">时间</p>
            <div class="ar-value-row">
              <span class="ar-value">{{ editablePhotoResult.time }}</span>
              <button type="button" class="ar-edit-btn" @click="openPhotoDateTimePicker">
                <van-icon name="edit" size="16" color="rgba(255,255,255,0.7)" />
              </button>
            </div>
          </div>
        </div>
        <p v-if="editablePhotoResult.confidence < 80" class="confidence-warning">
          识别置信度较低,请核对
        </p>
      </div>

      <van-popup v-model:show="showPhotoMerchantEditor" round position="bottom">
        <div class="photo-edit-panel">
          <p class="photo-edit-title">修改商家</p>
          <van-field
            v-model="photoMerchantDraft"
            label="商家"
            placeholder="请输入商家名称"
            clearable
          />
          <div class="photo-edit-actions">
            <button type="button" class="dialog-cancel" @click="showPhotoMerchantEditor = false">
              取消
            </button>
            <button type="button" class="dialog-confirm" @click="confirmPhotoMerchant">
              确定
            </button>
          </div>
        </div>
      </van-popup>

      <van-popup v-model:show="showPhotoAmountEditor" round position="bottom">
        <div class="photo-edit-panel">
          <p class="photo-edit-title">修改金额</p>
          <van-field
            v-model="photoAmountDraft"
            label="金额"
            placeholder="请输入金额"
            type="number"
            inputmode="decimal"
            clearable
          />
          <div class="photo-edit-actions">
            <button type="button" class="dialog-cancel" @click="showPhotoAmountEditor = false">
              取消
            </button>
            <button type="button" class="dialog-confirm" @click="confirmPhotoAmount">
              确定
            </button>
          </div>
        </div>
      </van-popup>

      <van-popup v-model:show="showPhotoCategoryPicker" round position="bottom">
        <div class="photo-edit-panel">
          <p class="photo-edit-title">选择分类</p>
          <div class="photo-cat-grid">
            <button
              v-for="cat in expenseCategories"
              :key="cat.id"
              type="button"
              :class="['photo-cat-option', { selected: editablePhotoResult?.categoryId === cat.id }]"
              @click="selectPhotoCategory(cat)"
            >
              <span class="photo-cat-icon" :style="{ background: cat.bg }">{{ cat.icon }}</span>
              <span>{{ cat.name }}</span>
            </button>
          </div>
        </div>
      </van-popup>

      <van-popup
        v-model:show="showPhotoDateTimePicker"
        round
        position="bottom"
        class="date-time-popup"
        overlay-class="date-time-overlay"
      >
        <van-picker-group
          title="修改日期时间"
          :tabs="['日期', '时间']"
          @confirm="confirmPhotoDateTime"
          @cancel="showPhotoDateTimePicker = false"
        >
          <van-date-picker
            v-model="photoDatePickerValue"
            :min-date="minDate"
            :max-date="maxDate"
          />
          <van-time-picker
            v-model="photoTimePickerValue"
            :columns-type="['hour', 'minute']"
          />
        </van-picker-group>
      </van-popup>

      <div class="photo-actions">
        <button
          class="photo-act-btn"
          :disabled="photoState === 'recognizing'"
          aria-label="从相册选择"
          title="从相册选择"
          @click="openGallery"
        >
          <van-icon name="photo-o" size="24" color="#6b7280" />
        </button>
        <button
          class="photo-shoot-btn"
          :disabled="photoState === 'recognizing'"
          aria-label="拍照"
          title="拍照"
          @click="triggerCapture"
        >
          <div class="shoot-inner"></div>
        </button>
        <button
          class="photo-act-btn"
          :disabled="photoState === 'recognizing'"
          aria-label="重拍"
          title="重拍"
          @click="retryPhoto"
        >
          <van-icon name="replay" size="24" color="#6b7280" />
        </button>
      </div>

      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        class="hidden-input"
        @change="handlePhotoSelected"
      />
      <input
        ref="cameraInput"
        type="file"
        accept="image/*"
        capture="environment"
        class="hidden-input"
        @change="handlePhotoSelected"
      />
    </template>

    <!-- ========== VOICE MODE ========== -->
    <template v-else>
      <div class="nav-bar">
        <button class="nav-icon-btn" @click="handleBack">
          <van-icon name="arrow-left" size="22" />
        </button>
        <span class="nav-title">语音记账</span>
        <span class="nav-placeholder"></span>
      </div>

      <div class="card voice-card">
        <div class="rec-indicator">
          <span v-if="voiceState === 'recording'" class="rec-dot"></span>
          <span v-if="voiceState === 'recording'" class="rec-text">录音中 {{ formatVoiceTime(voiceSeconds) }}</span>
          <span v-else-if="voiceState === 'parsing'" class="rec-parsing">
            <van-loading size="18" color="#6b6ef5" />
            AI 解析中...
          </span>
          <span v-else-if="voiceState === 'done'" class="rec-done">识别完成</span>
          <span v-else class="rec-hint">点击开始录音</span>
        </div>
        <p v-if="!voiceSupported" class="voice-support-tip">
          你的浏览器不支持语音识别,请用 Chrome 或 Edge
        </p>
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

      <template v-if="editableVoiceResult">
        <div class="card">
          <p class="ai-extracted-title">AI 帮你提取了这些信息</p>
          <div class="extracted-amount">
            <p class="ea-label">金额</p>
            <div class="voice-field-row">
              <p class="ea-value">¥ {{ editableVoiceResult.amount }}</p>
              <button type="button" class="voice-edit-btn" @click="openVoiceAmountEditor">
                <van-icon name="edit" size="16" color="#6b6ef5" />
              </button>
            </div>
          </div>
          <div class="extracted-cat voice-extracted-field">
            <p class="ea-label">分类</p>
            <div class="ea-cat-row">
              <div class="ea-cat-icon" style="background: #ede9fe">📌</div>
              <span class="ea-cat-name">{{ editableVoiceResult.category }}</span>
              <button type="button" class="voice-edit-btn" @click="openVoiceCategoryPicker">
                <van-icon name="edit" size="16" color="#6b6ef5" />
              </button>
            </div>
          </div>
          <div class="voice-extracted-field">
            <p class="ea-label">商家</p>
            <div class="voice-field-row">
              <span class="voice-field-value">{{ editableVoiceResult.merchant || '未填写' }}</span>
              <button type="button" class="voice-edit-btn" @click="openVoiceMerchantEditor">
                <van-icon name="edit" size="16" color="#6b6ef5" />
              </button>
            </div>
          </div>
          <div class="voice-extracted-field">
            <p class="ea-label">时间</p>
            <div class="voice-field-row">
              <span class="voice-field-value">{{ editableVoiceResult.time }}</span>
              <button type="button" class="voice-edit-btn" @click="openVoiceDateTimePicker">
                <van-icon name="edit" size="16" color="#6b6ef5" />
              </button>
            </div>
          </div>
        </div>
      </template>

      <van-popup v-model:show="showVoiceMerchantEditor" round position="bottom">
        <div class="photo-edit-panel">
          <p class="photo-edit-title">修改商家</p>
          <van-field
            v-model="voiceMerchantDraft"
            label="商家"
            placeholder="请输入商家名称"
            clearable
          />
          <div class="photo-edit-actions">
            <button type="button" class="dialog-cancel" @click="showVoiceMerchantEditor = false">
              取消
            </button>
            <button type="button" class="dialog-confirm" @click="confirmVoiceMerchant">
              确定
            </button>
          </div>
        </div>
      </van-popup>

      <van-popup v-model:show="showVoiceAmountEditor" round position="bottom">
        <div class="photo-edit-panel">
          <p class="photo-edit-title">修改金额</p>
          <van-field
            v-model="voiceAmountDraft"
            label="金额"
            placeholder="请输入金额"
            type="number"
            inputmode="decimal"
            clearable
          />
          <div class="photo-edit-actions">
            <button type="button" class="dialog-cancel" @click="showVoiceAmountEditor = false">
              取消
            </button>
            <button type="button" class="dialog-confirm" @click="confirmVoiceAmount">
              确定
            </button>
          </div>
        </div>
      </van-popup>

      <van-popup v-model:show="showVoiceCategoryPicker" round position="bottom">
        <div class="photo-edit-panel">
          <p class="photo-edit-title">选择分类</p>
          <div class="photo-cat-grid">
            <button
              v-for="cat in expenseCategories"
              :key="cat.id"
              type="button"
              :class="['photo-cat-option', { selected: editableVoiceResult?.categoryId === cat.id }]"
              @click="selectVoiceCategory(cat)"
            >
              <span class="photo-cat-icon" :style="{ background: cat.bg }">{{ cat.icon }}</span>
              <span>{{ cat.name }}</span>
            </button>
          </div>
        </div>
      </van-popup>

      <van-popup
        v-model:show="showVoiceDateTimePicker"
        round
        position="bottom"
        class="date-time-popup"
        overlay-class="date-time-overlay"
      >
        <van-picker-group
          title="修改日期时间"
          :tabs="['日期', '时间']"
          @confirm="confirmVoiceDateTime"
          @cancel="showVoiceDateTimePicker = false"
        >
          <van-date-picker
            v-model="voiceDatePickerValue"
            :min-date="minDate"
            :max-date="maxDate"
          />
          <van-time-picker
            v-model="voiceTimePickerValue"
            :columns-type="['hour', 'minute']"
          />
        </van-picker-group>
      </van-popup>

      <div class="voice-ctrl">
        <van-button
          v-if="voiceState === 'idle'"
          type="primary"
          round
          class="rec-btn"
          :disabled="!voiceSupported"
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
        <div v-else-if="voiceState === 'done'" class="voice-done-actions">
          <button
            type="button"
            class="voice-retry-btn"
            :disabled="voiceSaving"
            @click="resetVoice"
          >
            <van-icon name="replay" size="16" />
            重新录音
          </button>
          <van-button
            round
            class="voice-save-btn"
            :loading="voiceSaving"
            loading-text="保存中..."
            @click="saveVoice"
          >
            保存
          </van-button>
        </div>
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
  height: 100dvh;
  min-height: -webkit-fill-available;
  background: #f3f4f8;
  padding: 0 16px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
  padding-bottom: calc(96px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  position: relative;
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

.manual-form {
  display: flex;
  flex-direction: column;
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
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

.page-layer {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  justify-content: center;
}

.page-layer.center {
  align-items: center;
  padding: 0 20px;
}

.page-layer-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
}

.category-dialog {
  position: relative;
  z-index: 1;
  width: 100%;
  background: #fff;
  border-radius: 20px;
  padding: 18px 18px 14px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
}

.category-dialog-title {
  text-align: center;
  font-size: 17px;
  font-weight: 700;
  margin-bottom: 14px;
}

.category-dialog-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 14px;
}

.dialog-cancel,
.dialog-confirm {
  height: 42px;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
}

.dialog-cancel {
  background: #f3f4f6;
  color: #6b7280;
}

.dialog-confirm {
  background: #6b6ef5;
  color: #fff;
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
  flex: 0 1 auto;
  background: #d0d0d8;
  border-radius: 20px;
  margin-bottom: 12px;
  min-height: clamp(180px, 38dvh, 280px);
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

.ai-loading-hint {
  position: absolute;
  top: 52px;
  left: 16px;
  right: 16px;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  text-shadow: 0 1px 4px rgba(17, 24, 39, 0.35);
  z-index: 2;
}

@keyframes blink {
  0%, 100% { opacity: 1 }
  50% { opacity: 0.3 }
}

.vf-receipt {
  position: absolute;
  inset: 0;
}

.receipt-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 20px;
  display: block;
}

.recognizing-overlay {
  position: absolute;
  inset: 0;
  background: rgba(107, 110, 245, 0.28);
  border-radius: 20px;
  z-index: 1;
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
  gap: 8px;
}

.ar-edit-btn {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.confidence-warning {
  margin-top: 12px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.18);
  font-size: 13px;
  font-weight: 600;
}

.photo-edit-panel {
  padding: 18px 16px 22px;
  background: #fff;
}

.photo-edit-title {
  font-size: 17px;
  font-weight: 700;
  margin-bottom: 14px;
  color: #1a1a2e;
  text-align: center;
}

.photo-edit-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 16px;
}

.photo-cat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.photo-cat-option {
  border: 1px solid transparent;
  border-radius: 12px;
  background: #f8f9fc;
  color: #4b5563;
  min-height: 78px;
  padding: 10px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  cursor: pointer;
}

.photo-cat-option.selected {
  border-color: #6b6ef5;
  background: #f0f1ff;
  color: #4f46e5;
  font-weight: 700;
}

.photo-cat-icon {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

/* Photo action buttons */
.photo-actions {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 12px 0;
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
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

.photo-act-btn:disabled,
.photo-shoot-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
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

.rec-parsing {
  color: #6b6ef5;
  display: flex;
  align-items: center;
  gap: 8px;
}

.rec-hint {
  color: #9ca3af;
}

.voice-support-tip {
  color: #ef4444;
  font-size: 13px;
  text-align: center;
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

.voice-extracted-field {
  margin-top: 14px;
}

.ea-label {
  font-size: 13px;
  color: #9ca3af;
  margin-bottom: 6px;
}

.ea-value {
  font-size: 32px;
  font-weight: 700;
  margin: 0;
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

.voice-field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.voice-field-value {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.voice-edit-btn {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border: none;
  border-radius: 50%;
  background: #f0f1ff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.voice-ctrl {
  display: flex;
  justify-content: center;
  padding: 16px 0;
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
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

.voice-done-actions {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.voice-retry-btn {
  min-width: 94px;
  height: 40px;
  border: none;
  border-radius: 12px;
  background: #eef0f5;
  color: #6b7280;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.voice-retry-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.voice-save-btn {
  width: min(230px, calc(100% - 118px));
  height: 52px;
  background: #6b6ef5 !important;
  border-color: #6b6ef5 !important;
  color: white !important;
  font-size: 17px;
  font-weight: 600;
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
  height: calc(64px + env(safe-area-inset-bottom));
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
