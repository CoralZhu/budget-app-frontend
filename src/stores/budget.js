import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useBudgetStore = defineStore('budget', () => {
  const totalBudget = ref(3000)

  const categoryBudgets = ref([
    { id: 1, categoryId: 1, categoryName: '餐饮', icon: '🍴', bg: '#fff3e6', color: '#f59e0b', budgetAmount: 1200, spentAmount: 943 },
    { id: 2, categoryId: 3, categoryName: '交通', icon: '🚇', bg: '#dbeafe', color: '#2563eb', budgetAmount: 500, spentAmount: 292 },
    { id: 3, categoryId: 4, categoryName: '购物', icon: '🛍️', bg: '#fce7f3', color: '#db2777', budgetAmount: 400, spentAmount: 472 },
    { id: 4, categoryId: 2, categoryName: '饮品', icon: '☕', bg: '#ede9fe', color: '#7c3aed', budgetAmount: 500, spentAmount: 353 },
    { id: 5, categoryId: 5, categoryName: '教育', icon: '📚', bg: '#d1fae5', color: '#059669', budgetAmount: 300, spentAmount: 298 },
  ])

  const totalSpent = computed(() =>
    categoryBudgets.value.reduce((s, b) => s + b.spentAmount, 0),
  )

  const usagePercent = computed(() =>
    Math.round((totalSpent.value / totalBudget.value) * 100),
  )

  const remaining = computed(() => totalBudget.value - totalSpent.value)

  function setTotalBudget(amount) {
    totalBudget.value = amount
  }

  function addCategoryBudget(budget) {
    categoryBudgets.value.push({ ...budget, id: Date.now() })
  }

  function updateCategoryBudget(id, amount) {
    const b = categoryBudgets.value.find((b) => b.id === id)
    if (b) b.budgetAmount = amount
  }

  return {
    totalBudget,
    categoryBudgets,
    totalSpent,
    usagePercent,
    remaining,
    setTotalBudget,
    addCategoryBudget,
    updateCategoryBudget,
  }
})
