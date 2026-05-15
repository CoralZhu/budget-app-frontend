<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { register, sendCode as sendVerificationCode } from '@/api/auth'
import { showToast } from 'vant'

const router = useRouter()

const nickname = ref('')
const email = ref('')
const code = ref('')
const password = ref('')
const agreed = ref(false)
const loading = ref(false)
const codeLoading = ref(false)
const countdown = ref(0)

let timer = null

async function sendCode() {
  if (!email.value) {
    showToast('请输入邮箱')
    return
  }
  if (countdown.value > 0) return

  codeLoading.value = true
  try {
    await sendVerificationCode({ email: email.value })
    showToast('验证码已发送')
    countdown.value = 60
    timer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) clearInterval(timer)
    }, 1000)
  } catch (error) {
    showToast(error.response?.data?.message || '验证码发送失败')
  } finally {
    codeLoading.value = false
  }
}

async function handleRegister() {
  if (!nickname.value || !email.value || !code.value || !password.value) {
    showToast('请完整填写注册信息')
    return
  }
  if (!agreed.value) {
    showToast('请同意用户协议和隐私政策')
    return
  }
  loading.value = true
  try {
    await register({
      username: nickname.value,
      email: email.value,
      password: password.value,
      code: code.value,
    })

    showToast('注册成功，请登录')
    router.replace({ name: 'login' })
  } catch (error) {
    showToast(error.response?.data?.message || '注册失败，请稍后重试')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page">
    <h1 class="title">创建账号</h1>
    <p class="subtitle">几步搞定，开启你的智能记账之旅</p>

    <div class="form">
      <p class="field-label">昵称</p>
      <van-field v-model="nickname" placeholder="Larpys" class="field" :border="false" />

      <p class="field-label mt">邮箱</p>
      <van-field
        v-model="email"
        type="email"
        placeholder="用于登录和找回密码"
        class="field"
        :border="false"
      />

      <p class="field-label mt">验证码</p>
      <div class="code-row">
        <van-field
          v-model="code"
          placeholder="6 位数字"
          class="field code-field"
          :border="false"
        />
        <van-button
          class="code-btn"
          :disabled="countdown > 0"
          :loading="codeLoading"
          @click="sendCode"
        >
          {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
        </van-button>
      </div>

      <p class="field-label mt">密码</p>
      <van-field
        v-model="password"
        type="password"
        placeholder="至少 8 位，含字母和数字"
        class="field"
        :border="false"
      />

      <van-checkbox
        v-model="agreed"
        icon-size="18px"
        checked-color="#6b6ef5"
        style="margin-top: 20px"
      >
        <span class="agree-text">
          已阅读并同意
          <span class="link">用户协议</span>
          和
          <span class="link">隐私政策</span>
        </span>
      </van-checkbox>

      <van-button
        type="primary"
        block
        :loading="loading"
        class="reg-btn"
        @click="handleRegister"
      >
        注册
      </van-button>

      <p class="login-hint">
        已有账号?
        <router-link to="/login" class="link">立即登录</router-link>
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

.mt {
  margin-top: 20px;
}

.field {
  background: #f5f6fa;
  border-radius: 12px;
  padding: 4px 16px;
}

.code-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.code-field {
  flex: 1;
}

.code-btn {
  flex-shrink: 0;
  height: 48px;
  padding: 0 16px;
  border-radius: 12px;
  background: #eaebfe;
  color: #6b6ef5;
  border: none;
  font-size: 14px;
  font-weight: 500;
}

.code-btn:disabled {
  opacity: 0.6;
}

.agree-text {
  font-size: 14px;
  color: #6b7280;
}

.link {
  color: #6b6ef5;
  text-decoration: none;
}

.reg-btn {
  margin-top: 28px;
  height: 52px;
  font-size: 16px;
  border-radius: 14px !important;
}

.login-hint {
  margin-top: 20px;
  text-align: center;
  font-size: 14px;
  color: #6b7280;
}
</style>
