<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { login } from '@/api/auth'
import { showToast } from 'vant'

const router = useRouter()
const authStore = useAuthStore()

const account = ref('')
const password = ref('')
const remember = ref(false)
const loading = ref(false)

async function handleLogin() {
  const normalizedAccount = account.value.trim()

  if (!normalizedAccount || !password.value) {
    showToast('请填写账号和密码')
    return
  }
  loading.value = true
  try {
    const { data } = await login({
      account: normalizedAccount,
      password: password.value,
    })

    localStorage.setItem('token', data.token)
    authStore.login(data.user, data.token)
    showToast('登录成功')
    router.replace('/app/home')
  } catch (error) {
    if (!error.response) {
      showToast('无法连接服务器，请确认后端已启动')
    } else if (error.response.status >= 500) {
      showToast('服务器异常，请稍后重试')
    } else {
      showToast(error.response?.data?.message || '邮箱/昵称或密码错误')
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page">
    <div class="robot-icon">🤖</div>
    <h1 class="title">欢迎回来</h1>
    <p class="subtitle">登录账号继续使用智能记账</p>

    <div class="form">
      <p class="field-label">邮箱 / 昵称</p>
      <van-field
        v-model="account"
        placeholder="请输入邮箱或昵称"
        class="field"
        :border="false"
      />

      <p class="field-label" style="margin-top: 20px">密码</p>
      <van-field
        v-model="password"
        type="password"
        placeholder="请输入密码"
        class="field"
        :border="false"
      />

      <div class="row-between" style="margin-top: 14px">
        <van-checkbox v-model="remember" icon-size="18px" checked-color="#6b6ef5">
          记住我
        </van-checkbox>
        <span class="link">忘记密码?</span>
      </div>

      <van-button
        type="primary"
        block
        :loading="loading"
        class="login-btn"
        @click="handleLogin"
      >
        登录
      </van-button>

      <div class="divider">
        <span class="line"></span>
        <span class="or-text">或</span>
        <span class="line"></span>
      </div>

      <p class="register-hint">
        还没有账号?
        <router-link to="/register" class="link">立即注册</router-link>
      </p>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: white;
  padding: 64px 28px 40px;
}

.robot-icon {
  width: 72px;
  height: 72px;
  background: #eaebfe;
  border-radius: 20px;
  font-size: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 32px;
}

.title {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
}

.subtitle {
  font-size: 15px;
  color: #6b7280;
  margin-bottom: 36px;
}

.field-label {
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 8px;
}

.field {
  background: #f5f6fa;
  border-radius: 12px;
  padding: 4px 16px;
}

:deep(.van-field__control) {
  font-size: 15px;
}

.row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.link {
  color: #6b6ef5;
  font-size: 14px;
  cursor: pointer;
  text-decoration: none;
}

.login-btn {
  margin-top: 32px;
  height: 52px;
  font-size: 16px;
  border-radius: 14px !important;
}

.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 28px 0;
}

.line {
  flex: 1;
  height: 1px;
  background: #e5e7eb;
}

.or-text {
  font-size: 14px;
  color: #9ca3af;
}

.register-hint {
  text-align: center;
  font-size: 14px;
  color: #6b7280;
}
</style>
