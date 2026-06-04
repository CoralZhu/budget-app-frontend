<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showDialog, showToast } from 'vant'
import { use } from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { GraphicComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { checkAnomaly } from '@/api/agent.js'
import { getBudgets } from '@/api/budget'
import { getTransactions } from '@/api/transaction'
import { useAuthStore } from '@/stores/auth'
import { useTransactionsStore } from '@/stores/transactions'
import { getCurrentYearMonth } from '@/utils/date'
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
const previousMonthExpense = ref(0)
const monthlyBudget = ref(null)
const anomalyData = ref(null)
const anomalyLoading = ref(false)
const anomalyDismissed = ref(false)
const ACK_KEY = 'acked_anomaly_transactions'

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

function getAckedIds() {
  try {
    const raw = localStorage.getItem(ACK_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    return []
  }
}

function addAckedIds(ids) {
  const current = getAckedIds()
  const merged = [...new Set([...current, ...ids])]
  localStorage.setItem(ACK_KEY, JSON.stringify(merged))
}

function toMonthParam(date) {
  return getCurrentYearMonth(date)
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

function unwrapList(response) {
  const data = response.data
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.transactions)) return data.transactions
  if (Array.isArray(data?.budgets)) return data.budgets
  return []
}

function sumExpense(items) {
  return items
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
}

const currentMonthExpense = computed(() => sumExpense(txStore.currentMonth))

const monthlyBudgetAmount = computed(() => Number(monthlyBudget.value?.amount || 0))

const budgetUsagePercent = computed(() => {
  if (monthlyBudgetAmount.value <= 0) return 0
  return Math.round((currentMonthExpense.value / monthlyBudgetAmount.value) * 100)
})

const budgetProgressPercent = computed(() => Math.min(budgetUsagePercent.value, 100))

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
    const [currentRes, previousRes, budgetRes] = await Promise.all([
      getTransactions({ month: toMonthParam(now) }),
      getTransactions({ month: toMonthParam(previousMonth) }),
      getBudgets(toMonthParam(now)),
    ])

    txStore.setTransactions(unwrapList(currentRes).map(normalizeTransaction))
    previousMonthExpense.value = sumExpense(unwrapList(previousRes))
    const budgetList = unwrapList(budgetRes)
    monthlyBudget.value = budgetList.find((budget) => !budget.category) || null
  } catch (error) {
    showToast(error.response?.data?.message || '获取月度统计失败')
  }
}

onMounted(loadMonthlyStats)

onMounted(async () => {
  anomalyLoading.value = true
  try {
    const { data } = await checkAnomaly(7)
    if (data.has_anomaly && data.anomalies.length > 0) {
      const ackedIds = getAckedIds()
      const filtered = data.anomalies.filter(
        (anomaly) => !ackedIds.includes(anomaly.transaction_id),
      )

      if (filtered.length > 0) {
        anomalyData.value = {
          ...data,
          anomalies: filtered,
          summary: `最近7天发现 ${filtered.length} 笔异常消费`,
        }
      }
    }
  } catch (err) {
    console.error('异常检测调用失败:', err)
  } finally {
    anomalyLoading.value = false
  }
})

function showAnomalyDetail() {
  const details = anomalyData.value.anomalies
    .map(
      (anomaly) =>
        `• ${anomaly.category} ¥${anomaly.amount} (${anomaly.merchant})\n  ${anomaly.reason}`,
    )
    .join('\n\n')

  showDialog({
    title: '⚠️ 异常消费详情',
    message: details,
    confirmButtonText: '我知道了',
    messageAlign: 'left',
  }).then(() => {
    if (anomalyData.value) {
      const ids = anomalyData.value.anomalies.map((anomaly) => anomaly.transaction_id)
      addAckedIds(ids)
    }
    anomalyDismissed.value = true
  })
}

function dismissAnomaly() {
  if (anomalyData.value) {
    const ids = anomalyData.value.anomalies.map((anomaly) => anomaly.transaction_id)
    addAckedIds(ids)
  }
  anomalyDismissed.value = true
}

function goToAIChat() {
  router.push('/budget-chat')
}

function goToBudget() {
  router.push('/budget')
}

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
    <transition name="slide-down">
      <div v-if="anomalyData && !anomalyDismissed" class="anomaly-alert" @click="showAnomalyDetail">
        <div class="anomaly-icon">⚠️</div>
        <div class="anomaly-content">
          <div class="anomaly-title">AI 发现 {{ anomalyData.anomalies.length }} 笔异常消费</div>
          <div class="anomaly-summary">{{ anomalyData.summary }}</div>
        </div>
        <div class="anomaly-close" @click.stop="dismissAnomaly">×</div>
      </div>
    </transition>

    <!-- Header -->
    <div class="header">
      <div>
        <p class="greeting">{{ authStore.greeting }} 👋</p>
        <h2 class="username">{{ authStore.user.username }}</h2>
      </div>
      <div class="ai-entry" @click="goToAIChat">
        <van-icon name="chat-o" size="18" color="#6E73F2" />
        <span class="ai-label">AI 助手</span>
      </div>
    </div>

    <!-- Monthly Spend Card -->
    <div class="spend-card clickable-card" @click="goToBudget">
      <p class="card-label">本月已支出</p>
      <h1 class="spend-amount">
        ¥
        {{
          currentMonthExpense.toLocaleString('zh', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        }}
      </h1>
      <p :class="['spend-compare', monthlyCompare.trend]">{{ monthlyCompare.text }}</p>
      <div v-if="monthlyBudget" class="budget-row">
        <span>预算 ¥{{ monthlyBudgetAmount.toFixed(0) }}</span>
        <span class="budget-pct">{{ budgetUsagePercent }}%</span>
      </div>
      <div v-else class="budget-row unset" @click="router.push({ name: 'budget' })">
        <span>还未设置预算，点击设置 →</span>
      </div>
      <van-progress
        :percentage="budgetProgressPercent"
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

.anomaly-alert {
  display: flex;
  align-items: center;
  gap: 12px;
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
  color: white;
  padding: 14px 16px;
  border-radius: 12px;
  margin: 12px 16px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(238, 90, 90, 0.25);
  transition:
    transform 0.15s,
    box-shadow 0.15s;
}

.anomaly-alert:active {
  transform: scale(0.98);
  box-shadow: 0 2px 8px rgba(238, 90, 90, 0.2);
}

.anomaly-icon {
  font-size: 24px;
}

.anomaly-content {
  flex: 1;
  min-width: 0;
}

.anomaly-title {
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 2px;
}

.anomaly-summary {
  font-size: 13px;
  opacity: 0.92;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
}

.anomaly-close {
  font-size: 22px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
  cursor: pointer;
}

.anomaly-close:hover {
  opacity: 1;
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from {
  transform: translateY(-20px);
  opacity: 0;
}

.slide-down-leave-to {
  transform: translateY(-20px);
  opacity: 0;
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

.ai-entry {
  display: flex;
  align-items: center;
  gap: 5px;
  background: linear-gradient(135deg, #eeedfe 0%, #ddd9fc 100%);
  padding: 7px 13px;
  border-radius: 18px;
  cursor: pointer;
  transition: all 0.18s;
  user-select: none;
  border: 0.5px solid rgba(110, 115, 242, 0.25);
  box-shadow: 0 2px 6px rgba(110, 115, 242, 0.12);
}

.ai-entry:hover {
  background: linear-gradient(135deg, #e2dffe 0%, #cfc9fa 100%);
  box-shadow: 0 3px 10px rgba(110, 115, 242, 0.2);
  transform: translateY(-1px);
}

.ai-entry:active {
  transform: scale(0.96) translateY(0);
}

.ai-label {
  font-size: 12.5px;
  font-weight: 500;
  color: #5550c8;
  letter-spacing: 0.2px;
}

.spend-card {
  background: linear-gradient(135deg, #6b6ef5 0%, #8b8ff8 100%);
  border-radius: 20px;
  padding: 20px 20px 22px;
  color: white;
  margin-bottom: 16px;
}

.clickable-card {
  cursor: pointer;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.clickable-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(110, 115, 242, 0.25);
}

.clickable-card:active {
  transform: translateY(0) scale(0.99);
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

.budget-row.unset {
  cursor: pointer;
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
