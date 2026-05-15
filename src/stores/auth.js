import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const defaultUser = {
    id: null,
    username: '',
    email: '',
    avatarUrl: null,
    gender: '男',
    bio: '',
  }

  const user = ref({ ...defaultUser })
  const token = ref(null)

  function initAuth() {
    token.value = localStorage.getItem('token')

    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      user.value = { ...defaultUser, ...JSON.parse(storedUser) }
    }
  }

  initAuth()

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
    user.value = { ...defaultUser, ...userData }
    token.value = authToken
    localStorage.setItem('token', authToken)
    localStorage.setItem('user', JSON.stringify(userData))
  }

  function logout() {
    user.value = { ...defaultUser }
    token.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  function updateUser(updates) {
    user.value = { ...user.value, ...updates }
    localStorage.setItem('user', JSON.stringify(user.value))
  }

  return { user, token, isLoggedIn, greeting, initAuth, login, logout, updateUser }
})
