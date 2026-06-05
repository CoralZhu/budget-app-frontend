<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

onMounted(() => {
  setTimeout(() => {
    router.replace({ name: 'login' })
  }, 1800)
})
</script>

<template>
  <div class="splash">
    <div class="logo-box">
      <div class="logo-grid">
        <span class="lg-item">🤖</span>
        <span class="lg-item">📋</span>
        <span class="lg-item">✏️</span>
        <span class="lg-item">🥗</span>
      </div>
    </div>
    <h1 class="app-name">智能记账</h1>
    <p class="tagline">动嘴拍照就能记</p>
    <p class="tagline">AI 帮你看懂每一笔</p>
    <div class="dots">
      <span class="dot"></span>
      <span class="dot active"></span>
      <span class="dot"></span>
    </div>
    <p class="version">v1.0.0</p>
  </div>
</template>

<style scoped>
.splash {
  height: 100dvh;
  min-height: -webkit-fill-available;
  background: #6b6ef5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  position: relative;
}

.logo-box {
  width: 108px;
  height: 108px;
  background: white;
  border-radius: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 36px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.logo-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 12px;
}

.lg-item {
  font-size: 22px;
  text-align: center;
}

.app-name {
  font-size: 32px;
  font-weight: 700;
  letter-spacing: 2px;
  margin-bottom: 14px;
}

.tagline {
  font-size: 16px;
  opacity: 0.9;
  margin: 4px 0;
  letter-spacing: 0.5px;
}

.dots {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 56px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
}

.dot.active {
  width: 24px;
  border-radius: 4px;
  background: white;
}

.version {
  position: absolute;
  bottom: 48px;
  font-size: 13px;
  opacity: 0.5;
}
</style>
