import request from './request'

export function register(data) {
  return request.post('/api/auth/register', data)
}

export function login(data) {
  return request.post('/api/auth/login', data)
}

export function demoLogin() {
  return request.post('/api/auth/demo')
}

export function sendCode(data) {
  return request.post('/api/auth/send-code', data)
}
