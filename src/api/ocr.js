import request from './request'

export function recognizeReceipt(file) {
  const formData = new FormData()
  formData.append('file', file)

  return request
    .post('/api/ocr/receipt', formData, {
      timeout: 30000,
    })
    .then((response) => response.data)
}
