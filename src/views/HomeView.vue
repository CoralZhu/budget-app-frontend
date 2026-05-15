<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { use } from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { GraphicComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { getTransactions } from '@/api/transaction'
import { useAuthStore } from '@/stores/auth'
import { useTransactionsStore } from '@/stores/transactions'
import { useBudgetStore } from '@/stores/budget'
import {
  formatTransactionAmount,
  getTransactionIcon,
  getTransactionIconBg,
  getTransactionMeta,
  getTransactionTitle,
  getTransactionCategory,
} from '@/utils/transactionDisplay'

use([PieChart, GraphicComponent, LegendComponent, TooltipComponent, CanvasRenderer])

const router = useRouter()
const authStore = useAuthStore()
const txStore = useTransactionsStore()
const budgetStore = useBudgetStore()
const previousMonthExpense = ref(0)

const CATEGORY_COLORS = {
  餐饮: '#6E73F2',
  交通: '#8B7DF7',
  购物: '#f59e0b',
  饮品: '#ec4899',
  教育: '#10b981',
  娱乐: '#ef4444',
  医疗: '#14b8a6',
  其他: '#94a3b8',
}

function toMonthParam(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function normalizeTransaction(tx) {
  return {
    ...tx,
    amount: Number(tx.amount || 0),
    categoryName: tx.categoryName || tx.category || '其他',
    merchant: tx.merchant || '',
    note: tx.note || '',
    spentAt: new Date(tx.spentAt),
  }
}

function sumExpense(items) {
  return items
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
}

const currentMonthExpense = computed(() => sumExpense(txStore.currentMonth))

const monthlyCompare = computed(() => {
  const previous = previousMonthExpense.value
  if (previous <= 0) {
    return { text: '上月无记录', trend: 'neutral' }
  }

  const diff = currentMonthExpense.value - previous
  const percent = Math.abs((diff / previous) * 100).toFixed(1)

  if (diff > 0) {
    return { text: `比上月多 ${percent}%`, trend: 'up' }
  }

  if (diff < 0) {
    return { text: `比上月少 ${percent}%`, trend: 'down' }
  }

  return { text: '与上月持平', trend: 'neutral' }
})

async function loadMonthlyStats() {
  const now = new Date()
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  try {
    const [currentRes, previousRes] = await Promise.all([
      getTransactions({ month: toMonthParam(now) }),
      getTransactions({ month: toMonthParam(previousMonth) }),
    ])

    txStore.setTransactions(currentRes.data.map(normalizeTransaction))
    previousMonthExpense.value = sumExpense(previousRes.data)
  } catch (error) {
    showToast(error.response?.data?.message || '获取月度统计失败')
  }
}

onMounted(loadMonthlyStats)

const categoryBreakdown = computed(() => {
  const totals = {}
  txStore.currentMonth
    .filter((tx) => tx.type === 'expense')
    .forEach((tx) => {
      const category = getTransactionCategory(tx)
      totals[category] = (totals[category] || 0) + Number(tx.amount || 0)
    })

  const total = Object.values(totals).reduce((sum, value) => sum + value, 0)
  const sorted = Object.entries(totals)
    .map(([name, value]) => ({
      name,
      value,
      pct: total > 0 ? Math.round((value / total) * 100) : 0,
      color: CATEGORY_COLORS[name] || CATEGORY_COLORS.其他,
    }))
    .sort((a, b) => b.value - a.value)

  const top = sorted.slice(0, 4)
  const restValue = sorted.slice(4).reduce((sum, item) => sum + item.value, 0)
  if (restValue > 0) {
    top.push({
      name: '其他',
      value: restValue,
      pct: Math.round((restValue / total) * 100),
      color: CATEGORY_COLORS.其他,
    })
  }

  return { total, items: top }
})

const monthlyExpenseText = computed(() =>
  Math.round(categoryBreakdown.value.total).toLocaleString('zh-CN'),
)

const pieOption = computed(() => {
  const data = categoryBreakdown.value.items.map((c) => ({
    name: c.name,
    value: c.value,
    itemStyle: { color: c.color },
  }))

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
        top: '35%',
        style: { text: '本月', fill: '#9ca3af', fontSize: 12, textAlign: 'center' },
      },
      {
        type: 'text',
        left: 'center',
        top: '49%',
        style: {
          text: `¥${monthlyExpenseText.value}`,
          fill: '#1a1a2e',
          fontSize: 15,
          fontWeight: 'bold',
          textAlign: 'center',
        },
      },
    ],
  }
})

const pieCategories = computed(() => categoryBreakdown.value.items)

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
      <h1 class="spend-amount">¥ {{ currentMonthExpense.toLocaleString('zh', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</h1>
      <p :class="['spend-compare', monthlyCompare.trend]">{{ monthlyCompare.text }}</p>
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
        @click="router.push({ name: 'detail' })"
      >
        <div class="tx-icon" :style="{ background: getTransactionIconBg(tx) }">
          {{ getTransactionIcon(tx) }}
        </div>
        <div class="tx-info">
          <p class="tx-name">{{ getTransactionTitle(tx) }}</p>
          <p class="tx-meta">{{ getTransactionMeta(tx) }}</p>
        </div>
        <span :class="['tx-amount', tx.type === 'income' ? 'income' : '']">
          {{ formatTransactionAmount(tx) }}
        </span>
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

.spend-compare.up {
  color: #ffe4e6;
  opacity: 1;
}

.spend-compare.down {
  color: #bbf7d0;
  opacity: 1;
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

.tx-amount.income {
  color: #10b981;
}
</style>
