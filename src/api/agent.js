import axios from 'axios'

const agentApi = axios.create({
  baseURL: import.meta.env.VITE_AGENT_BASE_URL,
  timeout: 60000,
})

agentApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

agentApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('JWT 失效或缺失，跳转登录页')
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export function checkAnomaly(days = 7) {
  return agentApi.post('/api/agent/anomaly-check', { days })
}

export function startBudgetChat() {
  return agentApi.get('/api/agent/budget/start')
}

export function continueBudgetChat(messages, conversationId = null) {
  return agentApi.post('/api/agent/budget/chat', {
    messages,
    conversation_id: conversationId,
  })
}

export function listConversations(agentType = 'budget_planner') {
  return agentApi.get('/api/agent/conversations', {
    params: { agent_type: agentType },
  })
}

export function getConversationDetail(conversationId) {
  return agentApi.get(`/api/agent/conversations/${conversationId}`)
}
