import request from './request'

export function getInsights(force = false) {
  return request
    .get('/api/ai/insights', {
      params: { force },
      timeout: 30000,
    })
    .then((response) => response.data)
}
