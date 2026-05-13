<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast, showConfirmDialog } from 'vant'
import { useTransactionsStore } from '@/stores/transactions'
import { useCategoriesStore } from '@/stores/categories'

const route = useRoute()
const router = useRouter()
const txStore = useTransactionsStore()
const catStore = useCategoriesStore()

const tx = ref(null)
const txType = ref('expense')
const amountStr = ref('')
const selectedCategoryId = ref(1)
const merchant = ref('')
const noteVal = ref('')
const dateStr = ref('')

onMounted(() => {
  const id = parseInt(route.params.id)
  const found = txStore.getById(id)
  if (!found) {
    router.back()
    return
  }
  tx.value = found
  txType.value = found.type
  amountStr.value = String(found.amount)
  selectedCategoryId.value = found.categoryId
  merchant.value = found.merchant || ''
  noteVal.value = found.note || ''
  const d = new Date(found.spentAt)
  dateStr.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const displayCategories = computed(() =>
  catStore.categories.filter((c) => c.type === txType.value).slice(0, 8),
)

function formatDateTime(date) {
  if (!date) return ''
  const d = new Date(date)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours() < 12 ? '上午' : '下午'} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function save() {
  const amount = parseFloat(amountStr.value)
  if (!amount || amount <= 0) {
    showToast('请输入金额')
    return
  }
  const cat = catStore.getCategoryById(selectedCategoryId.value)
  txStore.updateTransaction(tx.value.id, {
    type: txType.value,
    amount,
    categoryId: selectedCategoryId.value,
    categoryName: cat?.name || tx.value.categoryName,
    merchant: merchant.value,
    note: noteVal.value,
    spentAt: new Date(dateStr.value + 'T12:00:00'),
  })
  showToast({ message: '已保存', icon: 'success' })
  router.back()
}

async function deleteTx() {
  await showConfirmDialog({ title: '删除记录', message: '确定要删除这条记录吗?', confirmButtonColor: '#ef4444' })
  txStore.deleteTransaction(tx.value.id)
  showToast({ message: '已删除', icon: 'success' })
  router.replace({ name: 'detail' })
}
</script>

<template>
  <div v-if="tx" class="page">
    <div class="nav-bar">
      <van-icon name="arrow-left" size="22" @click="router.back()" />
      <span class="nav-title">编辑记录</span>
      <span class="nav-action" @click="save">保存</span>
    </div>

    <div class="card">
      <div class="type-toggle">
        <button :class="['type-btn', { active: txType === 'expense' }]" @click="txType = 'expense'">
          支出
        </button>
        <button :class="['type-btn income', { active: txType === 'income' }]" @click="txType = 'income'">
          收入
        </button>
      </div>
      <p class="amount-label">金额</p>
      <div class="amount-row">
        <span class="currency">¥</span>
        <input v-model="amountStr" type="number" class="amount-input" inputmode="decimal" />
      </div>
    </div>

    <div class="card">
      <p class="field-label">分类</p>
      <div class="cat-row">
        <div
          v-for="cat in displayCategories"
          :key="cat.id"
          :class="['cat-chip', { selected: selectedCategoryId === cat.id }]"
          @click="selectedCategoryId = cat.id"
        >
          <div class="cat-icon" :style="{ background: cat.bg }">{{ cat.icon }}</div>
          <span>{{ cat.name }}</span>
          <span v-if="selectedCategoryId === cat.id" class="cat-change">更改</span>
        </div>
      </div>
    </div>

    <div class="card info-card">
      <van-field
        v-model="merchant"
        :label="merchant || '商家名称'"
        :border="false"
        class="info-field"
      />
      <van-field
        :model-value="formatDateTime(tx.spentAt)"
        :label="formatDateTime(tx.spentAt)"
        :border="false"
        class="info-field"
        readonly
      />
      <van-field
        v-model="noteVal"
        :placeholder="noteVal || '添加备注'"
        :border="false"
        class="info-field"
      />
    </div>

    <!-- Original receipt -->
    <div v-if="tx.inputMethod === 'photo' || tx.inputMethod === 'voice'" class="card">
      <p class="field-label">原始凭证</p>
      <div class="receipt-row">
        <div class="receipt-thumb">
          <p class="thumb-title" style="font-size: 11px; text-align: center">星巴克</p>
          <p style="font-size: 10px; text-align: center; color: #9ca3af">拿铁</p>
          <p style="font-size: 11px; text-align: center; font-weight: 700">¥{{ tx.amount }}</p>
        </div>
        <div class="receipt-add">
          <van-icon name="plus" color="#9ca3af" size="24" />
        </div>
      </div>
      <p v-if="tx.aiConfidence" class="ai-conf">
        此记录由 AI {{ tx.inputMethod === 'photo' ? '拍照' : '语音' }}识别生成 · 置信度
        {{ Math.round(tx.aiConfidence * 100) }}%
      </p>
    </div>

    <div class="delete-btn" @click="deleteTx">
      <van-icon name="delete-o" size="18" color="#ef4444" />
      <span>删除这条记录</span>
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

.card {
  background: white;
  border-radius: 20px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.type-toggle {
  display: flex;
  background: #f5f6fa;
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 20px;
}

.type-btn {
  flex: 1;
  height: 38px;
  border: none;
  border-radius: 9px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  background: transparent;
  color: #6b7280;
}

.type-btn.active {
  background: #ffe4e4;
  color: #ef4444;
}

.type-btn.income.active {
  background: #d1fae5;
  color: #059669;
}

.amount-label {
  font-size: 14px;
  color: #9ca3af;
  margin-bottom: 8px;
}

.amount-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.currency {
  font-size: 28px;
  color: #9ca3af;
}

.amount-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 40px;
  font-weight: 700;
  color: #1a1a2e;
  background: transparent;
}

.field-label {
  font-size: 14px;
  color: #9ca3af;
  margin-bottom: 12px;
}

.cat-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cat-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  cursor: pointer;
  background: #f5f6fa;
  font-size: 15px;
  font-weight: 500;
}

.cat-chip.selected {
  background: #eaebfe;
  color: #6b6ef5;
}

.cat-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cat-change {
  margin-left: auto;
  font-size: 13px;
  color: #6b6ef5;
}

.info-card {
  padding: 0;
  overflow: hidden;
}

.info-field {
  padding: 14px 16px;
  border-bottom: 1px solid #f5f6fa;
  font-size: 15px;
}

.info-field:last-child {
  border-bottom: none;
}

.receipt-row {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}

.receipt-thumb {
  width: 90px;
  height: 90px;
  background: #f5f6fa;
  border-radius: 12px;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.receipt-add {
  width: 90px;
  height: 90px;
  background: #f5f6fa;
  border-radius: 12px;
  border: 2px dashed #d1d5db;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-conf {
  font-size: 12px;
  color: #9ca3af;
}

.delete-btn {
  margin-top: 8px;
  background: #fff5f5;
  border-radius: 20px;
  padding: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  color: #ef4444;
  font-size: 15px;
  font-weight: 500;
}
</style>
