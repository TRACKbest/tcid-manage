const relativeTimeFormatter = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })

export default function relativeMessageTime(value) {
  const messageDate = new Date(value)
  if (Number.isNaN(messageDate.getTime())) return ''

  const elapsedMinutes = Math.floor((Date.now() - messageDate.getTime()) / 60000)
  if (elapsedMinutes < 1) return 'à l’instant'
  if (elapsedMinutes < 60) return relativeTimeFormatter.format(-elapsedMinutes, 'minute')

  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return relativeTimeFormatter.format(-elapsedHours, 'hour')

  const elapsedDays = Math.floor(elapsedHours / 24)
  if (elapsedDays < 7) return relativeTimeFormatter.format(-elapsedDays, 'day')

  return messageDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}