<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { use } from 'echarts/core'
import { LineChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { getTransactions } from '@/api/transaction'
import { useTransactionsStore } from '@/stores/transactions'
import { useCategoriesStore } from '@/stores/categories'
import {
  formatTransactionAmount,
  getTransactionIcon,
  getTransactionIconBg,
  getTransactionMeta,
  getTransactionTitle,
} from '@/utils/transactionDisplay'

use([LineChart, BarChart, GridComponent, TooltipComponent, CanvasRenderer])

const router = useRouter()
const txStore = useTransactionsStore()
const catStore = useCategoriesStore()

const view = ref('list')
const periodFilter = ref('month')
const transactions = ref([])
const listLoading = ref(false)

function formatDateLabel(d) {
  const date = new Date(d)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diff = Math.round((today - target) / 86400000)
  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function formatDailyExpenseTotal(value) {
  return Number(value || 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function normalizeTransaction(tx) {
  const categoryName = tx.categoryName || tx.category || '其他'
  const category = catStore.categories.find((c) => c.name === categoryName && c.type === tx.type)
  return {
    ...tx,
    amount: Number(tx.amount || 0),
    categoryName,
    categoryId: tx.categoryId || category?.id || 1,
    merchant: tx.merchant || '',
    note: tx.note || '',
    spentAt: new Date(tx.spentAt),
  }
}

const groupedTransactions = computed(() => {
  const sorted = [...transactions.value].sort(
    (a, b) => new Date(b.spentAt) - new Date(a.spentAt),
  )
  const groups = []
  let lastKey = null

  sorted.forEach((tx) => {
    const date = new Date(tx.spentAt)
    const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
    if (key !== lastKey) {
      groups.push({ dateKey: key, date, items: [], total: 0 })
      lastKey = key
    }

    const group = groups[groups.length - 1]
    group.items.push(tx)
    if (tx.type === 'expense') group.total += Number(tx.amount || 0)
  })

  return groups
})

async function loadTransactions() {
  listLoading.value = true
  try {
    const { data } = await getTransactions()
    const normalized = data.map(normalizeTransaction)
    transactions.value = normalized
    txStore.setTransactions(normalized)
  } catch (error) {
    showToast(error.response?.data?.message || '获取交易记录失败')
  } finally {
    listLoading.value = false
  }
}

onMounted(loadTransactions)

const lineOption = computed(() => ({
  grid: { left: 16, right: 16, top: 16, bottom: 24 },
  xAxis: {
    type: 'category',
    data: ['7月', '8月', '9月', '10月', '11月', '12月'],
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#9ca3af', fontSize: 12 },
  },
  yAxis: { show: false, type: 'value' },
  series: [
    {
      type: 'line',
      smooth: true,
      data: [1200, 1550, 1800, 1900, 2096, 2358],
      symbol: 'circle',
      symbolSize: 8,
      lineStyle: { color: '#6b6ef5', width: 2.5 },
      itemStyle: { color: '#6b6ef5', borderColor: 'white', borderWidth: 2 },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(107,110,245,0.2)' },
            { offset: 1, color: 'rgba(107,110,245,0)' },
          ],
        },
      },
      label: {
        show: true,
        position: 'top',
        formatter: (p) => (p.dataIndex === 5 ? `¥${p.value}` : ''),
        color: '#6b6ef5',
        fontSize: 12,
      },
    },
  ],
}))

const CATEGORY_COLORS = {
  餐饮: '#f59e0b', 购物: '#ec4899', 饮品: '#8b5cf6',
  教育: '#10b981', 交通: '#3b82f6',
}

const categoryBars = computed(() => {
  const totals = txStore.categoryTotals
  const max = totals[0]?.value || 1
  return totals.map((c) => ({
    ...c,
    width: Math.round((c.value / max) * 100),
    color: CATEGORY_COLORS[c.name] || '#6b6ef5',
  }))
})
</script>

<template>
  <div class="page">
    <h2 class="page-title">明细</h2>

    <!-- Toggle -->
    <div class="toggle-wrap">
      <div class="toggle">
        <button :class="['toggle-btn', { active: view === 'list' }]" @click="view = 'list'">
          列表
        </button>
        <button :class="['toggle-btn', { active: view === 'chart' }]" @click="view = 'chart'">
          图表
        </button>
      </div>
    </div>

    <!-- LIST VIEW -->
    <template v-if="view === 'list'">
      <div class="filter-row">
        <button :class="['chip', { active: periodFilter === 'month' }]" @click="periodFilter = 'month'">
          本月
        </button>
        <button class="chip">全部分类</button>
        <button class="chip">筛选</button>
      </div>

      <div v-if="listLoading" class="list-state">
        <van-loading color="#6b6ef5">加载中...</van-loading>
      </div>

      <van-empty
        v-else-if="groupedTransactions.length === 0"
        description="还没有记录,去记一笔吧"
      />

      <div v-for="group in groupedTransactions" v-else :key="group.dateKey" class="group">
        <div class="date-header">
          <span class="date-label">{{ formatDateLabel(group.date) }}</span>
          <span class="date-total">支出 ¥{{ formatDailyExpenseTotal(group.total) }}</span>
        </div>
        <div class="card">
          <div
            v-for="(tx, i) in group.items"
            :key="tx.id"
            class="tx-item"
            :class="{ last: i === group.items.length - 1 }"
            @click="router.push({ name: 'edit-transaction', params: { id: tx.id } })"
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

    <!-- CHART VIEW -->
    <template v-else>
      <!-- Trend chart -->
      <div class="card">
        <div class="section-header">
          <span class="section-title">月度趋势</span>
          <span class="label-muted">最近 6 个月</span>
        </div>
        <v-chart :option="lineOption" style="height: 180px" />
      </div>

      <!-- Comparison -->
      <div class="compare-row">
        <div class="compare-card">
          <p class="compare-val up">+12.5%</p>
          <p class="compare-label">环比上月</p>
          <p class="compare-sub">多花 ¥262</p>
        </div>
        <div class="compare-card">
          <p class="compare-val down">-8.2%</p>
          <p class="compare-label">同比去年</p>
          <p class="compare-sub">少花 ¥210</p>
        </div>
      </div>

      <!-- Category bars -->
      <div class="card">
        <div class="section-header">
          <span class="section-title">分类支出</span>
          <span class="label-muted">本月</span>
        </div>
        <div v-for="cat in categoryBars" :key="cat.name" class="cat-bar-row">
          <div class="cat-bar-header">
            <span class="cat-name">{{ cat.name }}</span>
            <span class="cat-amount">¥{{ cat.value }}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" :style="{ width: cat.width + '%', background: cat.color }"></div>
          </div>
        </div>
      </div>

      <!-- AI insight -->
      <div class="card ai-card">
        <div class="ai-header">
          <div class="ai-avatar">🤖</div>
          <span class="ai-title">AI 洞察</span>
        </div>
        <p class="ai-text">
          你这个月在餐饮上花了 ¥943，占 40%。比上月多了 ¥120，主要因为外卖次数增加 →
        </p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page {
  padding: 0 16px 16px;
  background: #f3f4f8;
  min-height: 100%;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  padding: 20px 4px 16px;
}

.toggle-wrap {
  margin-bottom: 14px;
}

.toggle {
  display: flex;
  background: #eaebfe;
  border-radius: 12px;
  padding: 4px;
}

.toggle-btn {
  flex: 1;
  height: 36px;
  border: none;
  border-radius: 9px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  background: transparent;
  color: #6b7280;
  transition: all 0.2s;
}

.toggle-btn.active {
  background: white;
  color: #6b6ef5;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.filter-row {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.chip {
  padding: 6px 14px;
  border-radius: 20px;
  border: none;
  font-size: 13px;
  cursor: pointer;
  background: white;
  color: #6b7280;
}

.chip.active {
  background: #6b6ef5;
  color: white;
}

.group {
  margin-bottom: 16px;
}

.list-state {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.date-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 4px 8px;
  font-size: 14px;
  color: #6b7280;
}

.date-total {
  font-size: 13px;
}

.card {
  background: white;
  border-radius: 20px;
  padding: 6px 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  margin-bottom: 16px;
}

.tx-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f5f6fa;
  cursor: pointer;
}

.tx-item.last {
  border-bottom: none;
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

.tx-info { flex: 1 }

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
}

.tx-amount.income {
  color: #10b981;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0 4px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
}

.label-muted {
  font-size: 13px;
  color: #9ca3af;
}

.compare-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.compare-card {
  flex: 1;
  background: white;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.compare-val {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 4px;
}

.compare-val.up { color: #ef4444 }
.compare-val.down { color: #10b981 }

.compare-label {
  font-size: 12px;
  color: #6b7280;
}

.compare-sub {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 4px;
}

.cat-bar-row {
  padding: 10px 0;
  border-bottom: 1px solid #f5f6fa;
}

.cat-bar-row:last-child { border-bottom: none }

.cat-bar-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}

.cat-name {
  font-size: 14px;
  color: #374151;
}

.cat-amount {
  font-size: 14px;
  font-weight: 600;
}

.bar-track {
  height: 6px;
  background: #f3f4f6;
  border-radius: 3px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s;
}

.ai-card {
  padding: 16px;
}

.ai-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.ai-avatar {
  width: 36px;
  height: 36px;
  background: #6b6ef5;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.ai-title {
  font-size: 15px;
  font-weight: 600;
  color: #6b6ef5;
}

.ai-text {
  font-size: 14px;
  color: #6b7280;
  line-height: 1.6;
}
</style>
