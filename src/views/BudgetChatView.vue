<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { continueBudgetChat, startBudgetChat } from '@/api/agent'

const router = useRouter()

const messages = ref([])
const inputText = ref('')
const isLoading = ref(false)
const loadingText = ref('AI 正在初始化...')
const bottomRef = ref(null)

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
    const response = await startBudgetChat(1)
    const data = unwrapData(response)
    messages.value = Array.isArray(data.messages) ? data.messages : []
    await scrollToBottom('auto')
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    isLoading.value = false
  }
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
    const response = await continueBudgetChat(1, messages.value)
    const data = unwrapData(response)
    if (Array.isArray(data.messages)) {
      messages.value = data.messages
    }
    await scrollToBottom()

    if (data.budget_saved) {
      showToast({ message: '✅ 预算已保存成功！', icon: 'success' })
      window.setTimeout(() => {
        router.push('/budget')
      }, 2000)
    }
  } catch (error) {
    showToast(getErrorMessage(error))
  } finally {
    isLoading.value = false
    await scrollToBottom()
  }
}

onMounted(initChat)
</script>

<template>
  <div class="chat-page">
    <div class="nav-bar">
      <van-icon name="arrow-left" size="22" class="back-icon" @click="router.back()" />
      <span class="nav-title">AI 预算规划</span>
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

.nav-placeholder {
  width: 44px;
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
</style>
