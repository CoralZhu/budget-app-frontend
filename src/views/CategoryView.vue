<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import { getTransactions } from '@/api/transaction'
import { useCategoriesStore } from '@/stores/categories'

const router = useRouter()
const catStore = useCategoriesStore()

const tab = ref('expense')
const loading = ref(false)
const showAddDialog = ref(false)
const newCategory = ref({ name: '', icon: '', color: '#6E73F2' })

const defaultCats = computed(() =>
  catStore.categories.filter((c) => c.isDefault && c.type === tab.value),
)
const customCats = computed(() =>
  catStore.categories.filter((c) => !c.isDefault && c.type === tab.value),
)

async function loadCategories() {
  loading.value = true
  try {
    await catStore.fetchCategories(tab.value)
  } catch (error) {
    showToast(error.response?.data?.message || '获取分类失败')
  } finally {
    loading.value = false
  }
}

function openAddDialog() {
  newCategory.value = { name: '', icon: '', color: '#6E73F2' }
  showAddDialog.value = true
}

async function addCustom() {
  const name = newCategory.value.name.trim()
  if (!name) {
    showToast('请输入分类名称')
    return
  }

  try {
    await catStore.createCategory({
      name,
      icon: newCategory.value.icon.trim() || '📌',
      color: newCategory.value.color || '#6E73F2',
      type: tab.value,
    })
    showAddDialog.value = false
    showToast({ message: '已添加', icon: 'success' })
  } catch (error) {
    showToast(error.response?.data?.message || '添加分类失败')
  }
}

async function countTransactionsByCategory(category) {
  const { data } = await getTransactions()
  const list = Array.isArray(data) ? data : data?.data || data?.transactions || []
  return list.filter((tx) => tx.category === category.name && tx.type === category.type).length
}

async function removeCustom(category) {
  try {
    const count = await countTransactionsByCategory(category)
    await showConfirmDialog({
      title: '删除分类',
      message: count > 0
        ? `该分类下有 ${count} 笔记录,删除后这些记录会被归类为“其他”,确认删除?`
        : `确定删除「${category.name}」分类吗?`,
    })
    const result = await catStore.deleteCategory(category.id)
    showToast({
      message: result?.affectedTransactions > 0
        ? `已删除,${result.affectedTransactions} 笔记录已归类为其他`
        : '已删除',
      icon: 'success',
    })
    await loadCategories()
  } catch (error) {
    if (error !== 'cancel') {
      showToast(error.response?.data?.message || '删除分类失败')
    }
  }
}

onMounted(loadCategories)
watch(tab, loadCategories)
</script>

<template>
  <div class="page">
    <div class="nav-bar">
      <van-icon name="arrow-left" size="22" @click="router.back()" />
      <span class="nav-title">分类管理</span>
      <span class="nav-action" @click="router.back()">完成</span>
    </div>

    <div class="toggle-wrap">
      <div class="toggle">
        <button :class="['toggle-btn', { active: tab === 'expense' }]" @click="tab = 'expense'">
          支出
        </button>
        <button :class="['toggle-btn', { active: tab === 'income' }]" @click="tab = 'income'">
          收入
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading-wrap">
      <van-loading color="#6b6ef5">加载中...</van-loading>
    </div>

    <template v-else>
      <p class="group-label">默认分类 · {{ defaultCats.length }} 个</p>
      <div class="card">
        <div
          v-for="(cat, i) in defaultCats"
          :key="cat.id"
          class="cat-item"
          :class="{ last: i === defaultCats.length - 1 }"
        >
          <div class="cat-icon" :style="{ background: cat.bg }">{{ cat.icon }}</div>
          <span class="cat-name">{{ cat.name }}</span>
          <span class="cat-badge">默认</span>
        </div>
      </div>

      <p class="group-label">自定义 · {{ customCats.length }} 个</p>
      <div v-if="customCats.length" class="card">
        <div
          v-for="(cat, i) in customCats"
          :key="cat.id"
          class="cat-item"
          :class="{ last: i === customCats.length - 1 }"
        >
          <div class="cat-icon" :style="{ background: cat.bg }">{{ cat.icon }}</div>
          <span class="cat-name">{{ cat.name }}</span>
          <van-icon name="cross" color="#d1d5db" size="16" @click="removeCustom(cat)" />
        </div>
      </div>
      <van-empty v-else description="暂无自定义分类" />
    </template>

    <div class="add-btn" @click="openAddDialog">
      <span>添加自定义分类</span>
    </div>

    <div v-if="showAddDialog" class="page-layer center">
      <div class="page-layer-mask" @click="showAddDialog = false"></div>
      <div class="category-dialog">
        <p class="category-dialog-title">添加自定义分类</p>
        <van-field v-model="newCategory.name" label="名称" placeholder="例如: 早餐" clearable />
        <van-field v-model="newCategory.icon" label="图标" placeholder="例如: 🥐" maxlength="2" clearable />
        <van-field v-model="newCategory.color" label="颜色" placeholder="#6E73F2" clearable />
        <div class="category-dialog-actions">
          <button type="button" class="dialog-cancel" @click="showAddDialog = false">取消</button>
          <button type="button" class="dialog-confirm" @click="addCustom">添加</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  height: 100%;
  min-height: 100%;
  background: #f3f4f8;
  padding: 0 16px 80px;
  overflow-y: auto;
  position: relative;
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

.toggle-wrap {
  margin-bottom: 20px;
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

.loading-wrap {
  display: flex;
  justify-content: center;
  padding: 44px 0;
}

.group-label {
  font-size: 13px;
  color: #9ca3af;
  margin-bottom: 8px;
}

.card {
  background: white;
  border-radius: 20px;
  padding: 4px 16px;
  margin-bottom: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.cat-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid #f5f6fa;
}

.cat-item.last {
  border-bottom: none;
}

.cat-icon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  font-size: 20px;
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

.cat-badge {
  font-size: 13px;
  color: #9ca3af;
}

.add-btn {
  border: 2px dashed #c7c9fb;
  border-radius: 20px;
  padding: 18px;
  text-align: center;
  color: #6b6ef5;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  background: rgba(107, 110, 245, 0.04);
}

.page-layer {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
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

.category-dialog {
  position: relative;
  z-index: 1;
  width: 100%;
  background: #fff;
  border-radius: 20px;
  padding: 18px 18px 14px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
}

.category-dialog-title {
  text-align: center;
  font-size: 17px;
  font-weight: 700;
  margin-bottom: 14px;
}

.category-dialog-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 14px;
}

.dialog-cancel,
.dialog-confirm {
  height: 42px;
  border: none;
  border-radius: 12px;
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
</style>
