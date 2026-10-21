import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { formatAriary, paymentMethodIcons } from './format'
import './CourseExperience.css'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const PaymentModal = ({ course, studentId, onClose, onSubmitted }) => {
  const [methods, setMethods] = useState([])
  const [method, setMethod] = useState('')
  const [amount, setAmount] = useState(String(course.price || ''))
  const [reference, setReference] = useState('')
  const [payerPhone, setPayerPhone] = useState('')
  const [copied, setCopied] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(null)

  useEffect(() => {
    let active = true
    axios.get(`${baseUrl}/payment-methods/`)
      .then((response) => {
        if (!active) return
        setMethods(response.data)
        if (response.data.length) setMethod(response.data[0].code)
      })
      .catch(() => {
        if (active) setError('Les numéros de paiement n’ont pas pu être chargés. Réessayez dans un instant.')
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape' && !submitting) onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose, submitting])

  const selected = methods.find((item) => item.code === method)

  const copyNumber = async (number) => {
    try {
      await navigator.clipboard.writeText(number)
      setCopied(number)
      window.setTimeout(() => setCopied(''), 2000)
    } catch {
      setCopied('')
    }
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!studentId) {
      setError('Connectez-vous avec votre compte apprenant pour envoyer le paiement.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const response = await axios.post(`${baseUrl}/courses/${course.id}/payments/`, {
        student_id: studentId,
        method,
        amount: amount.replace(/\s/g, ''),
        reference: reference.trim(),
        payer_phone: payerPhone.trim(),
      })
      setSubmitted(response.data)
      onSubmitted?.(response.data)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Le paiement n’a pas pu être envoyé. Vérifiez votre connexion.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="cx-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !submitting) onClose()
    }}>
      <section className="cx-modal" role="dialog" aria-modal="true" aria-labelledby="payment-title">
        <header className="cx-modal-header">
          <div>
            <p className="cx-eyebrow">DÉBLOQUER LA FORMATION</p>
            <h2 id="payment-title">{course.title}</h2>
            <p className="cx-modal-price">Prix fixé par le formateur : <strong>{formatAriary(course.price)}</strong></p>
          </div>
          <button className="cx-icon-button" type="button" onClick={onClose} aria-label="Fermer" disabled={submitting}>
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </header>

        {submitted ? (
          <div className="cx-payment-success" role="status">
            <i className="bi bi-hourglass-split" aria-hidden="true" />
            <h3>Paiement envoyé !</h3>
            <p>
              L’administrateur va vérifier la référence <strong>{submitted.reference}</strong> ({formatAriary(submitted.amount)}).
              Vous recevrez une notification dès que toutes les vidéos seront débloquées.
            </p>
            <button className="cx-button cx-button-primary" type="button" onClick={onClose}>J’ai compris</button>
          </div>
        ) : (
          <form className="cx-payment-body" onSubmit={submit}>
            <ol className="cx-steps">
              <li><span>1</span>Choisissez votre opérateur et envoyez <strong>{formatAriary(course.price)}</strong> au numéro affiché.</li>
              <li><span>2</span>Gardez le SMS de confirmation : il contient la <strong>référence</strong> (ex. 64494665).</li>
              <li><span>3</span>Saisissez la référence et le montant ci-dessous, puis envoyez.</li>
            </ol>

            <fieldset className="cx-operators">
              <legend>Système de paiement</legend>
              {methods.map((item) => (
                <label className={`cx-operator ${method === item.code ? 'is-selected' : ''}`} key={item.code} style={{ '--operator-color': item.color }}>
                  <input type="radio" name="method" value={item.code} checked={method === item.code} onChange={() => setMethod(item.code)} />
                  <span className="cx-operator-name">{paymentMethodIcons[item.code]} {item.label}</span>
                  <span className="cx-operator-number">{item.number}</span>
                  <span className="cx-operator-holder">{item.holder}</span>
                  <button className="cx-copy" type="button" onClick={(event) => { event.preventDefault(); copyNumber(item.number) }}>
                    <i className={`bi ${copied === item.number ? 'bi-check2' : 'bi-clipboard'}`} aria-hidden="true" />
                    {copied === item.number ? 'Copié' : 'Copier'}
                  </button>
                </label>
              ))}
              {!methods.length && !error && <p className="cx-muted">Chargement des numéros…</p>}
            </fieldset>

            {selected && (
              <p className="cx-payment-hint">
                <i className="bi bi-info-circle" aria-hidden="true" /> Envoyez le paiement via <strong>{selected.label}</strong> au <strong>{selected.number}</strong> ({selected.holder}).
              </p>
            )}

            <div className="cx-form-grid">
              <label>
                <span>Référence de la transaction <b>*</b></span>
                <input required autoComplete="off" inputMode="text" maxLength="64" minLength="4" placeholder="Ex. 64494665" value={reference} onChange={(event) => setReference(event.target.value)} />
              </label>
              <label>
                <span>Montant payé (Ar) <b>*</b></span>
                <input required inputMode="numeric" pattern="[0-9 ]+" value={amount} onChange={(event) => setAmount(event.target.value)} />
              </label>
              <label className="is-wide">
                <span>Numéro utilisé pour payer <small>(facultatif)</small></span>
                <input inputMode="tel" maxLength="20" placeholder="03X XX XXX XX" value={payerPhone} onChange={(event) => setPayerPhone(event.target.value)} />
              </label>
            </div>

            {error && <div className="cx-alert" role="alert">{error}</div>}

            <footer className="cx-modal-footer">
              <span className="cx-muted"><i className="bi bi-shield-check" aria-hidden="true" /> Validation manuelle par l’administrateur</span>
              <button className="cx-button cx-button-primary" type="submit" disabled={submitting || !method || !reference.trim() || !amount.trim()}>
                {submitting ? 'Envoi…' : 'Envoyer la référence'}
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
  )
}

export default PaymentModal
