import request from './request'

export function createTransaction(data) {
  return request.post('/api/transactions', data)
}

export function getTransactions(params) {
  return request.get('/api/transactions', { params })
}

export function updateTransaction(id, data) {
  return request.put(`/api/transactions/${id}`, data)
}

export function deleteTransaction(id) {
  return request.delete(`/api/transactions/${id}`)
}
