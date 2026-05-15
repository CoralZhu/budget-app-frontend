import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

function d(year, month, day, hour = 12, min = 0) {
  return new Date(year, month - 1, day, hour, min)
}

const MOCK = [
  { id: 1, categoryId: 1, categoryName: '餐饮', amount: 32, type: 'expense', merchant: '麦当劳', note: '', spentAt: d(2026, 5, 13, 10, 30), inputMethod: 'manual', aiConfidence: null },
  { id: 2, categoryId: 3, categoryName: '交通', amount: 4, type: 'expense', merchant: '地铁', note: '', spentAt: d(2026, 5, 13, 9, 15), inputMethod: 'manual', aiConfidence: null },
  { id: 3, categoryId: 2, categoryName: '饮品', amount: 38, type: 'expense', merchant: '星巴克', note: 'Coffee Chat with TA', spentAt: d(2026, 5, 12, 15, 20), inputMethod: 'photo', aiConfidence: 0.96 },
  { id: 4, categoryId: 4, categoryName: '购物', amount: 199, type: 'expense', merchant: '京东购物', note: '', spentAt: d(2026, 5, 12, 21, 45), inputMethod: 'manual', aiConfidence: null },
  { id: 5, categoryId: 1, categoryName: '餐饮', amount: 15, type: 'expense', merchant: '食堂', note: '', spentAt: d(2026, 5, 12, 12, 8), inputMethod: 'manual', aiConfidence: null },
  { id: 6, categoryId: 3, categoryName: '交通', amount: 56, type: 'expense', merchant: '滴滴打车', note: '', spentAt: d(2026, 5, 11, 22, 13), inputMethod: 'manual', aiConfidence: null },
  { id: 7, categoryId: 2, categoryName: '饮品', amount: 23, type: 'expense', merchant: '瑞幸咖啡', note: '', spentAt: d(2026, 5, 11, 8, 29), inputMethod: 'voice', aiConfidence: 0.88 },
  { id: 8, categoryId: 5, categoryName: '教育', amount: 298, type: 'expense', merchant: '网课平台', note: '', spentAt: d(2026, 5, 10, 14, 0), inputMethod: 'manual', aiConfidence: null },
  { id: 9, categoryId: 1, categoryName: '餐饮', amount: 48, type: 'expense', merchant: '海底捞', note: '', spentAt: d(2026, 5, 9, 19, 30), inputMethod: 'manual', aiConfidence: null },
  { id: 10, categoryId: 4, categoryName: '购物', amount: 275, type: 'expense', merchant: '优衣库', note: '', spentAt: d(2026, 5, 8, 16, 0), inputMethod: 'manual', aiConfidence: null },
  { id: 11, categoryId: 3, categoryName: '交通', amount: 232, type: 'expense', merchant: '高铁', note: '', spentAt: d(2026, 5, 7, 9, 0), inputMethod: 'manual', aiConfidence: null },
  { id: 12, categoryId: 2, categoryName: '饮品', amount: 292, type: 'expense', merchant: '奶茶', note: '', spentAt: d(2026, 5, 6, 15, 0), inputMethod: 'manual', aiConfidence: null },
  { id: 13, categoryId: 1, categoryName: '餐饮', amount: 848, type: 'expense', merchant: '外卖', note: '', spentAt: d(2026, 5, 5, 12, 0), inputMethod: 'import', aiConfidence: null },
  { id: 14, categoryId: 10, categoryName: '工资', amount: 3000, type: 'income', merchant: '学校补贴', note: '', spentAt: d(2026, 5, 1, 10, 0), inputMethod: 'manual', aiConfidence: null },
]

export const useTransactionsStore = defineStore('transactions', () => {
  const transactions = ref([...MOCK])
  const nextId = ref(MOCK.length + 1)

  const currentMonth = computed(() => {
    const now = new Date()
    return transactions.value.filter((t) => {
      const d = new Date(t.spentAt)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    })
  })

  const monthlyExpense = computed(() =>
    currentMonth.value.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
  )

  const categoryTotals = computed(() => {
    const map = {}
    currentMonth.value
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        if (!map[t.categoryName]) map[t.categoryName] = { name: t.categoryName, value: 0, categoryId: t.categoryId }
        map[t.categoryName].value += t.amount
      })
    return Object.values(map).sort((a, b) => b.value - a.value)
  })

  const recentFive = computed(() =>
    [...transactions.value]
      .filter((t) => t.type === 'expense')
      .sort((a, b) => new Date(b.spentAt) - new Date(a.spentAt))
      .slice(0, 5),
  )

  const groupedByDate = computed(() => {
    const sorted = [...transactions.value].sort(
      (a, b) => new Date(b.spentAt) - new Date(a.spentAt),
    )
    const groups = []
    let lastKey = null
    sorted.forEach((t) => {
      const d = new Date(t.spentAt)
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
      if (key !== lastKey) {
        groups.push({ dateKey: key, date: d, items: [], total: 0 })
        lastKey = key
      }
      const g = groups[groups.length - 1]
      g.items.push(t)
      if (t.type === 'expense') g.total += t.amount
    })
    return groups
  })

  function addTransaction(tx) {
    const id = tx.id ?? nextId.value++
    if (id >= nextId.value) nextId.value = id + 1
    transactions.value.unshift({ ...tx, id })
  }

  function updateTransaction(id, updates) {
    const idx = transactions.value.findIndex((t) => t.id === id)
    if (idx > -1) Object.assign(transactions.value[idx], updates)
  }

  function setTransactions(items) {
    transactions.value = [...items]
    const maxId = transactions.value.reduce((max, t) => Math.max(max, Number(t.id) || 0), 0)
    nextId.value = maxId + 1
  }

  function deleteTransaction(id) {
    const idx = transactions.value.findIndex((t) => t.id === id)
    if (idx > -1) transactions.value.splice(idx, 1)
  }

  function getById(id) {
    return transactions.value.find((t) => t.id === id)
  }

  return {
    transactions,
    currentMonth,
    monthlyExpense,
    categoryTotals,
    recentFive,
    groupedByDate,
    addTransaction,
    updateTransaction,
    setTransactions,
    deleteTransaction,
    getById,
  }
})
