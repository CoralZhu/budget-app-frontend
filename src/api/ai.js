import request from './request'

export function parseVoice(text) {
  return request
    .post('/api/ai/parse-voice', { text }, { timeout: 30000 })
    .then((response) => response.data)
}
