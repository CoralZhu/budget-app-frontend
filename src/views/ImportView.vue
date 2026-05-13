<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'

const router = useRouter()
const fileRef = ref(null)
const importing = ref(false)

const recentImports = ref([
  { id: 1, source: 'alipay', name: '支付宝 11月账单.csv', count: 42, skipped: 0, date: '11月30日' },
  { id: 2, source: 'wechat', name: '微信10月账单.csv', count: 28, skipped: 2, date: '10月31日' },
])

function openFile() {
  fileRef.value?.click()
}

async function onFileChange(e) {
  const file = e.target.files[0]
  if (!file) return
  if (!file.name.endsWith('.csv')) {
    showToast('请上传 CSV 格式文件')
    return
  }
  importing.value = true
  await new Promise((r) => setTimeout(r, 1500))
  importing.value = false
  showToast({ message: `已导入 ${Math.floor(Math.random() * 30 + 10)} 条记录`, icon: 'success' })
  recentImports.value.unshift({
    id: Date.now(),
    source: 'alipay',
    name: file.name,
    count: Math.floor(Math.random() * 40 + 10),
    skipped: 0,
    date: '今天',
  })
}
</script>

<template>
  <div class="page">
    <div class="nav-bar">
      <van-icon name="arrow-left" size="22" @click="router.back()" />
      <span class="nav-title">账单导入</span>
      <span></span>
    </div>

    <!-- Upload zone -->
    <div class="upload-zone" @click="openFile">
      <div class="upload-icon">
        <van-icon name="desktop-o" size="48" color="#6b6ef5" />
      </div>
      <p class="upload-title">点击上传账单文件</p>
      <p class="upload-hint">支持 CSV 格式，单个文件不超过 5MB</p>
      <van-button
        type="primary"
        round
        class="upload-btn"
        :loading="importing"
        @click.stop="openFile"
      >
        选择文件
      </van-button>
    </div>

    <input ref="fileRef" type="file" accept=".csv" class="hidden-input" @change="onFileChange" />

    <!-- Supported sources -->
    <p class="section-label">支持的来源</p>
    <div class="source-row">
      <div class="source-card">
        <div class="source-icon alipay">支</div>
        <div>
          <p class="source-name">支付宝</p>
          <p class="source-link">查看教程 →</p>
        </div>
      </div>
      <div class="source-card">
        <div class="source-icon wechat">微</div>
        <div>
          <p class="source-name">微信支付</p>
          <p class="source-link">查看教程 →</p>
        </div>
      </div>
    </div>

    <!-- Recent imports -->
    <p class="section-label">最近导入</p>
    <div class="card">
      <div
        v-for="(item, i) in recentImports"
        :key="item.id"
        class="import-item"
        :class="{ last: i === recentImports.length - 1 }"
      >
        <div :class="['item-icon', item.source === 'wechat' ? 'wechat' : 'alipay']">
          {{ item.source === 'wechat' ? '微' : '支' }}
        </div>
        <div class="item-info">
          <p class="item-name">{{ item.name }}</p>
          <p class="item-meta">
            成功导入 {{ item.count }} 条
            <span v-if="item.skipped"> · {{ item.skipped }} 条跳过</span>
            · {{ item.date }}
          </p>
        </div>
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

.upload-zone {
  background: white;
  border: 2px dashed #c7c9fb;
  border-radius: 20px;
  padding: 32px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  margin-bottom: 20px;
  background: rgba(107, 110, 245, 0.03);
}

.upload-icon {
  width: 72px;
  height: 72px;
  background: #eaebfe;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
}

.upload-title {
  font-size: 17px;
  font-weight: 600;
  color: #1a1a2e;
}

.upload-hint {
  font-size: 13px;
  color: #9ca3af;
}

.upload-btn {
  margin-top: 8px;
  padding: 0 28px;
  height: 44px;
}

.hidden-input {
  display: none;
}

.section-label {
  font-size: 13px;
  color: #9ca3af;
  margin-bottom: 10px;
}

.source-row {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.source-card {
  flex: 1;
  background: white;
  border-radius: 16px;
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.source-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.source-icon.alipay {
  background: #1677ff;
}

.source-icon.wechat {
  background: #07c160;
}

.source-name {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
}

.source-link {
  font-size: 12px;
  color: #6b6ef5;
}

.card {
  background: white;
  border-radius: 20px;
  padding: 4px 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.import-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid #f5f6fa;
}

.import-item.last {
  border-bottom: none;
}

.item-icon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  font-size: 18px;
  font-weight: 700;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.item-icon.alipay { background: #1677ff }
.item-icon.wechat { background: #07c160 }

.item-info { flex: 1 }

.item-name {
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 4px;
}

.item-meta {
  font-size: 13px;
  color: #9ca3af;
}
</style>
