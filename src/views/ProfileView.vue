<script setup>
import { useRouter } from 'vue-router'
import { showConfirmDialog } from 'vant'
import { useAuthStore } from '@/stores/auth'
import { useBudgetStore } from '@/stores/budget'
import { useCategoriesStore } from '@/stores/categories'

const router = useRouter()
const authStore = useAuthStore()
const budgetStore = useBudgetStore()
const catStore = useCategoriesStore()

async function handleLogout() {
  await showConfirmDialog({ title: '退出登录', message: '确定要退出当前账号吗?' })
  authStore.logout()
  router.replace({ name: 'login' })
}
</script>

<template>
  <div class="page">
    <!-- Header -->
    <div class="header">
      <div class="avatar-wrap">
        <div class="avatar">
          {{ authStore.user.username.charAt(0).toUpperCase() }}
        </div>
      </div>
      <div class="user-info">
        <h2 class="username">{{ authStore.user.username }}</h2>
        <p class="email">{{ authStore.user.email }}</p>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-card">
      <div class="stat-item">
        <p class="stat-val">42</p>
        <p class="stat-label">本月记录</p>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <p class="stat-val primary">68%</p>
        <p class="stat-label">AI 自动率</p>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <p class="stat-val">128</p>
        <p class="stat-label">连续天数</p>
      </div>
    </div>

    <!-- Settings section -->
    <p class="section-label">设置</p>
    <div class="menu-card">
      <div class="menu-item" @click="router.push({ name: 'budget' })">
        <div class="menu-icon" style="background: #eaebfe">
          <van-icon name="setting-o" color="#6b6ef5" size="20" />
        </div>
        <span class="menu-text">预算管理</span>
        <span class="menu-desc">¥{{ budgetStore.totalBudget.toLocaleString() }}/月</span>
        <van-icon name="arrow" color="#d1d5db" size="16" />
      </div>
      <div class="divider"></div>
      <div class="menu-item" @click="router.push({ name: 'category' })">
        <div class="menu-icon" style="background: #fef3c7">
          <van-icon name="apps-o" color="#d97706" size="20" />
        </div>
        <span class="menu-text">分类管理</span>
        <span class="menu-desc">{{ catStore.categories.length }} 个</span>
        <van-icon name="arrow" color="#d1d5db" size="16" />
      </div>
    </div>

    <!-- Data section -->
    <p class="section-label">数据管理</p>
    <div class="menu-card">
      <div class="menu-item" @click="router.push({ name: 'import' })">
        <div class="menu-icon" style="background: #eef0fe">
          <van-icon name="down" color="#6e73f2" size="20" />
        </div>
        <span class="menu-text">导入账单</span>
        <span class="menu-desc">支持支付宝、微信账单 CSV</span>
        <van-icon name="arrow" color="#d1d5db" size="16" />
      </div>
    </div>

    <!-- Account section -->
    <p class="section-label">账户</p>
    <div class="menu-card">
      <div class="menu-item" @click="router.push({ name: 'personal-info' })">
        <div class="menu-icon" style="background: #dbeafe">
          <van-icon name="contact-o" color="#2563eb" size="20" />
        </div>
        <span class="menu-text">个人信息</span>
        <van-icon name="arrow" color="#d1d5db" size="16" />
      </div>
      <div class="divider"></div>
      <div class="menu-item">
        <div class="menu-icon" style="background: #fce7f3">
          <van-icon name="shield-o" color="#db2777" size="20" />
        </div>
        <span class="menu-text">隐私与安全</span>
        <van-icon name="arrow" color="#d1d5db" size="16" />
      </div>
      <div class="divider"></div>
      <div class="menu-item">
        <div class="menu-icon" style="background: #f3f4f6">
          <van-icon name="question-o" color="#6b7280" size="20" />
        </div>
        <span class="menu-text">帮助与反馈</span>
        <van-icon name="arrow" color="#d1d5db" size="16" />
      </div>
    </div>

    <!-- Logout -->
    <div class="menu-card logout-card" @click="handleLogout">
      <div class="menu-item">
        <div class="menu-icon" style="background: #fee2e2">
          <van-icon name="logistics" color="#ef4444" size="20" />
        </div>
        <span class="menu-text red">退出登录</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100%;
  background: #f3f4f8;
}

.header {
  background: linear-gradient(135deg, #6b6ef5 0%, #8b8ff8 100%);
  padding: 48px 24px 32px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar-wrap {}

.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: white;
  color: #6b6ef5;
  font-size: 26px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid rgba(255, 255, 255, 0.4);
}

.user-info {}

.username {
  font-size: 20px;
  font-weight: 700;
  color: white;
  margin-bottom: 4px;
}

.email {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.75);
}

.stats-card {
  background: white;
  margin: -1px 16px 0;
  border-radius: 20px;
  display: flex;
  align-items: center;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  position: relative;
  z-index: 1;
  margin-bottom: 20px;
}

.stat-item {
  flex: 1;
  text-align: center;
}

.stat-val {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 4px;
}

.stat-val.primary {
  color: #6b6ef5;
}

.stat-label {
  font-size: 12px;
  color: #9ca3af;
}

.stat-divider {
  width: 1px;
  height: 36px;
  background: #f0f0f5;
}

.section-label {
  font-size: 13px;
  color: #9ca3af;
  padding: 0 20px;
  margin-bottom: 8px;
}

.menu-card {
  background: white;
  border-radius: 20px;
  margin: 0 16px 16px;
  padding: 4px 0;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  cursor: pointer;
}

.menu-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.menu-text {
  flex: 1;
  font-size: 15px;
  font-weight: 500;
}

.menu-text.red {
  color: #ef4444;
}

.menu-desc {
  font-size: 14px;
  color: #9ca3af;
  margin-right: 4px;
}

.divider {
  height: 1px;
  background: #f5f6fa;
  margin: 0 16px;
}

.logout-card {
  margin-bottom: 24px;
}
</style>
