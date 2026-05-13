<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showDialog } from 'vant'
import { useCategoriesStore } from '@/stores/categories'

const router = useRouter()
const catStore = useCategoriesStore()

const tab = ref('expense')

const defaultCats = computed(() =>
  catStore.categories.filter((c) => c.isDefault && c.type === tab.value),
)
const customCats = computed(() =>
  catStore.categories.filter((c) => !c.isDefault && c.type === tab.value),
)

async function addCustom() {
  await showDialog({
    title: '添加自定义分类',
    message: '功能开发中，即将上线',
    showCancelButton: false,
  })
}
</script>

<template>
  <div class="page">
    <div class="nav-bar">
      <van-icon name="arrow-left" size="22" @click="router.back()" />
      <span class="nav-title">分类管理</span>
      <span class="nav-action" @click="router.back()">完成</span>
    </div>

    <!-- Tab toggle -->
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

    <!-- Default categories -->
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

    <!-- Custom categories -->
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
        <van-icon name="cross" color="#d1d5db" size="16" @click="catStore.removeCategory(cat.id)" />
      </div>
    </div>

    <div class="add-btn" @click="addCustom">
      <span>添加自定义分类</span>
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
</style>
