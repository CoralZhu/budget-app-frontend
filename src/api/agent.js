import axios from 'axios'

const agentApi = axios.create({
  baseURL: 'http://localhost:8001',
  timeout: 60000,
})

export function checkAnomaly(userId, days = 7) {
  return agentApi.post('/api/agent/anomaly-check', { user_id: userId, days })
}

export function startBudgetChat(userId) {
  return agentApi.get('/api/agent/budget/start', { params: { user_id: userId } })
}

export function continueBudgetChat(userId, messages, conversationId = null) {
  return agentApi.post('/api/agent/budget/chat', {
    user_id: userId,
    messages,
    conversation_id: conversationId,
  })
}

export function listConversations(userId, agentType = 'budget_planner') {
  return agentApi.get('/api/agent/conversations', {
    params: { user_id: userId, agent_type: agentType },
  })
}

export function getConversationDetail(conversationId) {
  return agentApi.get(`/api/agent/conversations/${conversationId}`)
}
