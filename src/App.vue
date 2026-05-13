<script setup>
import { ref } from 'vue'

const show = ref(false)
</script>

<template>
  <div style="padding: 20px">
    <h1>智能记账</h1>
    <p>这是测试 Vant 是否能用</p>

    <van-button type="primary" @click="show = true"> 点我试试 Vant 按钮 </van-button>

    <van-toast v-model:show="show" message="Vant 装好了!" />
  </div>
</template>
