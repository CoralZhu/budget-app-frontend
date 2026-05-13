import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const user = ref({
    id: 1,
    username: 'Larpys',
    email: '123456789@example.com',
    avatarUrl: null,
    gender: '男',
    bio: '像风一样',
  })
  const token = ref(localStorage.getItem('token') || 'mock-token-for-dev')

  const isLoggedIn = computed(() => !!token.value)

  const greeting = computed(() => {
    const h = new Date().getHours()
    if (h < 6) return '凌晨好'
    if (h < 12) return '早上好'
    if (h < 14) return '中午好'
    if (h < 18) return '下午好'
    return '晚上好'
  })

  function login(userData, authToken) {
    user.value = { ...user.value, ...userData }
    token.value = authToken
    localStorage.setItem('token', authToken)
  }

  function logout() {
    token.value = null
    localStorage.removeItem('token')
  }

  function updateUser(updates) {
    Object.assign(user.value, updates)
  }

  return { user, token, isLoggedIn, greeting, login, logout, updateUser }
})
