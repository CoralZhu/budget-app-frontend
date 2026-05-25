<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import { deleteBudget, getBudgets, upsertBudget } from '@/api/budget'
import { getTransactions } from '@/api/transaction'
import { useCategoriesStore } from '@/stores/categories'
import { getTransactionCategory } from '@/utils/transactionDisplay'
import { getCurrentYearMonth } from '@/utils/date'

const router = useRouter()
const catStore = useCategoriesStore()

const minMonthDate = new Date(2020, 0, 1)
const maxMonthDate = new Date(2035, 11, 1)
const yearMonth = ref(getCurrentYearMonth())
const budgets = ref([])
const monthlyTransactions = ref([])
const editingTotal = ref('')
const loading = ref(false)
const showMonthPicker = ref(false)
const monthPickerValue = ref(toMonthPickerValue(yearMonth.value))
const showCategorySheet = ref(false)
const showAmountDialog = ref(false)
const selectedCategory = ref(null)
const editingBudget = ref(null)
const categoryAmount = ref('')
const savingTotal = ref(false)

const expenseCategories = computed(() =>
  catStore.categories.filter((category) => category.type === 'expense'),
)

const totalBudget = computed(() => budgets.value.find((budget) => !budget.category) || null)

const totalBudgetAmount = computed(() => Number(totalBudget.value?.amount || 0))

const totalSpent = computed(() =>
  monthlyTransactions.value
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0),
)

const usagePercent = computed(() => {
  if (totalBudgetAmount.value <= 0) return 0
  return Math.round((totalSpent.value / totalBudgetAmount.value) * 100)
})

const remaining = computed(() => totalBudgetAmount.value - totalSpent.value)

const categorySpentMap = computed(() => {
  const map = {}
  monthlyTransactions.value
    .filter((tx) => tx.type === 'expense')
    .forEach((tx) => {
      const category = getTransactionCategory(tx)
      map[category] = (map[category] || 0) + Number(tx.amount || 0)
    })
  return map
})

const categoryBudgets = computed(() =>
  budgets.value
    .filter((budget) => budget.category)
    .map((budget) => {
      const meta = expenseCategories.value.find((category) => category.name === budget.category)
      const spentAmount = categorySpentMap.value[budget.category] || 0

      return {
        ...budget,
        amount: Number(budget.amount || 0),
        spentAmount,
        icon: meta?.icon || '📌',
        bg: meta?.bg || '#f3f4f6',
      }
    }),
)

const categoryActions = computed(() =>
  expenseCategories.value.map((category) => ({
    name: `${category.icon} ${category.name}`,
    category,
  })),
)

const amountDialogTitle = computed(() => (editingBudget.value ? '修改分类预算' : '设置分类预算'))

const monthTitle = computed(() => {
  const [year, month] = yearMonth.value.split('-')
  return `${year} 年 ${month} 月`
})

const isCurrentMonth = computed(() => yearMonth.value === getCurrentYearMonth())

const canPrevMonth = computed(() => yearMonth.value > formatYearMonth(minMonthDate))

const canNextMonth = computed(() => yearMonth.value < formatYearMonth(maxMonthDate))

const hasAnyBudget = computed(() => budgets.value.length > 0)

function padMonth(value) {
  return String(value).padStart(2, '0')
}

function formatYearMonth(date) {
  return `${date.getFullYear()}-${padMonth(date.getMonth() + 1)}`
}

function parseYearMonth(value) {
  const [year, month] = value.split('-').map(Number)
  return new Date(year, month - 1, 1)
}

function toMonthPickerValue(value) {
  const [year, month] = value.split('-')
  return [year, month]
}

function shiftMonth(delta) {
  const date = parseYearMonth(yearMonth.value)
  date.setMonth(date.getMonth() + delta)
  const nextYearMonth = formatYearMonth(date)
  if (
    nextYearMonth < formatYearMonth(minMonthDate) ||
    nextYearMonth > formatYearMonth(maxMonthDate)
  ) {
    return
  }
  yearMonth.value = nextYearMonth
}

function openMonthPicker() {
  monthPickerValue.value = toMonthPickerValue(yearMonth.value)
  showMonthPicker.value = true
}

function confirmMonthPicker() {
  const [year, month] = monthPickerValue.value
  yearMonth.value = `${year}-${month}`
  showMonthPicker.value = false
}

function unwrapList(response) {
  const data = response.data
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.budgets)) return data.budgets
  return []
}

function normalizeTransaction(tx) {
  return {
    ...tx,
    amount: Number(tx.amount || 0),
    categoryName: tx.categoryName || tx.category || '其他',
    spentAt: new Date(tx.spentAt),
  }
}

async function fetchBudgets() {
  try {
    loading.value = true
    const [budgetRes, txRes] = await Promise.all([
      getBudgets(yearMonth.value),
      getTransactions({ month: yearMonth.value }),
    ])

    budgets.value = unwrapList(budgetRes).map((budget) => ({
      ...budget,
      amount: Number(budget.amount || 0),
      category: budget.category || null,
    }))
    monthlyTransactions.value = unwrapList(txRes).map(normalizeTransaction)
    editingTotal.value = totalBudget.value ? String(totalBudgetAmount.value) : ''
  } catch (error) {
    showToast(error.response?.data?.message || '获取预算失败')
  } finally {
    loading.value = false
  }
}

async function saveTotalBudget(shouldBack = false) {
  const amount = Number(editingTotal.value)
  if (!Number.isFinite(amount) || amount < 0) {
    showToast('请输入有效预算金额')
    return
  }

  try {
    savingTotal.value = true
    await upsertBudget({ yearMonth: yearMonth.value, amount })
    await fetchBudgets()
    showToast({ message: '已保存', icon: 'success' })
    if (shouldBack) router.back()
  } catch (error) {
    showToast(error.response?.data?.message || '保存预算失败')
  } finally {
    savingTotal.value = false
  }
}

function onSelectCategory(action) {
  selectedCategory.value = action.category
  editingBudget.value = null
  categoryAmount.value = ''
  showCategorySheet.value = false
  showAmountDialog.value = true
}

function openEditCategoryBudget(budget) {
  const category = expenseCategories.value.find((item) => item.name === budget.category)
  selectedCategory.value = category || {
    id: budget.category,
    name: budget.category,
    icon: budget.icon,
  }
  editingBudget.value = budget
  categoryAmount.value = String(budget.amount)
  showAmountDialog.value = true
}

async function saveCategoryBudget() {
  const amount = Number(categoryAmount.value)
  if (!selectedCategory.value || !Number.isFinite(amount) || amount <= 0) {
    showToast('请输入有效预算金额')
    return
  }

  try {
    await upsertBudget({
      yearMonth: yearMonth.value,
      category: selectedCategory.value.name,
      amount,
    })
    showAmountDialog.value = false
    await fetchBudgets()
    showToast({ message: '已添加', icon: 'success' })
  } catch (error) {
    showToast(error.response?.data?.message || '保存分类预算失败')
  }
}

async function removeBudget(budget, shouldCloseDialog = false) {
  try {
    await showConfirmDialog({
      title: '删除分类预算',
      message: `确认删除「${budget.category}」预算吗？`,
    })
    await deleteBudget(budget.id)
    if (shouldCloseDialog) showAmountDialog.value = false
    await fetchBudgets()
    showToast({ message: '已删除', icon: 'success' })
  } catch (error) {
    if (error !== 'cancel') {
      showToast(error.response?.data?.message || '删除预算失败')
    }
  }
}

function budgetPercent(cat) {
  if (cat.amount <= 0) return 0
  return Math.round((cat.spentAmount / cat.amount) * 100)
}

function progressWidth(cat) {
  return Math.min(budgetPercent(cat), 100)
}

function progressColor(cat) {
  const pct = budgetPercent(cat)
  if (pct > 100) return '#ef4444'
  if (pct >= 80) return '#f59e0b'
  return '#6E73F2'
}

function isOverBudget(cat) {
  return cat.spentAmount > cat.amount
}

function goToAIChat() {
  router.push({
    path: '/budget-chat',
    query: { yearMonth: yearMonth.value },
  })
}

watch(yearMonth, fetchBudgets)

onMounted(fetchBudgets)
</script>

<template>
  <div class="page">
    <div class="nav-bar">
      <van-icon name="arrow-left" size="22" @click="router.back()" />
      <span class="nav-title">预算管理</span>
      <span class="nav-action" @click="saveTotalBudget(true)">保存</span>
    </div>

    <div class="month-switcher">
      <button
        type="button"
        class="month-arrow"
        :class="{ disabled: !canPrevMonth }"
        :disabled="!canPrevMonth"
        @click="shiftMonth(-1)"
      >
        <van-icon name="arrow-left" size="18" />
      </button>
      <button
        type="button"
        class="month-display"
        :class="{ current: isCurrentMonth }"
        @click="openMonthPicker"
      >
        {{ monthTitle }}
      </button>
      <button
        type="button"
        class="month-arrow"
        :class="{ disabled: !canNextMonth }"
        :disabled="!canNextMonth"
        @click="shiftMonth(1)"
      >
        <van-icon name="arrow" size="18" />
      </button>
    </div>

    <div v-if="loading" class="loading-state">加载中...</div>

    <template v-else>
      <div class="total-card">
        <p class="total-label">月度总预算</p>
        <div class="total-row">
          <span class="currency">¥</span>
          <input
            v-model="editingTotal"
            type="number"
            class="total-input"
            inputmode="decimal"
            placeholder="0"
            :disabled="savingTotal"
            @blur="saveTotalBudget(false)"
          />
          <span class="per-month">/月</span>
        </div>
        <div class="usage-pill">已使用 {{ usagePercent }}%，还可花 ¥{{ remaining.toFixed(2) }}</div>
      </div>

      <div v-if="!hasAnyBudget" class="empty-budget-card">
        <p>该月暂无预算方案。你可以手动设置，或使用 AI 预算规划 Agent 自动生成。</p>
        <div class="empty-actions">
          <button type="button" class="empty-ai-btn" @click="goToAIChat">让 AI 帮我规划</button>
          <button type="button" class="empty-add-btn" @click="showCategorySheet = true">
            添加预算
          </button>
        </div>
      </div>

      <template v-else>
        <div class="section-header">
          <span class="section-title">分类预算</span>
          <span class="link-btn" @click="showCategorySheet = true">添加</span>
        </div>

        <div class="card">
          <van-empty v-if="categoryBudgets.length === 0" description="暂无分类预算" />
          <div
            v-for="(cat, i) in categoryBudgets"
            :key="cat.id"
            class="cat-row"
            :class="{ last: i === categoryBudgets.length - 1 }"
          >
            <div class="cat-header">
              <div class="cat-icon" :style="{ background: cat.bg }">{{ cat.icon }}</div>
              <div class="cat-info">
                <span class="cat-name">{{ cat.category }}</span>
                <span :class="['cat-amounts', { over: isOverBudget(cat) }]">
                  已用¥{{ cat.spentAmount.toFixed(2) }} / 预算¥{{ cat.amount.toFixed(2) }}
                </span>
              </div>
              <van-icon
                name="edit"
                size="20"
                color="#9ca3af"
                class="edit-icon"
                @click="openEditCategoryBudget(cat)"
              />
            </div>
            <van-progress
              :percentage="progressWidth(cat)"
              :show-pivot="false"
              stroke-width="6"
              :color="progressColor(cat)"
              track-color="#f3f4f6"
              style="margin-top: 10px"
            />
            <p v-if="isOverBudget(cat)" class="over-text">
              已超支 ¥{{ (cat.spentAmount - cat.amount).toFixed(0) }}
            </p>
          </div>
        </div>
      </template>
    </template>

    <van-popup v-model:show="showMonthPicker" round position="bottom" class="month-picker-popup">
      <van-date-picker
        v-model="monthPickerValue"
        title="选择预算月份"
        :columns-type="['year', 'month']"
        :min-date="minMonthDate"
        :max-date="maxMonthDate"
        @confirm="confirmMonthPicker"
        @cancel="showMonthPicker = false"
      />
    </van-popup>

    <div v-if="showCategorySheet" class="page-sheet">
      <div class="page-sheet-mask" @click="showCategorySheet = false"></div>
      <div class="page-sheet-panel">
        <p class="page-sheet-title">选择预算分类</p>
        <button
          v-for="action in categoryActions"
          :key="action.category.id"
          type="button"
          class="page-sheet-option"
          @click="onSelectCategory(action)"
        >
          {{ action.name }}
        </button>
        <button type="button" class="page-sheet-cancel" @click="showCategorySheet = false">
          取消
        </button>
      </div>
    </div>

    <van-dialog
      v-model:show="showAmountDialog"
      :title="amountDialogTitle"
      show-cancel-button
      confirm-button-text="保存"
      @confirm="saveCategoryBudget"
    >
      <div class="amount-dialog">
        <p v-if="selectedCategory" class="dialog-category">
          {{ selectedCategory.icon }} {{ selectedCategory.name }}
        </p>
        <van-field
          v-model="categoryAmount"
          type="number"
          input-align="center"
          placeholder="请输入预算金额"
        />
        <button
          v-if="editingBudget"
          type="button"
          class="dialog-delete"
          @click="removeBudget(editingBudget, true)"
        >
          删除该分类预算
        </button>
      </div>
    </van-dialog>
  </div>
</template>

<style scoped>
.page {
  height: 100%;
  min-height: 100%;
  background: #f3f4f8;
  padding: 0 16px 32px;
  position: relative;
  overflow-y: auto;
}

.nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 4px 16px;
}

.nav-title {
  font-size: 18px;
  font-weight: 700;
}

.nav-action {
  font-size: 16px;
  color: #6e73f2;
  font-weight: 500;
  cursor: pointer;
}

.month-switcher {
  display: grid;
  grid-template-columns: 44px 1fr 44px;
  align-items: center;
  gap: 12px;
  margin: 0 0 14px;
}

.month-arrow,
.month-display {
  height: 44px;
  border: none;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  cursor: pointer;
}

.month-arrow {
  color: #6e73f2;
  display: flex;
  align-items: center;
  justify-content: center;
}

.month-arrow.disabled {
  color: #c5cad5;
  background: #eef0f5;
  cursor: not-allowed;
  box-shadow: none;
}

.month-display {
  color: #374151;
  font-size: 16px;
  font-weight: 700;
  border: 1px solid transparent;
}

.month-display.current {
  color: #6e73f2;
  border-color: rgba(110, 115, 242, 0.35);
}

.loading-state,
.empty-budget-card {
  background: #fff;
  border-radius: 16px;
  padding: 24px 18px;
  text-align: center;
  color: #6b7280;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.loading-state {
  margin-top: 14px;
}

.empty-budget-card {
  margin-top: -6px;
}

.empty-budget-card p {
  line-height: 1.6;
}

.empty-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 16px;
}

.empty-ai-btn,
.empty-add-btn {
  width: 140px;
  height: 42px;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
}

.empty-ai-btn {
  background: #6e73f2;
  color: #fff;
  box-shadow: 0 8px 18px rgba(110, 115, 242, 0.22);
}

.empty-add-btn {
  background: #eef0ff;
  color: #6e73f2;
}

.total-card {
  background: linear-gradient(135deg, #6e73f2, #8b8ff8);
  border-radius: 16px;
  padding: 20px;
  color: white;
  margin-bottom: 20px;
}

.total-label {
  font-size: 14px;
  opacity: 0.85;
  margin-bottom: 8px;
}

.total-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 16px;
}

.currency {
  font-size: 28px;
  font-weight: 300;
}

.total-input {
  background: transparent;
  border: none;
  outline: none;
  color: white;
  font-size: 44px;
  font-weight: 700;
  width: 180px;
  caret-color: white;
}

.total-input::placeholder {
  color: rgba(255, 255, 255, 0.55);
}

.total-input::-webkit-outer-spin-button,
.total-input::-webkit-inner-spin-button,
:deep(input[type='number']::-webkit-outer-spin-button),
:deep(input[type='number']::-webkit-inner-spin-button) {
  margin: 0;
  -webkit-appearance: none;
}

.total-input,
:deep(input[type='number']) {
  appearance: textfield;
  -moz-appearance: textfield;
}

.per-month {
  font-size: 18px;
  opacity: 0.8;
}

.usage-pill {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 14px;
  text-align: center;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
  margin-bottom: 10px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
}

.link-btn {
  font-size: 14px;
  color: #6e73f2;
  cursor: pointer;
}

.card {
  background: white;
  border-radius: 16px;
  padding: 8px 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

.cat-row {
  padding: 14px 0;
  border-bottom: 1px solid #f5f6fa;
  background: #fff;
}

.cat-row.last {
  border-bottom: none;
}

.cat-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cat-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cat-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.cat-name {
  font-size: 15px;
  font-weight: 500;
}

.cat-amounts {
  font-size: 13px;
  color: #6b7280;
}

.cat-amounts.over,
.over-text {
  color: #ef4444;
}

.over-text {
  font-size: 12px;
  margin-top: 4px;
}

.edit-icon {
  cursor: pointer;
}

.amount-dialog {
  padding: 8px 20px 18px;
}

.dialog-category {
  text-align: center;
  font-weight: 600;
  margin-bottom: 10px;
}

.dialog-delete {
  width: 100%;
  height: 42px;
  border: none;
  border-radius: 10px;
  background: #fee2e2;
  color: #ef4444;
  font-size: 14px;
  margin-top: 14px;
}

.page-sheet {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: flex-end;
}

.page-sheet-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
}

.page-sheet-panel {
  position: relative;
  z-index: 1;
  width: 100%;
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

:deep(.month-picker-popup) {
  left: max(0px, calc((100vw - 480px) / 2));
  width: min(100vw, 480px);
}
</style>
