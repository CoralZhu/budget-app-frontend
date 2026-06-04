<template>
  <div class="demo-login">
    <div class="demo-card">
      <h1>🤖 AI Budget Assistant</h1>
      <p class="subtitle">Personal finance with AI-powered insights</p>

      <div class="warning">
        <strong>⚠️ Demo Mode</strong>
        <p>This is a public demo with limited functionality. Spring Boot backend (transactions CRUD, user management) is not deployed in this preview. Only AI agent features are functional.</p>
        <p><strong>Working:</strong> AI anomaly detection · AI budget planning chat (streaming)</p>
        <p><strong>Not working:</strong> Adding transactions · Login · Real budget management</p>
      </div>

      <button @click="enterDemo" class="demo-btn">Enter Demo</button>

      <div class="links">
        <a href="https://github.com/CoralZhu/budget-app-agent" target="_blank">View Agent Source on GitHub</a>
        <a href="https://budget-agent-oi5z.onrender.com/docs" target="_blank">API Documentation</a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()

function enterDemo() {
  // 注入一个 demo JWT token（你需要在 backend 上生成一个长期有效的演示 token，
  // 或者用一个 dummy token——如果 Agent 的 JWT 验证还要解 userId，
  // 必须用真实 token。建议：用 user_id=1 生成一个 30 天有效期的 token，写死在这里）

  // ⚠️ 暂时占位：用户需要手动填一个真实 token 替换 'DEMO_TOKEN'
  const demoToken = "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZW1vQGV4YW1wbGUuY29tIiwidXNlcklkIjoxLCJlbWFpbCI6ImRlbW9AZXhhbXBsZS5jb20iLCJpYXQiOjE3ODA1MzY5ODQsImV4cCI6MTc4MzEyODk4NH0.8MUK39pDkpPHZTcaaHjMgacvLtW0y5CPulkvGQK1sJnXPWgpWt-1lWKx_c1V_fIauXOFshIdxi-cqAhFRnuf_A"
  localStorage.setItem('token', demoToken)

  router.push('/app/home')
}
</script>

<style scoped>
.demo-login {
  min-height: 100vh;
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

.warning {
  background: #FFF4E6;
  border: 1px solid #FFE0B2;
  border-radius: 8px;
  padding: 16px;
  font-size: 13px;
  color: #5D4037;
  margin-bottom: 20px;
  line-height: 1.5;
}

.warning strong { color: #E65100; }
.warning p { margin: 6px 0; }

.demo-btn {
  width: 100%;
  background: #6E73F2;
  color: white;
  border: none;
  padding: 14px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.1s;
}

.demo-btn:hover { background: #5550C8; }
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
