const CATEGORY_ICONS = {
  餐饮: '🍴',
  饮品: '☕',
  交通: '🚇',
  购物: '🛍️',
  教育: '📚',
  娱乐: '🎮',
  医疗: '💊',
  工资: '💰',
  兼职: '💼',
  其他收入: '🎁',
}

const CATEGORY_BG = {
  餐饮: '#fff3e6',
  饮品: '#ede9fe',
  交通: '#dbeafe',
  购物: '#fce7f3',
  教育: '#d1fae5',
  娱乐: '#fef3c7',
  医疗: '#ccfbf1',
  工资: '#d1fae5',
  兼职: '#dbeafe',
  其他收入: '#fef3c7',
}

export function getTransactionCategory(tx) {
  return tx.categoryName || tx.category || '其他'
}

export function getTransactionTitle(tx) {
  return tx.merchant || getTransactionCategory(tx)
}

export function formatTransactionTime(value) {
  const date = new Date(value)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((today - target) / 86400000)

  if (diffDays === 0) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  if (diffDays === 1) {
    return '昨天'
  }

  return `${date.getMonth() + 1}月${date.getDate()}日`
}

export function getTransactionMeta(tx) {
  return `${getTransactionCategory(tx)} · ${formatTransactionTime(tx.spentAt)}`
}

export function formatTransactionAmount(tx) {
  const sign = tx.type === 'income' ? '+' : '-'
  const amount = Number(tx.amount || 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${sign}¥${amount}`
}

export function getTransactionIcon(tx) {
  return CATEGORY_ICONS[getTransactionCategory(tx)] || '💳'
}

export function getTransactionIconBg(tx) {
  return CATEGORY_BG[getTransactionCategory(tx)] || '#f3f4f6'
}
