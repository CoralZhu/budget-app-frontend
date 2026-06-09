<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import {
  continueBudgetChat,
  getConversationDetail,
  listConversations,
  startBudgetChat,
} from '@/api/agent'

const route = useRoute()
const router = useRouter()

marked.setOptions({
  breaks: true,
  gfm: true,
})

const messages = ref([])
const inputText = ref('')
const isLoading = ref(false)
const loadingText = ref('AI 正在初始化...')
const bottomRef = ref(null)
const conversationId = ref(null)
const showHistoryPopup = ref(false)
const historyList = ref([])
const toolCallsInProgress = ref([])
const voiceState = ref('idle') // 'idle' | 'listening' | 'processing'
const isVoiceSupported = ref(true)

const isRecording = computed(() => voiceState.value === 'listening')

const visibleMessages = computed(() =>
  messages.value.filter((message) => {
    return (
      (message.role === 'user' || message.role === 'assistant') &&
      (message.content || message._streaming)
    )
  }),
)

const showGlobalLoading = computed(
  () => isLoading.value && !messages.value.some((message) => message._streaming),
)

async function* parseSSEStream(response) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop()

    for (const eventText of events) {
      if (!eventText.trim()) continue

      const lines = eventText.split('\n')
      let eventType = 'message'
      let data = ''

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          data = line.slice(6)
        }
      }

      try {
        yield { type: eventType, data: JSON.parse(data) }
      } catch (error) {
        console.error('SSE parse error:', error, data)
      }
    }
  }
}

function unwrapData(response) {
  return response.data?.data || response.data || {}
}

function renderMarkdown(text) {
  if (!text) return ''
  const html = marked.parse(text)
  return DOMPurify.sanitize(html)
}

function getErrorMessage(error) {
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return 'AI 响应超时，请重试'
  }

  return error.response?.data?.message || 'AI 请求失败，请稍后重试'
}

async function scrollToBottom(behavior = 'smooth') {
  await nextTick()
  bottomRef.value?.scrollIntoView({ behavior, block: 'end' })
}

async function initChat() {
  try {
    isLoading.value = true
    loadingText.value = 'AI 正在初始化...'
    const queryConvId = route.query.conversationId
    const response = queryConvId
      ? await getConversationDetail(queryConvId)
      : await startBudgetChat()
    const data = unwrapData(response)

    messages.value = Array.isArray(data.messages) ? data.messages : []
    conversationId.value = data.id || data.conversation_id || queryConvId || null

    if (!queryConvId && data.conversation_id) {
      router.replace({
        path: '/budget-chat',
        query: { ...route.query, conversationId: data.conversation_id },
      })
    }
  } catch (error) {
    console.error('加载对话失败:', error)
    showToast('AI 初始化失败，请稍后重试')
  } finally {
    isLoading.value = false
  }

  await scrollToBottom('auto')
}

async function sendMessage() {
  const content = inputText.value.trim()
  if (!content || isLoading.value) return

  messages.value.push({ role: 'user', content })
  const assistantIndex = messages.value.length
  messages.value.push({ role: 'assistant', content: '', _streaming: true })
  inputText.value = ''
  isLoading.value = true
  toolCallsInProgress.value = []
  await scrollToBottom()

  try {
    const token = localStorage.getItem('token')
    const response = await fetch(`${import.meta.env.VITE_AGENT_BASE_URL}/api/agent/budget/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messages: messages.value.slice(0, -1).filter((message) => !message._streaming),
        conversation_id: conversationId.value,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    for await (const event of parseSSEStream(response)) {
      switch (event.type) {
        case 'start':
          conversationId.value = event.data.conversation_id
          router.replace({
            path: '/budget-chat',
            query: { conversationId: event.data.conversation_id },
          })
          break

        case 'tool_call':
          toolCallsInProgress.value.push(event.data.name)
          messages.value[assistantIndex].content = `🔧 正在查询: ${event.data.name}...`
          await scrollToBottom()
          break

        case 'tool_result':
          toolCallsInProgress.value = toolCallsInProgress.value.filter(
            (name) => name !== event.data.name,
          )
          messages.value[assistantIndex].content = '✅ 数据获取完成，正在分析...'
          await scrollToBottom()
          break

        case 'text':
          if (
            messages.value[assistantIndex].content.startsWith('🔧') ||
            messages.value[assistantIndex].content.startsWith('✅')
          ) {
            messages.value[assistantIndex].content = ''
          }
          messages.value[assistantIndex].content += event.data.chunk
          await scrollToBottom()
          break

        case 'done':
          if (event.data.budget_saved) {
            showToast({ message: '✅ 预算已保存成功！', type: 'success' })
            window.setTimeout(() => {
              router.push('/budget')
            }, 2000)
          }
          break

        case 'final':
          delete messages.value[assistantIndex]._streaming
          messages.value = event.data.messages
          conversationId.value = event.data.conversation_id
          break

        case 'error':
          messages.value[assistantIndex].content = `❌ ${event.data.message}`
          break
      }
    }
  } catch (error) {
    console.error('流式请求失败:', error)

    try {
      const response = await continueBudgetChat(
        messages.value.slice(0, -1).filter((message) => !message._streaming),
        conversationId.value,
      )
      const data = unwrapData(response)
      if (Array.isArray(data.messages)) {
        messages.value = data.messages
      }
      conversationId.value = data.conversation_id || conversationId.value

      if (data.budget_saved) {
        showToast({ message: '✅ 预算已保存成功！', type: 'success' })
        window.setTimeout(() => {
          router.push('/budget')
        }, 2000)
      }
    } catch (fallbackError) {
      console.error('AI 请求失败:', fallbackError)
      messages.value[assistantIndex].content = '❌ AI 请求失败，请稍后重试'
      showToast('AI 请求失败')
    }
  } finally {
    isLoading.value = false
    toolCallsInProgress.value = []
    await scrollToBottom()
  }
}

watch(showHistoryPopup, async (val) => {
  if (!val) return

  try {
    const response = await listConversations('budget_planner')
    const data = unwrapData(response)
    historyList.value = Array.isArray(data) ? data : []
  } catch (error) {
    showToast(error.response?.data?.message || '获取对话历史失败')
  }
})

function switchConversation(convId) {
  showHistoryPopup.value = false
  if (String(convId) === String(conversationId.value)) return

  router.replace({
    path: '/budget-chat',
    query: { conversationId: convId },
  })
  window.location.reload()
}

function startNewConversation() {
  showHistoryPopup.value = false
  router.replace({ path: '/budget-chat' })
  window.location.reload()
}

let SpeechRecognitionCtor = null
let speechRecognition = null
let finalVoiceText = ''
let interimVoiceText = ''
let voiceHadError = false

function appendVoiceInput(text) {
  const content = text.trim()
  if (!content) return

  const current = inputText.value.trimEnd()
  inputText.value = current ? `${current} ${content}` : content
}

function finishVoiceInput() {
  if (voiceHadError) {
    voiceState.value = 'idle'
    return
  }

  appendVoiceInput(`${finalVoiceText}${interimVoiceText}`)
  voiceState.value = 'idle'
  finalVoiceText = ''
  interimVoiceText = ''
  speechRecognition = null
}

function startVoice(event) {
  if (event?.button != null && event.button !== 0) return
  if (isLoading.value || voiceState.value !== 'idle') return

  if (!SpeechRecognitionCtor) {
    showToast('当前浏览器不支持语音输入')
    isVoiceSupported.value = false
    return
  }

  finalVoiceText = ''
  interimVoiceText = ''
  voiceHadError = false
  speechRecognition = new SpeechRecognitionCtor()
  speechRecognition.lang = 'zh-CN'
  speechRecognition.continuous = true
  speechRecognition.interimResults = true

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

    finalVoiceText = finalText
    interimVoiceText = interimText
  }

  speechRecognition.onerror = () => {
    voiceHadError = true
    voiceState.value = 'idle'
    showToast('语音识别失败，请重试')
  }

  speechRecognition.onend = finishVoiceInput

  try {
    speechRecognition.start()
    voiceState.value = 'listening'
  } catch {
    speechRecognition = null
    voiceState.value = 'idle'
    showToast('语音识别失败，请重试')
  }
}

function stopVoice() {
  if (voiceState.value !== 'listening') return

  voiceState.value = 'processing'
  try {
    speechRecognition?.stop()
  } catch {
    finishVoiceInput()
  }
}

function formatTime(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return `今天 ${date.toTimeString().slice(0, 5)}`
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) return `${diffDays} 天前`
  return date.toISOString().slice(0, 10)
}

onMounted(() => {
  SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition
  isVoiceSupported.value = Boolean(SpeechRecognitionCtor)
  if (!isVoiceSupported.value) {
    showToast('当前浏览器不支持语音输入')
  }
  initChat()
})

onUnmounted(() => {
  if (voiceState.value === 'listening') {
    speechRecognition?.stop()
  }
})
</script>

<template>
  <div class="chat-page">
    <div class="nav-bar">
      <van-icon name="arrow-left" size="22" class="back-icon" @click="router.back()" />
      <div class="nav-title-wrap">
        <span class="nav-title">AI 预算规划</span>
        <van-icon name="clock-o" class="history-icon" @click="showHistoryPopup = true" />
      </div>
      <span class="nav-placeholder"></span>
    </div>

    <main class="message-list">
      <div
        v-for="(message, index) in visibleMessages"
        :key="`${message.role}-${index}`"
        class="message-row"
        :class="message.role"
      >
        <div
          v-if="message.content && message.role === 'assistant'"
          class="message-bubble markdown-body"
          v-html="renderMarkdown(message.content)"
        ></div>
        <div v-else-if="message.content" class="message-bubble">{{ message.content }}</div>
        <div v-else class="message-bubble typing">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </div>

      <div v-if="showGlobalLoading" class="loading-row">
        <div class="loading-bubble">
          <van-loading size="18" color="#6e73f2" />
          <span>{{ loadingText }}</span>
        </div>
      </div>

      <div ref="bottomRef" class="scroll-anchor"></div>
    </main>

    <footer class="input-bar">
      <textarea
        v-model="inputText"
        class="chat-input"
        rows="1"
        placeholder="输入你的预算想法"
        :disabled="isLoading"
        @keydown.enter.exact.prevent="sendMessage"
      ></textarea>
      <button
        type="button"
        class="mic-btn"
        :class="{ recording: isRecording, processing: voiceState === 'processing' }"
        :disabled="isLoading || !isVoiceSupported"
        :title="isVoiceSupported ? '按住说话' : '当前浏览器不支持语音输入'"
        @mousedown="startVoice"
        @mouseup="stopVoice"
        @mouseleave="stopVoice"
        @touchstart.prevent="startVoice"
        @touchend.prevent="stopVoice"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      </button>
      <button
        type="button"
        class="send-btn"
        :disabled="!inputText.trim() || isLoading"
        @click="sendMessage"
      >
        发送
      </button>
    </footer>

    <van-popup
      v-model:show="showHistoryPopup"
      position="right"
      :style="{ width: '80%', height: '100%' }"
    >
      <div class="history-panel">
        <div class="history-header">
          <span>对话历史</span>
          <van-icon name="cross" @click="showHistoryPopup = false" />
        </div>
        <div v-if="historyList.length === 0" class="history-empty">暂无历史对话</div>
        <div
          v-for="conv in historyList"
          :key="conv.id"
          class="history-item"
          :class="{ active: String(conv.id) === String(conversationId) }"
          @click="switchConversation(conv.id)"
        >
          <div class="history-title">{{ conv.title || '未命名对话' }}</div>
          <div class="history-meta">
            {{ conv.message_count }} 条消息 · {{ formatTime(conv.updated_at) }}
          </div>
        </div>
        <div class="history-actions">
          <van-button type="primary" block @click="startNewConversation"> + 开启新对话 </van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.chat-page {
  height: 100dvh;
  min-height: 100%;
  background: #f3f4f8;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.nav-bar {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: 44px 1fr 44px;
  align-items: center;
  padding: 18px 16px 14px;
  background: #fff;
  border-bottom: 1px solid #eceef5;
}

.back-icon {
  color: #1a1a2e;
  cursor: pointer;
}

.nav-title {
  text-align: center;
  font-size: 18px;
  font-weight: 700;
  color: #1a1a2e;
}

.nav-title-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 0;
}

.nav-placeholder {
  width: 44px;
}

.history-icon {
  font-size: 20px;
  color: var(--color-text-secondary, #666);
  cursor: pointer;
  padding: 6px;
}

.message-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 18px 16px;
  scroll-behavior: smooth;
}

.message-row {
  display: flex;
  margin-bottom: 12px;
}

.message-row.assistant {
  justify-content: flex-start;
}

.message-row.user {
  justify-content: flex-end;
}

.message-bubble {
  max-width: 75%;
  border-radius: 16px;
  padding: 10px 13px;
  font-size: 15px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-row.assistant .message-bubble {
  background: #fff;
  color: #1f2937;
  border-top-left-radius: 6px;
  box-shadow: 0 2px 10px rgba(31, 41, 55, 0.05);
}

.message-row.user .message-bubble {
  background: #6e73f2;
  color: #fff;
  border-top-right-radius: 6px;
}

.markdown-body {
  white-space: normal;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  font-size: 15px;
  font-weight: 600;
  margin: 12px 0 6px;
  color: var(--color-text-primary, #333);
}

.markdown-body :deep(p) {
  margin: 6px 0;
  line-height: 1.6;
}

.markdown-body :deep(p:first-child),
.markdown-body :deep(h1:first-child),
.markdown-body :deep(h2:first-child),
.markdown-body :deep(h3:first-child) {
  margin-top: 0;
}

.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-body :deep(strong) {
  font-weight: 600;
  color: #5b54d6;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 6px 0;
  padding-left: 20px;
}

.markdown-body :deep(li) {
  margin: 3px 0;
}

.markdown-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 10px 0;
  font-size: 13px;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 0.5px solid #e0e0e0;
  padding: 6px 10px;
  text-align: left;
}

.markdown-body :deep(th) {
  background: #f5f5f7;
  font-weight: 500;
}

.markdown-body :deep(code) {
  background: rgba(0, 0, 0, 0.04);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12px;
}

.markdown-body :deep(hr) {
  border: none;
  border-top: 0.5px solid #e0e0e0;
  margin: 12px 0;
}

.markdown-body :deep(blockquote) {
  border-left: 3px solid #6e73f2;
  padding-left: 12px;
  margin: 8px 0;
  color: #666;
}

.typing {
  padding: 12px 16px;
}

.dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin: 0 2px;
  background: #999;
  border-radius: 50%;
  animation: typing 1.4s infinite;
}

.dot:nth-child(2) {
  animation-delay: 0.2s;
}

.dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%,
  60%,
  100% {
    opacity: 0.3;
    transform: translateY(0);
  }

  30% {
    opacity: 1;
    transform: translateY(-3px);
  }
}

.loading-row {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 12px;
}

.loading-bubble {
  max-width: 75%;
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 16px;
  border-top-left-radius: 6px;
  background: #fff;
  color: #6b7280;
  padding: 10px 13px;
  font-size: 15px;
  line-height: 1.6;
  box-shadow: 0 2px 10px rgba(31, 41, 55, 0.05);
}

.scroll-anchor {
  height: 1px;
}

.input-bar {
  flex-shrink: 0;
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 10px 16px max(10px, env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1px solid #eceef5;
}

.chat-input {
  flex: 1;
  min-height: 42px;
  max-height: 112px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #f7f8fc;
  color: #1a1a2e;
  font-size: 15px;
  line-height: 1.6;
  padding: 8px 12px;
  resize: none;
  outline: none;
}

.chat-input:focus {
  border-color: #6e73f2;
  background: #fff;
}

.chat-input:disabled {
  color: #9ca3af;
}

.mic-btn {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border: none;
  border-radius: 50%;
  background: #F4F4F8;
  color: #6E73F2;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: visible;
  cursor: pointer;
  transition: all 0.2s;
}

.mic-btn:hover {
  background: #EEEDFE;
}

.mic-btn.recording {
  background: #FF4D4F;
  color: white;
  animation: subtle-pulse 1.5s ease-in-out infinite;
}

.mic-btn.processing {
  background: #eef0ff;
}

.mic-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

@keyframes subtle-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(255, 77, 79, 0.4);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(255, 77, 79, 0);
  }
}

.send-btn {
  width: 68px;
  height: 42px;
  border: none;
  border-radius: 12px;
  background: #6e73f2;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
}

.send-btn:disabled {
  background: #c5c8fb;
}

.history-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  font-size: 16px;
  font-weight: 500;
  border-bottom: 0.5px solid #eee;
}

.history-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
}

.history-item {
  padding: 14px 16px;
  border-bottom: 0.5px solid #eee;
  cursor: pointer;
}

.history-item:hover {
  background: #f8f8fa;
}

.history-item.active {
  background: #eeedfe;
}

.history-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.history-meta {
  font-size: 12px;
  color: #999;
}

.history-actions {
  padding: 16px;
  border-top: 0.5px solid #eee;
}
</style>
