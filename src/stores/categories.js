import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useCategoriesStore = defineStore('categories', () => {
  const categories = ref([
    { id: 1, name: '餐饮', icon: '🍴', bg: '#fff3e6', color: '#f59e0b', isDefault: true, type: 'expense' },
    { id: 2, name: '饮品', icon: '☕', bg: '#ede9fe', color: '#7c3aed', isDefault: true, type: 'expense' },
    { id: 3, name: '交通', icon: '🚇', bg: '#dbeafe', color: '#2563eb', isDefault: true, type: 'expense' },
    { id: 4, name: '购物', icon: '🛍️', bg: '#fce7f3', color: '#db2777', isDefault: true, type: 'expense' },
    { id: 5, name: '教育', icon: '📚', bg: '#d1fae5', color: '#059669', isDefault: true, type: 'expense' },
    { id: 6, name: '娱乐', icon: '🎮', bg: '#fef3c7', color: '#d97706', isDefault: true, type: 'expense' },
    { id: 7, name: '医疗', icon: '💊', bg: '#ccfbf1', color: '#0d9488', isDefault: true, type: 'expense' },
    { id: 8, name: '奶茶专项', icon: '🧋', bg: '#fce7f3', color: '#db2777', isDefault: false, type: 'expense' },
    { id: 9, name: '宠物开支', icon: '🐾', bg: '#fee2e2', color: '#dc2626', isDefault: false, type: 'expense' },
    { id: 10, name: '工资', icon: '💰', bg: '#d1fae5', color: '#059669', isDefault: true, type: 'income' },
    { id: 11, name: '兼职', icon: '💼', bg: '#dbeafe', color: '#2563eb', isDefault: true, type: 'income' },
    { id: 12, name: '其他收入', icon: '🎁', bg: '#fef3c7', color: '#d97706', isDefault: true, type: 'income' },
  ])

  function getCategoryById(id) {
    return categories.value.find((c) => c.id === id)
  }

  function addCategory(cat) {
    const newCat = { ...cat, id: Date.now(), isDefault: false }
    categories.value.push(newCat)
    return newCat
  }

  function removeCategory(id) {
    const idx = categories.value.findIndex((c) => c.id === id)
    if (idx > -1) categories.value.splice(idx, 1)
  }

  return { categories, getCategoryById, addCategory, removeCategory }
})
