import request from './request'

export function upsertBudget(data) {
  return request.post('/api/budgets', data)
}

export function getBudgets(yearMonth) {
  return request.get('/api/budgets', { params: { yearMonth } })
}

export function deleteBudget(id) {
  return request.delete(`/api/budgets/${id}`)
}
