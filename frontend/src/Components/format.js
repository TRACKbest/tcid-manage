export const formatAriary = (value) => `${Number(value || 0).toLocaleString('fr-FR')} Ar`

export const formatDateTime = (value) => (value ? new Date(value).toLocaleString('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
}) : '—')

export const paymentStatusLabels = {
  pending: 'En attente de validation',
  validated: 'Validé',
  rejected: 'Refusé',
}

export const paymentMethodIcons = {
  orange_money: '🟠',
  airtel_money: '🔴',
  mvola: '🟢',
}

export const readStorage = (key, fallback = null) => {
  try {
    const value = window.localStorage.getItem(key)
    return value === null ? fallback : JSON.parse(value)
  } catch {
    return fallback
  }
}

export const writeStorage = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage can be unavailable (private mode); progress is only a convenience.
  }
}
