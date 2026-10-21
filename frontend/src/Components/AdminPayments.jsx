import React, { useCallback, useEffect, useState } from 'react'
import { formatAriary, paymentMethodIcons, paymentStatusLabels } from './format'

const shortDate = (value) => (value ? new Date(value).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—')

const STATUS_TABS = [
  { value: 'pending', label: 'À vérifier' },
  { value: 'validated', label: 'Validés' },
  { value: 'rejected', label: 'Refusés' },
  { value: 'all', label: 'Tous' },
]

const REJECT_REASONS = [
  'Référence introuvable sur notre compte',
  'Montant reçu inférieur au prix',
  'Paiement déjà utilisé pour une autre formation',
]

function PaymentReview({ payment, request, onClose, onDone }) {
  const [mode, setMode] = useState('validate')
  const [reference, setReference] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const normalized = reference.replace(/\s/g, '').toUpperCase()
  const matches = normalized && normalized === payment.reference
  const amountValue = Number(amount.replace(/\s/g, ''))

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const body = mode === 'validate'
        ? { reference: normalized, amount_received: amountValue }
        : { note: note.trim() }
      await request(`payments/${payment.id}/${mode}/`, { method: 'POST', body: JSON.stringify(body) })
      onDone(mode === 'validate'
        ? `Paiement validé : ${payment.student_name} a maintenant accès à « ${payment.course_title} ».`
        : `Paiement refusé. ${payment.student_name} a été prévenu.`)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
      <section className="admin-editor admin-payment-review" role="dialog" aria-modal="true" aria-labelledby="payment-review-title">
        <header>
          <div><p className="admin-kicker">VÉRIFICATION DU PAIEMENT</p><h2 id="payment-review-title">{payment.course_title}</h2></div>
          <button onClick={onClose} aria-label="Fermer" disabled={busy}>×</button>
        </header>
        <form onSubmit={submit}>
          <dl className="admin-payment-facts">
            <div><dt>Apprenant</dt><dd>{payment.student_name}<small>{payment.student_email}</small></dd></div>
            <div><dt>Formateur</dt><dd>{payment.teacher_name}</dd></div>
            <div><dt>Opérateur</dt><dd>{paymentMethodIcons[payment.method]} {payment.method_label}{payment.payer_phone && <small>Depuis le {payment.payer_phone}</small>}</dd></div>
            <div><dt>Prix de la formation</dt><dd>{formatAriary(payment.expected_amount)}</dd></div>
            <div><dt>Montant déclaré</dt><dd>{formatAriary(payment.amount)}</dd></div>
            <div><dt>Référence déclarée</dt><dd><code>{payment.reference}</code></dd></div>
          </dl>

          <div className="admin-segmented" role="tablist" aria-label="Décision">
            <button type="button" role="tab" aria-selected={mode === 'validate'} className={mode === 'validate' ? 'is-active' : ''} onClick={() => setMode('validate')}>✓ Valider</button>
            <button type="button" role="tab" aria-selected={mode === 'reject'} className={mode === 'reject' ? 'is-active is-danger' : ''} onClick={() => setMode('reject')}>✕ Refuser</button>
          </div>

          {mode === 'validate' ? (
            <div className="admin-form-fields">
              <p className="admin-form-hint is-wide">Ouvrez le SMS reçu sur le compte {payment.method_label} puis recopiez la référence et le montant reçus. La validation n’est acceptée que si la référence est identique.</p>
              <label className="admin-form-field">
                <span>Référence lue sur votre SMS <b> *</b></span>
                <input autoFocus required value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Ex. 64494665" />
                {reference && <small className={matches ? 'admin-match' : 'admin-mismatch'}>{matches ? '✓ Correspond à la référence de l’apprenant' : '✕ Ne correspond pas encore'}</small>}
              </label>
              <label className="admin-form-field">
                <span>Montant reçu (Ar) <b> *</b></span>
                <input required inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={String(payment.expected_amount)} />
                {amount && amountValue < payment.expected_amount && <small className="admin-mismatch">Inférieur au prix de la formation</small>}
              </label>
            </div>
          ) : (
            <div className="admin-form-fields">
              <label className="admin-form-field is-wide">
                <span>Motif communiqué à l’apprenant <b> *</b></span>
                <textarea required maxLength="300" value={note} onChange={(event) => setNote(event.target.value)} />
              </label>
              <div className="admin-chip-row is-wide">
                {REJECT_REASONS.map((reason) => <button type="button" key={reason} onClick={() => setNote(reason)}>{reason}</button>)}
              </div>
            </div>
          )}
          {error && <div className="admin-alert" role="alert">{error}</div>}
          <footer>
            <button type="button" className="admin-cancel-button" onClick={onClose} disabled={busy}>Annuler</button>
            {mode === 'validate'
              ? <button type="submit" className="admin-approve-button is-large" disabled={busy || !matches || !amount}>{busy ? 'Validation…' : 'Valider et débloquer la formation'}</button>
              : <button type="submit" className="admin-delete-button is-large" disabled={busy || !note.trim()}>{busy ? 'Envoi…' : 'Refuser le paiement'}</button>}
          </footer>
        </form>
      </section>
    </div>
  )
}

function AdminPayments({ request, onChanged }) {
  const [status, setStatus] = useState('pending')
  const [search, setSearch] = useState('')
  const [courseId, setCourseId] = useState('')
  const [data, setData] = useState({ results: [], counts: {}, courses: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reviewing, setReviewing] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const query = new URLSearchParams({ status })
    if (search.trim()) query.set('q', search.trim())
    if (courseId) query.set('course_id', courseId)
    try {
      setData(await request(`payments/?${query}`))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [request, status, search, courseId])

  useEffect(() => {
    const timer = window.setTimeout(load, search ? 300 : 0)
    return () => window.clearTimeout(timer)
  }, [load, search])

  const counts = data.counts || {}
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0)

  return (
    <section className="admin-resource-page">
      <div className="admin-page-heading">
        <div><p className="admin-kicker">FINANCES</p><h1>Paiements des formations</h1></div>
        <p>Seul l’administrateur peut valider un paiement. La validation débloque automatiquement la formation pour l’apprenant.</p>
      </div>
      {notice && <div className="admin-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Fermer">×</button></div>}
      {error && <div className="admin-alert" role="alert">{error}<button onClick={() => setError('')} aria-label="Fermer">×</button></div>}

      <div className="admin-tabs" role="tablist" aria-label="Statut des paiements">
        {STATUS_TABS.map((tab) => (
          <button key={tab.value} type="button" role="tab" aria-selected={status === tab.value} className={status === tab.value ? 'is-active' : ''} onClick={() => setStatus(tab.value)}>
            {tab.label}<span>{tab.value === 'all' ? total : counts[tab.value] || 0}</span>
          </button>
        ))}
      </div>

      <div className="admin-table-toolbar">
        <label className="admin-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Référence, apprenant, formation, formateur…" /></label>
        <select className="admin-select" value={courseId} onChange={(event) => setCourseId(event.target.value)} aria-label="Filtrer par formation">
          <option value="">Toutes les formations payantes</option>
          {(data.courses || []).map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
        </select>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-data-table admin-payments-table">
          <thead><tr><th>Date</th><th>Apprenant</th><th>Formation</th><th>Opérateur</th><th>Montant</th><th>Référence</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            {data.results.map((payment) => (
              <tr key={payment.id}>
                <td className="is-nowrap">{shortDate(payment.created_at)}</td>
                <td><strong>{payment.student_name}</strong><small className="admin-cell-sub">{payment.student_email}</small></td>
                <td>{payment.course_title}<small className="admin-cell-sub">{payment.teacher_name}</small></td>
                <td>{paymentMethodIcons[payment.method]} {payment.method_label}</td>
                <td>{formatAriary(payment.amount_received || payment.amount)}{payment.amount < payment.expected_amount && <small className="admin-mismatch">Prix : {formatAriary(payment.expected_amount)}</small>}</td>
                <td><code>{payment.reference}</code></td>
                <td><span className={`admin-status admin-status-${payment.status}`}>{paymentStatusLabels[payment.status]}</span>{payment.admin_note && <small className="admin-cell-sub">{payment.admin_note}</small>}</td>
                <td className="admin-row-actions">{payment.status === 'pending' ? <button className="admin-approve-button" onClick={() => setReviewing(payment)}>Vérifier</button> : <small className="admin-cell-sub">{shortDate(payment.reviewed_at)}</small>}</td>
              </tr>
            ))}
            {!loading && data.results.length === 0 && <tr><td className="admin-empty-cell" colSpan="8">{status === 'pending' ? 'Aucun paiement à vérifier. 🎉' : 'Aucun paiement à afficher.'}</td></tr>}
          </tbody>
        </table>
        {loading && <div className="admin-table-loading">Chargement…</div>}
      </div>

      {reviewing && (
        <PaymentReview
          payment={reviewing}
          request={request}
          onClose={() => setReviewing(null)}
          onDone={(message) => {
            setReviewing(null)
            setNotice(message)
            load()
            onChanged?.()
          }}
        />
      )}
    </section>
  )
}

export default AdminPayments
