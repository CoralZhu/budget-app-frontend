<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const nickname = ref(authStore.user.username)
const gender = ref(authStore.user.gender || '男')
const bio = ref(authStore.user.bio || '')
const showGenderPicker = ref(false)

const genderOptions = [{ text: '男', value: '男' }, { text: '女', value: '女' }, { text: '不透露', value: '不透露' }]

function onGenderConfirm({ selectedValues }) {
  gender.value = selectedValues[0]
  showGenderPicker.value = false
}

function save() {
  authStore.updateUser({
    username: nickname.value,
    gender: gender.value,
    bio: bio.value,
  })
  showToast({ message: '已保存', icon: 'success' })
  router.back()
}
</script>

<template>
  <div class="page">
    <div class="nav-bar">
      <van-icon name="arrow-left" size="22" @click="router.back()" />
      <span class="nav-title">个人信息</span>
      <span class="nav-action" @click="save">保存</span>
    </div>

    <!-- Avatar -->
    <div class="card avatar-card">
      <div class="avatar">
        {{ authStore.user.username.charAt(0).toUpperCase() }}
      </div>
      <p class="change-avatar muted-action">头像暂不可更换</p>
    </div>

    <!-- Profile fields -->
    <div class="card">
      <div class="field-row">
        <span class="field-label">昵称</span>
        <input v-model="nickname" class="field-input" placeholder="请输入昵称" />
      </div>
      <div class="divider"></div>
      <div class="field-row" @click="showGenderPicker = true">
        <span class="field-label">性别</span>
        <div class="field-right">
          <span class="field-val">{{ gender }}</span>
          <van-icon name="arrow" color="#d1d5db" size="14" />
        </div>
      </div>
      <div class="divider"></div>
      <div class="field-row disabled">
        <span class="field-label">生日</span>
        <div class="field-right">
          <span class="field-val muted">未设置</span>
        </div>
      </div>
      <div class="divider"></div>
      <div class="field-row">
        <span class="field-label">个性签名</span>
        <input v-model="bio" class="field-input text-right" placeholder="介绍一下自己" />
      </div>
    </div>

    <!-- Account info -->
    <p class="section-label">账号</p>
    <div class="card">
      <div class="field-row">
        <span class="field-label">邮箱</span>
        <div class="field-right">
          <span class="field-val">{{ authStore.user.email }}</span>
          <span class="verified-badge">已验证</span>
        </div>
      </div>
      <div class="divider"></div>
      <div class="field-row disabled">
        <span class="field-label">手机号</span>
        <div class="field-right">
          <span class="field-val muted">未绑定</span>
        </div>
      </div>
      <div class="divider"></div>
      <div class="field-row disabled">
        <span class="field-label">修改密码</span>
        <div class="field-right">
          <span class="field-val muted">暂不支持</span>
        </div>
      </div>
    </div>

    <!-- Gender picker -->
    <van-popup v-model:show="showGenderPicker" position="bottom" round>
      <van-picker
        :columns="genderOptions"
        @confirm="onGenderConfirm"
        @cancel="showGenderPicker = false"
      />
    </van-popup>
  </div>
</template>

<style scoped>
.page {
  min-height: -webkit-fill-available;
  min-height: 100dvh;
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

.field-row.disabled {
  opacity: 0.6;
}

.muted-action {
  color: #9ca3af;
}

.card {
  background: white;
  border-radius: 20px;
  padding: 4px 16px;
  margin-bottom: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.avatar-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px;
}

.avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: #eaebfe;
  color: #6b6ef5;
  font-size: 32px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  border: 3px solid white;
  box-shadow: 0 4px 16px rgba(107, 110, 245, 0.2);
}

.change-avatar {
  font-size: 14px;
  color: #6b6ef5;
  cursor: pointer;
}

.field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  min-height: 52px;
}

.divider {
  height: 1px;
  background: #f5f6fa;
}

.field-label {
  font-size: 15px;
  color: #6b7280;
  flex-shrink: 0;
  width: 72px;
}

.field-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 15px;
  color: #1a1a2e;
  background: transparent;
  text-align: right;
}

.field-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.field-val {
  font-size: 15px;
  color: #1a1a2e;
}

.field-val.muted {
  color: #9ca3af;
}

.verified-badge {
  background: #d1fae5;
  color: #059669;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 500;
}

.section-label {
  font-size: 13px;
  color: #9ca3af;
  margin-bottom: 10px;
}

.text-right {
  text-align: right;
}
</style>
