import request from './request'

export function importAlipay(file) {
  const formData = new FormData()
  formData.append('file', file)

  return request
    .post('/api/import/alipay', formData, {
      timeout: 30000,
    })
    .then((response) => response.data)
}

export function importWechat(file) {
  const formData = new FormData()
  formData.append('file', file)

  return request
    .post('/api/import/wechat', formData, {
      timeout: 30000,
    })
    .then((response) => response.data)
}
