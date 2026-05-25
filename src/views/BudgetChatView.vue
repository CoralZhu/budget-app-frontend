<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import {
  continueBudgetChat,
  getConversationDetail,
  listConversations,
  startBudgetChat,
} from '@/api/agent'

const route = useRoute()
const router = useRouter()

const messages = ref([])
const inputText = ref('')
const isLoading = ref(false)
const loadingText = ref('AI 正在初始化...')
const bottomRef = ref(null)
const conversationId = ref(null)
const showHistoryPopup = ref(false)
const historyList = ref([])

const visibleMessages = computed(() =>
  messages.value.filter((message) => {
    return (message.role === 'user' || message.role === 'assistant') && message.content
  }),
)

function unwrapData(response) {
  return response.data?.data || response.data || {}
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
      : await startBudgetChat(1)
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
  inputText.value = ''
  loadingText.value = '🔧 AI 正在查询数据...'
  await scrollToBottom()

  try {
    isLoading.value = true
    const response = await continueBudgetChat(1, messages.value, conversationId.value)
    const data = unwrapData(response)
    if (Array.isArray(data.messages)) {
      messages.value = data.messages
    }
    conversationId.value = data.conversation_id || conversationId.value
    await scrollToBottom()

    if (data.budget_saved) {
      showToast({ message: '✅ 预算已保存成功！', type: 'success' })
      window.setTimeout(() => {
        router.push('/budget')
      }, 2000)
    }
  } catch (error) {
    console.error('AI 请求失败:', error)
    showToast(getErrorMessage(error))
  } finally {
    isLoading.value = false
    await scrollToBottom()
  }
}

watch(showHistoryPopup, async (val) => {
  if (!val) return

  try {
    const response = await listConversations(1, 'budget_planner')
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

onMounted(initChat)
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
        <div class="message-bubble">{{ message.content }}</div>
      </div>

      <div v-if="isLoading" class="loading-row">
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
