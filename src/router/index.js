import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // 未登录区
    { path: '/', name: 'splash', component: () => import('@/views/SplashView.vue') },
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue') },
    { path: '/register', name: 'register', component: () => import('@/views/RegisterView.vue') },

    // 主体区（共享底部 Tab 栏）
    {
      path: '/app',
      component: () => import('@/views/TabLayout.vue'),
      children: [
        { path: '', redirect: { name: 'home' } },
        { path: 'home', name: 'home', component: () => import('@/views/HomeView.vue') },
        { path: 'detail', name: 'detail', component: () => import('@/views/DetailView.vue') },
        { path: 'profile', name: 'profile', component: () => import('@/views/ProfileView.vue') },
      ],
    },

    // 记账页（独立全屏，有自己的底部 mode bar）
    { path: '/record', name: 'record', component: () => import('@/views/RecordView.vue') },

    // 二级页面（无底部 Tab 栏）
    {
      path: '/edit-transaction/:id',
      name: 'edit-transaction',
      component: () => import('@/views/EditTransactionView.vue'),
    },
    { path: '/budget', name: 'budget', component: () => import('@/views/BudgetView.vue') },
    {
      path: '/budget-chat',
      name: 'BudgetChat',
      component: () => import('@/views/BudgetChatView.vue'),
    },
    { path: '/category', name: 'category', component: () => import('@/views/CategoryView.vue') },
    { path: '/import', name: 'import', component: () => import('@/views/ImportView.vue') },
    {
      path: '/personal-info',
      name: 'personal-info',
      component: () => import('@/views/PersonalInfoView.vue'),
    },
  ],
})

export default router
