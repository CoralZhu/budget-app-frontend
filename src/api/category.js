import request from './request'

export function getCategories(type) {
  return request.get('/api/categories', { params: type ? { type } : {} })
}

export function createCategory(data) {
  return request.post('/api/categories', data)
}

export function deleteCategory(id) {
  return request.delete(`/api/categories/${id}`)
}
