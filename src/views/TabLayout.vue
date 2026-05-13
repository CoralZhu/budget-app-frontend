<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const tabs = [
  { name: 'home', label: '首页', icon: 'wap-home-o' },
  { name: 'detail', label: '明细', icon: 'bar-chart-o' },
  { name: 'record', label: '记账', icon: '' },
  { name: 'profile', label: '我的', icon: 'contact-o' },
]

const active = computed(() => route.name)

function goTo(name) {
  router.push({ name })
}

const showTabbar = computed(() => route.name !== 'record')
</script>

<template>
  <div class="layout">
    <main class="content">
      <RouterView />
    </main>

    <nav v-if="showTabbar" class="tabbar">
      <div
        v-for="tab in tabs"
        :key="tab.name"
        :class="['tab-item', { active: active === tab.name }]"
        @click="goTo(tab.name)"
      >
        <!-- Record tab: outlined rounded-square matching PDF -->
        <template v-if="tab.name === 'record'">
          <div :class="['rec-sq', { active: active === 'record' }]">
            <van-icon name="plus" size="14" :color="active === 'record' ? 'white' : '#9ca3af'" />
          </div>
        </template>
        <!-- Normal tabs -->
        <template v-else>
          <van-icon
            :name="tab.icon"
            size="24"
            :color="active === tab.name ? '#6b6ef5' : '#9ca3af'"
          />
        </template>
        <span class="tab-label">{{ tab.label }}</span>
      </div>
    </nav>
  </div>
</template>

<style scoped>
.layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f3f4f8;
  overflow: hidden;
}

.content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* Tabbar is NOT fixed — it lives in the flex column, constrained by body max-width */
.tabbar {
  flex-shrink: 0;
  height: 60px;
  background: white;
  border-top: 1px solid #f0f0f5;
  display: flex;
  align-items: center;
  padding-bottom: env(safe-area-inset-bottom);
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  cursor: pointer;
  color: #9ca3af;
  padding: 4px 0;
  transition: color 0.15s;
}

.tab-item.active {
  color: #6b6ef5;
}

.tab-label {
  font-size: 11px;
  font-weight: 500;
  color: inherit;
}

/* Record button: same visual weight as other 24px icons */
.rec-sq {
  width: 26px;
  height: 26px;
  border: 1.5px solid #d1d5db;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.rec-sq.active {
  background: #6b6ef5;
  border-color: #6b6ef5;
}
</style>
