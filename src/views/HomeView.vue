<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { use } from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { useAuthStore } from '@/stores/auth'
import { useTransactionsStore } from '@/stores/transactions'
import { useBudgetStore } from '@/stores/budget'

use([PieChart, LegendComponent, TooltipComponent, CanvasRenderer])

const router = useRouter()
const authStore = useAuthStore()
const txStore = useTransactionsStore()
const budgetStore = useBudgetStore()

const CATEGORY_COLORS = {
  餐饮: '#6b6ef5',
  交通: '#8b5cf6',
  购物: '#f59e0b',
  饮品: '#ec4899',
  教育: '#10b981',
  娱乐: '#f97316',
  医疗: '#06b6d4',
  其他: '#d1d5db',
}

const CATEGORY_ICONS = {
  餐饮: '🍴',
  饮品: '☕',
  交通: '🚇',
  购物: '🛍️',
  教育: '📚',
  娱乐: '🎮',
  医疗: '💊',
  工资: '💰',
  兼职: '💼',
  其他收入: '🎁',
}

function getCategoryBg(name) {
  const MAP = {
    餐饮: '#fff3e6',
    饮品: '#ede9fe',
    交通: '#dbeafe',
    购物: '#fce7f3',
    教育: '#d1fae5',
    娱乐: '#fef3c7',
    医疗: '#ccfbf1',
    工资: '#d1fae5',
  }
  return MAP[name] || '#f3f4f6'
}

const pieOption = computed(() => {
  const totals = txStore.categoryTotals
  const top3 = totals.slice(0, 3)
  const otherVal = totals.slice(3).reduce((s, c) => s + c.value, 0)
  const data = top3.map((c) => ({
    name: c.name,
    value: c.value,
    itemStyle: { color: CATEGORY_COLORS[c.name] || '#6b6ef5' },
  }))
  if (otherVal > 0) data.push({ name: '其他', value: otherVal, itemStyle: { color: '#d1d5db' } })
  return {
    series: [
      {
        type: 'pie',
        radius: ['52%', '72%'],
        center: ['50%', '50%'],
        data,
        label: { show: false },
        emphasis: { scale: false },
      },
    ],
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '38%',
        style: { text: '总计', fill: '#9ca3af', fontSize: 12 },
      },
      {
        type: 'text',
        left: 'center',
        top: '50%',
        style: {
          text: `¥${Math.round(txStore.monthlyExpense)}`,
          fill: '#1a1a2e',
          fontSize: 15,
          fontWeight: 'bold',
        },
      },
    ],
  }
})

const pieCategories = computed(() => {
  const totals = txStore.categoryTotals
  const total = txStore.monthlyExpense
  return totals.slice(0, 4).map((c) => ({
    ...c,
    pct: Math.round((c.value / total) * 100),
    color: CATEGORY_COLORS[c.name] || '#6b6ef5',
  }))
})

function formatTime(date) {
  const d = new Date(date)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return '昨天'
}
</script>

<template>
  <div class="page">
    <!-- Header -->
    <div class="header">
      <div>
        <p class="greeting">{{ authStore.greeting }} 👋</p>
        <h2 class="username">{{ authStore.user.username }}</h2>
      </div>
      <van-icon name="setting-o" size="22" color="#6b7280" />
    </div>

    <!-- Monthly Spend Card -->
    <div class="spend-card">
      <p class="card-label">本月已支出</p>
      <h1 class="spend-amount">¥ {{ txStore.monthlyExpense.toLocaleString('zh', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</h1>
      <p class="spend-compare">比上月多 12.5%</p>
      <div class="budget-row">
        <span>预算 ¥{{ budgetStore.totalBudget.toLocaleString() }}</span>
        <span class="budget-pct">{{ budgetStore.usagePercent }}%</span>
      </div>
      <van-progress
        :percentage="budgetStore.usagePercent"
        :show-pivot="false"
        stroke-width="8"
        color="white"
        track-color="rgba(255,255,255,0.3)"
        style="margin-top: 8px"
      />
    </div>

    <!-- Category Chart -->
    <div class="card">
      <div class="section-header">
        <span class="section-title">本月分类</span>
        <span class="link-btn" @click="router.push({ name: 'detail' })">完整报表</span>
      </div>
      <div class="chart-row">
        <v-chart :option="pieOption" style="height: 140px; width: 140px; flex-shrink: 0" />
        <div class="legend">
          <div v-for="cat in pieCategories" :key="cat.name" class="legend-item">
            <span class="legend-dot" :style="{ background: cat.color }"></span>
            <span class="legend-name">{{ cat.name }}</span>
            <span class="legend-pct">{{ cat.pct }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Transactions -->
    <div class="card">
      <div class="section-header">
        <span class="section-title">最近记录</span>
        <span class="link-btn" @click="router.push({ name: 'detail' })">查看全部</span>
      </div>
      <div
        v-for="tx in txStore.recentFive"
        :key="tx.id"
        class="tx-item"
        @click="router.push({ name: 'edit-transaction', params: { id: tx.id } })"
      >
        <div class="tx-icon" :style="{ background: getCategoryBg(tx.categoryName) }">
          {{ CATEGORY_ICONS[tx.categoryName] || '💳' }}
        </div>
        <div class="tx-info">
          <p class="tx-name">{{ tx.merchant }}</p>
          <p class="tx-meta">{{ tx.categoryName }} · {{ formatTime(tx.spentAt) }}</p>
        </div>
        <span class="tx-amount">-¥{{ tx.amount }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  padding: 0 16px 16px;
  background: #f3f4f8;
  min-height: 100%;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 4px 16px;
}

.greeting {
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 2px;
}

.username {
  font-size: 22px;
  font-weight: 700;
}

.spend-card {
  background: linear-gradient(135deg, #6b6ef5 0%, #8b8ff8 100%);
  border-radius: 20px;
  padding: 20px 20px 22px;
  color: white;
  margin-bottom: 16px;
}

.card-label {
  font-size: 14px;
  opacity: 0.85;
  margin-bottom: 6px;
}

.spend-amount {
  font-size: 36px;
  font-weight: 700;
  letter-spacing: -1px;
  margin-bottom: 4px;
}

.spend-compare {
  font-size: 13px;
  opacity: 0.8;
  margin-bottom: 16px;
}

.budget-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 6px;
}

.budget-pct {
  font-weight: 600;
}

.card {
  background: white;
  border-radius: 20px;
  padding: 18px 18px;
  margin-bottom: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
}

.link-btn {
  font-size: 14px;
  color: #6b6ef5;
  cursor: pointer;
}

.chart-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.legend {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-name {
  flex: 1;
  font-size: 14px;
  color: #374151;
}

.legend-pct {
  font-size: 14px;
  color: #6b7280;
}

.tx-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f5f6fa;
  cursor: pointer;
}

.tx-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.tx-icon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tx-info {
  flex: 1;
}

.tx-name {
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 3px;
}

.tx-meta {
  font-size: 13px;
  color: #9ca3af;
}

.tx-amount {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
}
</style>
