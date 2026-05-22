<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import { use } from 'echarts/core'
import { LineChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { getInsights } from '@/api/insights'
import { deleteTransaction as deleteTransactionApi, getTransactions } from '@/api/transaction'
import { useTransactionsStore } from '@/stores/transactions'
import { useCategoriesStore } from '@/stores/categories'
import { getCurrentYearMonth } from '@/utils/date'
import {
  formatTransactionAmount,
  getTransactionIcon,
  getTransactionIconBg,
  getTransactionMeta,
  getTransactionTitle,
  getTransactionCategory,
} from '@/utils/transactionDisplay'

use([LineChart, BarChart, GridComponent, TooltipComponent, CanvasRenderer])

const router = useRouter()
const txStore = useTransactionsStore()
const catStore = useCategoriesStore()

const view = ref('list')
const transactions = ref([])
const listLoading = ref(false)
const chartLoading = ref(false)
const monthlyStats = ref([])
const currentMonthChartTransactions = ref([])
const previousMonthChartTransactions = ref([])
const previousYearMonthExpense = ref(null)
const insightLoading = ref(false)
const insightError = ref(false)
const insightResult = ref(null)
const selectedYearMonth = ref(getCurrentYearMonth())
const selectedMonthLabel = ref('本月')
const showMonthSheet = ref(false)
const showCategorySheet = ref(false)
const showFilterPanel = ref(false)
const showCustomMonthDialog = ref(false)
const customMonthInput = ref('')
const selectedCategory = ref('全部')
const filters = ref({ type: 'all', minAmount: '', maxAmount: '', keyword: '' })
const draftFilters = ref({ type: 'all', minAmount: '', maxAmount: '', keyword: '' })
const openSwipeId = ref(null)
const swipeCellRefs = ref({})

function addMonths(date, offset) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1)
}

function getMonthLabel(yearMonth) {
  const month = Number(yearMonth.slice(5, 7))
  return `${month}月`
}

function formatMoney(value, digits = 0) {
  return Number(value || 0).toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function sumExpense(items) {
  return items
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
}

function unwrapTransactionList(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.transactions)) return data.transactions
  return []
}

const monthActions = computed(() => {
  const now = new Date()
  return [
    { name: '本月', yearMonth: getCurrentYearMonth(now) },
    { name: '上月', yearMonth: getCurrentYearMonth(addMonths(now, -1)) },
    { name: '再上月', yearMonth: getCurrentYearMonth(addMonths(now, -2)) },
    { name: '自定义月份', custom: true },
  ]
})

const usedCategoryActions = computed(() => {
  const names = [
    ...new Set(transactions.value.map((tx) => tx.category || tx.categoryName || '其他')),
  ]
  return [
    { name: '全部', value: '全部' },
    ...names.map((name) => ({ name, value: name })),
  ]
})

const hasCategoryFilter = computed(() => selectedCategory.value !== '全部')

const categoryChipLabel = computed(() =>
  hasCategoryFilter.value ? selectedCategory.value : '全部分类',
)

const hasAdvancedFilter = computed(() => {
  const filter = filters.value
  return Boolean(
    filter.type !== 'all' ||
      filter.minAmount ||
      filter.maxAmount ||
      filter.keyword.trim(),
  )
})

const filterChipLabel = computed(() => {
  if (!hasAdvancedFilter.value) return '筛选'

  const parts = []
  if (filters.value.type === 'expense') parts.push('支出')
  if (filters.value.type === 'income') parts.push('收入')
  if (filters.value.minAmount || filters.value.maxAmount) {
    parts.push(`¥${filters.value.minAmount || 0}-¥${filters.value.maxAmount || '∞'}`)
  }
  if (filters.value.keyword.trim()) parts.push(filters.value.keyword.trim())
  return parts.join('·')
})

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

function getTransactionYearMonth(tx) {
  return getCurrentYearMonth(new Date(tx.spentAt))
}

const filteredTransactions = computed(() => {
  return transactions.value.filter((tx) => {
    if (getTransactionYearMonth(tx) !== selectedYearMonth.value) return false

    const txCategory = tx.category || tx.categoryName || '其他'
    if (selectedCategory.value !== '全部' && txCategory !== selectedCategory.value) {
      return false
    }

    const filter = filters.value
    if (filter.type !== 'all' && tx.type !== filter.type) return false

    const amount = Number(tx.amount || 0)
    const min = Number(filter.minAmount)
    const max = Number(filter.maxAmount)
    if (filter.minAmount !== '' && amount < min) return false
    if (filter.maxAmount !== '' && amount > max) return false

    const keyword = filter.keyword.trim().toLowerCase()
    if (keyword) {
      const text = `${tx.merchant || ''} ${tx.note || ''}`.toLowerCase()
      if (!text.includes(keyword)) return false
    }

    return true
  })
})

const groupedTransactions = computed(() => {
  const sorted = [...filteredTransactions.value].sort(
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
    const { data } = await getTransactions({ yearMonth: selectedYearMonth.value })
    const list = unwrapTransactionList(data)
    const normalized = list
      .map(normalizeTransaction)
      .filter((tx) => getTransactionYearMonth(tx) === selectedYearMonth.value)
    transactions.value = normalized
    txStore.setTransactions(normalized)
  } catch (error) {
    showToast(error.response?.data?.message || '获取交易记录失败')
  } finally {
    listLoading.value = false
  }
}

async function fetchTransactionsByYearMonth(yearMonth) {
  const { data } = await getTransactions({ yearMonth })
  return unwrapTransactionList(data)
    .map(normalizeTransaction)
    .filter((tx) => getTransactionYearMonth(tx) === yearMonth)
}

function selectMonth(action) {
  if (action.custom) {
    customMonthInput.value = selectedYearMonth.value
    showMonthSheet.value = false
    showCustomMonthDialog.value = true
    return
  }

  selectedYearMonth.value = action.yearMonth
  selectedMonthLabel.value = action.name
  showMonthSheet.value = false
  selectedCategory.value = '全部'
  loadTransactions()
}

function confirmCustomMonth() {
  if (!/^\d{4}-\d{2}$/.test(customMonthInput.value)) {
    showToast('请输入 YYYY-MM 格式')
    return
  }

  selectedYearMonth.value = customMonthInput.value
  selectedMonthLabel.value = customMonthInput.value
  selectedCategory.value = '全部'
  showCustomMonthDialog.value = false
  loadTransactions()
}

function selectCategory(action) {
  selectedCategory.value = action.value
  showCategorySheet.value = false
}

function openFilterPanel() {
  draftFilters.value = { ...filters.value }
  showFilterPanel.value = true
}

function resetFilters() {
  draftFilters.value = { type: 'all', minAmount: '', maxAmount: '', keyword: '' }
}

function confirmFilters() {
  filters.value = { ...draftFilters.value }
  showFilterPanel.value = false
}

function setSwipeCellRef(id, el) {
  if (el) {
    swipeCellRefs.value[id] = el
  } else {
    delete swipeCellRefs.value[id]
  }
}

function handleSwipeOpen(tx) {
  if (openSwipeId.value && openSwipeId.value !== tx.id) {
    swipeCellRefs.value[openSwipeId.value]?.close?.()
  }
  openSwipeId.value = tx.id
}

function handleSwipeClose(tx) {
  if (openSwipeId.value === tx.id) {
    openSwipeId.value = null
  }
}

function handleTransactionClick(tx) {
  if (openSwipeId.value === tx.id) {
    swipeCellRefs.value[tx.id]?.close?.()
    openSwipeId.value = null
    return
  }

  router.push({ name: 'edit-transaction', params: { id: tx.id } })
}

async function removeTransaction(tx) {
  try {
    await showConfirmDialog({
      title: '确认删除',
      message: '确认删除这条记录吗？',
    })
    await deleteTransactionApi(tx.id)
    transactions.value = transactions.value.filter((item) => item.id !== tx.id)
    txStore.deleteTransaction(tx.id)
    showToast({ message: '已删除', icon: 'success' })
  } catch (error) {
    if (error !== 'cancel') {
      showToast(error.response?.data?.message || '删除失败')
    }
  }
}

onMounted(loadTransactions)

async function loadChartData() {
  chartLoading.value = true
  const now = new Date()
  const months = Array.from({ length: 6 }, (_, index) =>
    getCurrentYearMonth(addMonths(now, index - 5)),
  )
  const currentYearMonth = getCurrentYearMonth(now)
  const previousYearMonth = getCurrentYearMonth(new Date(now.getFullYear() - 1, now.getMonth(), 1))

  try {
    const [monthLists, lastYearList] = await Promise.all([
      Promise.all(months.map((yearMonth) => fetchTransactionsByYearMonth(yearMonth))),
      fetchTransactionsByYearMonth(previousYearMonth),
    ])

    monthlyStats.value = months.map((yearMonth, index) => ({
      yearMonth,
      label: getMonthLabel(yearMonth),
      total: sumExpense(monthLists[index]),
      transactions: monthLists[index],
    }))
    currentMonthChartTransactions.value =
      monthlyStats.value.find((item) => item.yearMonth === currentYearMonth)?.transactions || []
    previousMonthChartTransactions.value =
      monthlyStats.value.at(-2)?.transactions || []
    previousYearMonthExpense.value = lastYearList.length > 0 ? sumExpense(lastYearList) : null
  } catch (error) {
    showToast(error.response?.data?.message || '获取图表数据失败')
  } finally {
    chartLoading.value = false
  }
}

onMounted(loadChartData)

const displayInsights = computed(() => insightResult.value?.insights?.slice(0, 5) || [])
const insightPeriod = computed(() => insightResult.value?.period || '最近30天')

async function loadInsights(force = false) {
  insightLoading.value = true
  insightError.value = false
  try {
    insightResult.value = await getInsights(force)
  } catch {
    insightError.value = true
  } finally {
    insightLoading.value = false
  }
}

watch(view, (nextView) => {
  if (nextView === 'chart') {
    loadInsights()
  }
})

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

const hasTrendData = computed(() => monthlyStats.value.some((item) => item.total > 0))

const lineOption = computed(() => {
  const totals = monthlyStats.value.map((item) => Number(item.total.toFixed(2)))
  const maxTotal = Math.max(...totals, 0)

  return {
    grid: { left: 16, right: 16, top: 28, bottom: 24 },
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: '#1f2937',
      borderWidth: 0,
      textStyle: { color: '#fff', fontSize: 12 },
      formatter: (params) => {
        const item = params?.[0]
        if (!item) return ''
        return `${item.axisValue}<br/>总金额 ¥${formatMoney(item.value, 2)}`
      },
      axisPointer: {
        type: 'line',
        lineStyle: { color: '#c7d2fe', width: 1 },
      },
    },
    xAxis: {
      type: 'category',
      data: monthlyStats.value.map((item) => item.label),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#9ca3af', fontSize: 12 },
    },
    yAxis: { show: false, type: 'value' },
    series: [
      {
        type: 'line',
        smooth: true,
        data: totals,
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
          formatter: (p) => (p.value === maxTotal && maxTotal > 0 ? `¥${formatMoney(p.value)}` : ''),
          color: '#6b6ef5',
          fontSize: 12,
        },
      },
    ],
  }
})

const currentMonthExpense = computed(() => sumExpense(currentMonthChartTransactions.value))
const previousMonthExpense = computed(() => sumExpense(previousMonthChartTransactions.value))

function buildCompare(current, previous, emptyText = '') {
  if (previous === null || previous === undefined) {
    return {
      value: emptyText || '暂无数据',
      trend: 'neutral',
      subtitle: '',
    }
  }

  if (previous <= 0) {
    return {
      value: current > 0 ? '+100%' : '0%',
      trend: current > 0 ? 'up' : 'neutral',
      subtitle: current > 0 ? `多花 ¥${formatMoney(current)}` : '与上期持平',
    }
  }

  const diff = current - previous
  const percent = Math.abs((diff / previous) * 100).toFixed(1)
  if (diff > 0) {
    return { value: `↑ ${percent}%`, trend: 'up', subtitle: `多花 ¥${formatMoney(diff)}` }
  }
  if (diff < 0) {
    return { value: `↓ ${percent}%`, trend: 'down', subtitle: `少花 ¥${formatMoney(Math.abs(diff))}` }
  }
  return { value: '0%', trend: 'neutral', subtitle: '与上期持平' }
}

const monthCompare = computed(() =>
  buildCompare(currentMonthExpense.value, previousMonthExpense.value),
)

const yearCompare = computed(() =>
  buildCompare(currentMonthExpense.value, previousYearMonthExpense.value, '暂无去年数据'),
)

const categoryBars = computed(() => {
  const totals = {}
  currentMonthChartTransactions.value
    .filter((tx) => tx.type === 'expense')
    .forEach((tx) => {
      const category = getTransactionCategory(tx)
      if (!totals[category]) {
        totals[category] = { name: category, value: 0, count: 0 }
      }
      totals[category].value += Number(tx.amount || 0)
      totals[category].count += 1
    })

  const rows = Object.values(totals).sort((a, b) => b.value - a.value)
  const max = rows[0]?.value || 1
  return rows.map((item) => ({
    ...item,
    width: Math.round((item.value / max) * 100),
    color: CATEGORY_COLORS[item.name] || CATEGORY_COLORS.其他,
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
        <button :class="['chip', { active: selectedMonthLabel !== '本月' }]" @click="showMonthSheet = true">
          {{ selectedMonthLabel }}
        </button>
        <button :class="['chip', { active: hasCategoryFilter }]" @click="showCategorySheet = true">
          {{ categoryChipLabel }}
        </button>
        <button :class="['chip', { active: hasAdvancedFilter }]" @click="openFilterPanel">
          {{ filterChipLabel }}
        </button>
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
          <van-swipe-cell
            v-for="(tx, i) in group.items"
            :key="tx.id"
            :ref="(el) => setSwipeCellRef(tx.id, el)"
            :right-width="72"
            :threshold="0.05"
            stop-propagation
            @open="handleSwipeOpen(tx)"
            @close="handleSwipeClose(tx)"
          >
            <div
              class="tx-item"
              :class="{ last: i === group.items.length - 1 }"
              @click="handleTransactionClick(tx)"
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
            <template #right>
              <button type="button" class="delete-action" @click.stop="removeTransaction(tx)">
                <span class="delete-circle">
                  <van-icon name="delete-o" size="22" />
                </span>
              </button>
            </template>
          </van-swipe-cell>
        </div>
      </div>

      <div v-if="showMonthSheet" class="page-layer">
        <div class="page-layer-mask" @click="showMonthSheet = false"></div>
        <div class="page-sheet-panel">
          <p class="page-sheet-title">选择月份</p>
          <button
            v-for="action in monthActions"
            :key="action.name"
            type="button"
            class="page-sheet-option"
            @click="selectMonth(action)"
          >
            {{ action.name }}
          </button>
          <button type="button" class="page-sheet-cancel" @click="showMonthSheet = false">
            取消
          </button>
        </div>
      </div>

      <div v-if="showCategorySheet" class="page-layer">
        <div class="page-layer-mask" @click="showCategorySheet = false"></div>
        <div class="page-sheet-panel">
          <p class="page-sheet-title">选择分类</p>
          <button
            v-for="action in usedCategoryActions"
            :key="action.value"
            type="button"
            class="page-sheet-option"
            @click="selectCategory(action)"
          >
            {{ action.name }}
          </button>
          <button type="button" class="page-sheet-cancel" @click="showCategorySheet = false">
            取消
          </button>
        </div>
      </div>

      <div v-if="showCustomMonthDialog" class="page-layer center">
        <div class="page-layer-mask" @click="showCustomMonthDialog = false"></div>
        <div class="page-dialog">
          <p class="page-dialog-title">自定义月份</p>
          <van-field v-model="customMonthInput" placeholder="YYYY-MM" input-align="center" />
          <div class="page-dialog-actions">
            <button type="button" class="dialog-cancel" @click="showCustomMonthDialog = false">
              取消
            </button>
            <button type="button" class="dialog-confirm" @click="confirmCustomMonth">
              确认
            </button>
          </div>
        </div>
      </div>

      <div v-if="showFilterPanel" class="page-layer">
        <div class="page-layer-mask" @click="showFilterPanel = false"></div>
        <div class="filter-panel">
          <div class="panel-header">
            <span class="panel-title">筛选</span>
          </div>
          <div class="filter-block">
            <p class="filter-label">类型</p>
            <div class="segmented">
              <button
                v-for="option in [
                  { label: '全部', value: 'all' },
                  { label: '支出', value: 'expense' },
                  { label: '收入', value: 'income' },
                ]"
                :key="option.value"
                :class="['segment-btn', { active: draftFilters.type === option.value }]"
                @click="draftFilters.type = option.value"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
          <div class="filter-block">
            <p class="filter-label">金额范围</p>
            <div class="amount-range">
              <van-field v-model="draftFilters.minAmount" type="number" placeholder="最小" />
              <span class="range-sep">-</span>
              <van-field v-model="draftFilters.maxAmount" type="number" placeholder="最大" />
            </div>
          </div>
          <div class="filter-block">
            <p class="filter-label">关键词</p>
            <van-field v-model="draftFilters.keyword" placeholder="搜商家名或备注" />
          </div>
          <div class="filter-actions">
            <button type="button" class="reset-btn" @click="resetFilters">重置</button>
            <button type="button" class="confirm-btn" @click="confirmFilters">确认</button>
          </div>
        </div>
      </div>
    </template>

    <!-- CHART VIEW -->
    <template v-else>
      <div v-if="chartLoading" class="list-state">
        <van-loading color="#6b6ef5">加载中...</van-loading>
      </div>

      <!-- Trend chart -->
      <div v-else class="card">
        <div class="section-header">
          <span class="section-title">月度趋势</span>
          <span class="label-muted">最近 6 个月</span>
        </div>
        <v-chart v-if="hasTrendData" :option="lineOption" style="height: 180px" />
        <van-empty v-else description="最近 6 个月暂无支出" />
      </div>

      <!-- Comparison -->
      <div v-if="!chartLoading" class="compare-row">
        <div class="compare-card">
          <p :class="['compare-val', monthCompare.trend]">{{ monthCompare.value }}</p>
          <p class="compare-label">环比上月</p>
          <p class="compare-sub">{{ monthCompare.subtitle }}</p>
        </div>
        <div class="compare-card">
          <p :class="['compare-val', yearCompare.trend]">{{ yearCompare.value }}</p>
          <p class="compare-label">同比去年</p>
          <p class="compare-sub">{{ yearCompare.subtitle }}</p>
        </div>
      </div>

      <!-- Category bars -->
      <div v-if="!chartLoading" class="card">
        <div class="section-header">
          <span class="section-title">分类支出</span>
          <span class="label-muted">本月</span>
        </div>
        <van-empty v-if="categoryBars.length === 0" description="本月暂无分类支出" />
        <template v-else>
          <div v-for="cat in categoryBars" :key="cat.name" class="cat-bar-row">
            <div class="cat-bar-header">
              <span class="cat-name">{{ cat.name }}</span>
              <span class="cat-amount">¥{{ formatMoney(cat.value, 2) }}</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill" :style="{ width: cat.width + '%', background: cat.color }"></div>
            </div>
          </div>
        </template>
      </div>

      <!-- AI insight -->
      <section v-if="!chartLoading" class="ai-section">
        <div class="ai-meta">
          <span class="ai-section-title">AI 洞察 · {{ insightPeriod }}</span>
          <div class="ai-meta-actions">
            <span>由 DeepSeek 生成</span>
            <button
              type="button"
              class="ai-refresh"
              aria-label="刷新 AI 洞察"
              :disabled="insightLoading"
              @click="loadInsights(true)"
            >
              🔄
            </button>
          </div>
        </div>

        <div v-if="insightLoading" class="ai-loading-card">
          <van-loading color="#6b6ef5" size="22px" />
          <div>
            <p>AI 正在分析你的消费习惯...</p>
            <span>通常需要 5-15 秒</span>
          </div>
        </div>

        <div v-else-if="insightError" class="ai-error-card">
          <p>AI 洞察暂时不可用,请稍后再试</p>
          <button type="button" @click="loadInsights()">重试</button>
        </div>

        <div v-else class="ai-insight-list">
          <article
            v-for="(insight, index) in displayInsights"
            :key="`${insight.type || 'general'}-${index}`"
            class="ai-insight-card"
          >
            <div class="ai-insight-title">
              <span class="ai-emoji">{{ insight.emoji || '💡' }}</span>
              <strong>{{ insight.title }}</strong>
            </div>
            <p>{{ insight.content }}</p>
          </article>
          <article v-if="displayInsights.length === 0" class="ai-insight-card">
            <div class="ai-insight-title">
              <span class="ai-emoji">🌱</span>
              <strong>洞察在路上</strong>
            </div>
            <p>先记几笔消费,我再帮你看看最近的花钱习惯。</p>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.page {
  height: 100%;
  padding: 0 16px 16px;
  background: #f3f4f8;
  min-height: 100%;
  position: relative;
  overflow-y: auto;
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
  max-width: 44%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.delete-action {
  height: 100%;
  width: 72px;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-circle {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #ef4444;
  color: #fff;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.page-layer {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.page-layer.center {
  align-items: center;
  padding: 0 20px;
}

.page-layer-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
}

.page-sheet-panel,
.filter-panel,
.page-dialog {
  position: relative;
  z-index: 1;
  width: 100%;
}

.page-sheet-panel {
  max-height: calc(100% - 72px);
  overflow-y: auto;
  background: #f7f8fa;
  border-radius: 16px 16px 0 0;
  padding: 10px 10px max(10px, env(safe-area-inset-bottom));
}

.page-sheet-title {
  color: #6b7280;
  font-size: 13px;
  text-align: center;
  padding: 10px 0 12px;
}

.page-sheet-option,
.page-sheet-cancel {
  width: 100%;
  height: 48px;
  border: none;
  border-radius: 10px;
  background: #fff;
  color: #1a1a2e;
  font-size: 16px;
  margin-bottom: 8px;
}

.page-sheet-cancel {
  color: #6b7280;
  margin-top: 2px;
  margin-bottom: 0;
}

.page-dialog {
  background: #fff;
  border-radius: 16px;
  padding: 18px 18px 14px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
}

.page-dialog-title {
  text-align: center;
  font-size: 17px;
  font-weight: 700;
  margin-bottom: 14px;
}

.page-dialog-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 14px;
}

.dialog-cancel,
.dialog-confirm {
  height: 40px;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
}

.dialog-cancel {
  background: #f3f4f6;
  color: #6b7280;
}

.dialog-confirm {
  background: #6b6ef5;
  color: #fff;
}

.filter-panel {
  padding: 18px 16px max(18px, env(safe-area-inset-bottom));
  background: #f7f8fa;
  border-radius: 16px 16px 0 0;
  max-height: calc(100% - 72px);
  overflow-y: auto;
}

.panel-header {
  display: flex;
  justify-content: center;
  margin-bottom: 18px;
}

.panel-title {
  font-size: 17px;
  font-weight: 700;
}

.filter-block {
  margin-bottom: 18px;
}

.filter-label {
  font-size: 14px;
  color: #374151;
  font-weight: 600;
  margin-bottom: 10px;
}

.segmented {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.segment-btn {
  height: 38px;
  border: none;
  border-radius: 10px;
  background: #fff;
  color: #6b7280;
  font-size: 14px;
}

.segment-btn.active {
  background: #6b6ef5;
  color: #fff;
}

.amount-range {
  display: grid;
  grid-template-columns: 1fr 20px 1fr;
  align-items: center;
  gap: 8px;
}

.range-sep {
  color: #9ca3af;
  text-align: center;
}

.filter-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 22px;
}

.reset-btn,
.confirm-btn {
  height: 44px;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
}

.reset-btn {
  background: #fff;
  color: #6b7280;
}

.confirm-btn {
  background: #6b6ef5;
  color: #fff;
}

:deep(input[type='number']::-webkit-outer-spin-button),
:deep(input[type='number']::-webkit-inner-spin-button) {
  margin: 0;
  -webkit-appearance: none;
}

:deep(input[type='number']) {
  appearance: textfield;
  -moz-appearance: textfield;
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
.compare-val.neutral { color: #6b7280 }

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

.ai-section {
  margin-bottom: 16px;
  min-width: 0;
}

.ai-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 0 2px 10px;
}

.ai-section-title {
  min-width: 0;
  font-size: 16px;
  font-weight: 650;
  color: #4338ca;
}

.ai-meta-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  font-size: 12px;
  color: #8b8ea3;
}

.ai-refresh {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 9px;
  background: #e7e8ff;
  color: #5b5fe8;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}

.ai-refresh:disabled {
  opacity: 0.55;
  cursor: wait;
}

.ai-loading-card,
.ai-error-card,
.ai-insight-card {
  border-radius: 12px;
  box-shadow: 0 5px 18px rgba(97, 86, 214, 0.1);
}

.ai-loading-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px;
  background: linear-gradient(135deg, #f1efff, #e4e7ff);
  color: #4338ca;
}

.ai-loading-card p {
  margin-bottom: 3px;
  font-size: 15px;
  font-weight: 600;
}

.ai-loading-card span {
  font-size: 12px;
  color: #7773ad;
}

.ai-error-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  background: #f0efff;
  color: #59536f;
}

.ai-error-card p {
  min-width: 0;
  font-size: 14px;
}

.ai-error-card button {
  flex-shrink: 0;
  height: 32px;
  padding: 0 13px;
  border: none;
  border-radius: 10px;
  background: #6b6ef5;
  color: white;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.ai-insight-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 560px;
  overflow-y: auto;
}

.ai-insight-card {
  min-width: 0;
  padding: 16px;
  background: linear-gradient(135deg, #f1efff, #e8e9ff);
}

.ai-insight-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  color: #352f78;
  overflow-wrap: anywhere;
}

.ai-emoji {
  font-size: 23px;
  line-height: 1;
  flex-shrink: 0;
}

.ai-insight-title strong {
  font-size: 16px;
}

.ai-insight-card p {
  font-size: 14px;
  color: #5a5d72;
  line-height: 1.65;
  overflow-wrap: anywhere;
}
</style>
