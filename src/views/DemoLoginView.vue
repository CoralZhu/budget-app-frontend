<template>
  <div class="demo-login">
    <div class="demo-card">
      <h1>🤖 AI Budget Assistant</h1>
      <p class="subtitle">Personal finance with AI-powered insights</p>

      <div class="info-card">
        <strong>👋 Welcome</strong>
        <p>Two ways to explore this app:</p>
        <p><strong>Quick demo</strong> — Click "Enter Demo" below to instantly access a shared demo account (user_id=1, demo@example.com).</p>
        <p><strong>Own account</strong> — Click "Sign up" to create your own account. No email verification needed in this preview.</p>
        <p style="margin-top: 12px; font-size: 12px; color: #888;">All features are functional: AI anomaly detection · AI budget planning chat (streaming) · Transaction CRUD · OCR receipt recognition · Voice input · Categories · Budgets</p>
      </div>

      <button @click="enterDemo" class="demo-btn primary" :disabled="loading">
        {{ loading ? 'Entering Demo...' : 'Enter Demo (Shared Account)' }}
      </button>
      <button @click="goToRegister" class="demo-btn secondary">Sign Up (Your Own Account)</button>

      <div class="links">
        <a href="https://github.com/CoralZhu/budget-app-agent" target="_blank">View Agent Source on GitHub</a>
        <a href="https://budget-agent-oi5z.onrender.com/docs" target="_blank">API Documentation</a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { demoLogin } from '@/api/auth'

const router = useRouter()
const loading = ref(false)

async function enterDemo() {
  if (loading.value) return

  loading.value = true
  try {
    const { data } = await demoLogin()
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    router.push('/app/home')
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data || '演示模式进入失败，请稍后重试'
    showToast(message)
  } finally {
    loading.value = false
  }
}

function goToRegister() {
  router.push('/register')
}
</script>

<style scoped>
.demo-login {
  min-height: -webkit-fill-available;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #6E73F2 0%, #5550C8 100%);
  padding: 24px;
}

.demo-card {
  background: white;
  max-width: 480px;
  padding: 32px;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
}

.demo-card h1 {
  font-size: 24px;
  margin: 0 0 8px;
  color: #333;
}

.subtitle {
  color: #666;
  margin: 0 0 24px;
}

.info-card {
  background: #F0F4FF;
  border: 1px solid #C5D4F5;
  border-radius: 8px;
  padding: 16px;
  font-size: 13px;
  color: #2C3E50;
  margin-bottom: 20px;
  line-height: 1.5;
}

.info-card strong { color: #2D55B0; }
.info-card p { margin: 6px 0; }

.demo-btn {
  width: 100%;
  border: none;
  padding: 14px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.1s, background 0.2s;
  margin-bottom: 10px;
}

.demo-btn.primary {
  background: #6E73F2;
  color: white;
}

.demo-btn.primary:hover { background: #5550C8; }

.demo-btn.secondary {
  background: white;
  color: #6E73F2;
  border: 1.5px solid #6E73F2;
}

.demo-btn.secondary:hover {
  background: #F0F4FF;
}

.demo-btn:active { transform: scale(0.98); }

.links {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: center;
}

.links a {
  color: #6E73F2;
  text-decoration: none;
  font-size: 13px;
}

.links a:hover { text-decoration: underline; }
</style>
