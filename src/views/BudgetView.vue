<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { useBudgetStore } from '@/stores/budget'

const router = useRouter()
const budgetStore = useBudgetStore()

const editingTotal = ref(String(budgetStore.totalBudget))

function save() {
  const val = parseFloat(editingTotal.value)
  if (val > 0) budgetStore.setTotalBudget(val)
  showToast({ message: '已保存', icon: 'success' })
  router.back()
}

function barWidth(cat) {
  return Math.min((cat.spentAmount / cat.budgetAmount) * 100, 100)
}

function isOverBudget(cat) {
  return cat.spentAmount > cat.budgetAmount
}
</script>

<template>
  <div class="page">
    <div class="nav-bar">
      <van-icon name="arrow-left" size="22" @click="router.back()" />
      <span class="nav-title">预算管理</span>
      <span class="nav-action" @click="save">保存</span>
    </div>

    <!-- Total budget card -->
    <div class="total-card">
      <p class="total-label">月度总预算</p>
      <div class="total-row">
        <span class="currency">¥</span>
        <input
          v-model="editingTotal"
          type="number"
          class="total-input"
          inputmode="decimal"
        />
        <span class="per-month">/月</span>
      </div>
      <div class="usage-pill">
        已使用 {{ budgetStore.usagePercent }}%，还可花
        ¥{{ budgetStore.remaining.toFixed(2) }}
      </div>
    </div>

    <!-- Category budgets -->
    <div class="section-header">
      <span class="section-title">分类预算</span>
      <span class="link-btn">添加</span>
    </div>

    <div class="card">
      <div
        v-for="(cat, i) in budgetStore.categoryBudgets"
        :key="cat.id"
        class="cat-row"
        :class="{ last: i === budgetStore.categoryBudgets.length - 1 }"
      >
        <div class="cat-header">
          <div class="cat-icon" :style="{ background: cat.bg }">{{ cat.icon }}</div>
          <span class="cat-name">{{ cat.categoryName }}</span>
          <span :class="['cat-amounts', { over: isOverBudget(cat) }]">
            ¥{{ cat.spentAmount }} /
            <span class="cat-budget"> ¥{{ cat.budgetAmount }}</span>
          </span>
        </div>
        <van-progress
          :percentage="barWidth(cat)"
          :show-pivot="false"
          stroke-width="6"
          :color="isOverBudget(cat) ? '#ef4444' : cat.color"
          track-color="#f3f4f6"
          style="margin-top: 8px"
        />
        <p v-if="isOverBudget(cat)" class="over-text">
          已超支 ¥{{ (cat.spentAmount - cat.budgetAmount).toFixed(0) }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f3f4f8;
  padding: 0 16px 32px;
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
  color: #6b6ef5;
  font-weight: 500;
  cursor: pointer;
}

.total-card {
  background: linear-gradient(135deg, #6b6ef5, #8b8ff8);
  border-radius: 20px;
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
  color: rgba(255, 255, 255, 0.5);
}

.per-month {
  font-size: 18px;
  opacity: 0.8;
}

.usage-pill {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
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
  color: #6b6ef5;
  cursor: pointer;
}

.card {
  background: white;
  border-radius: 20px;
  padding: 8px 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.cat-row {
  padding: 14px 0;
  border-bottom: 1px solid #f5f6fa;
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
  border-radius: 12px;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cat-name {
  flex: 1;
  font-size: 15px;
  font-weight: 500;
}

.cat-amounts {
  font-size: 14px;
  color: #6b7280;
}

.cat-amounts.over {
  color: #ef4444;
}

.cat-budget {
  font-weight: 600;
}

.over-text {
  font-size: 12px;
  color: #ef4444;
  margin-top: 4px;
}
</style>
