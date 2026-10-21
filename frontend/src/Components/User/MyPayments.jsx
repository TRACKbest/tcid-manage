import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import Sidebar from './Sidebar'
import { formatAriary, formatDateTime, paymentMethodIcons, paymentStatusLabels } from '../format'
import '../CourseExperience.css'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const MyPayments = () => {
  const studentId = localStorage.getItem('studentId')
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'TCiD Center | Mes paiements'
    if (!studentId) {
      setError('Connectez-vous pour voir vos paiements.')
      setLoading(false)
      return
    }
    axios.get(`${baseUrl}/student/${studentId}/payments/`)
      .then((response) => setPayments(response.data))
      .catch(() => setError('Vos paiements n’ont pas pu être chargés.'))
      .finally(() => setLoading(false))
  }, [studentId])

  return (
    <div className="container mt-4">
      <div className="row">
        <aside className="col-md-3"><Sidebar /></aside>
        <section className="col-md-9 cx-page pt-0">
          <p className="cx-eyebrow">ESPACE APPRENANT</p>
          <h1 className="h3">Mes paiements</h1>
          <p className="cx-muted mb-3">Suivez la validation de vos paiements mobile money. Une notification vous prévient dès qu’une formation est débloquée.</p>
          {error && <div className="cx-alert" role="alert">{error}</div>}
          {loading && <p className="cx-muted" role="status">Chargement…</p>}
          {!loading && !error && payments.length === 0 && (
            <div className="cx-empty"><i className="bi bi-wallet2" aria-hidden="true" /><h2 className="h5">Aucun paiement</h2><p>Les formations payantes se débloquent depuis leur page.</p><Link className="cx-button cx-button-primary" to="/all-courses">Découvrir les formations</Link></div>
          )}
          {payments.length > 0 && (
            <div className="cx-table-wrap">
              <table className="cx-table">
                <thead><tr><th>Formation</th><th>Opérateur</th><th>Référence</th><th>Montant</th><th>Date</th><th>Statut</th></tr></thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td><Link to={`/detail/${payment.course}`}>{payment.course_title}</Link><br /><small className="cx-muted">{payment.teacher_name}</small></td>
                      <td>{paymentMethodIcons[payment.method]} {payment.method_label}</td>
                      <td><code>{payment.reference}</code></td>
                      <td>{formatAriary(payment.amount)}</td>
                      <td>{formatDateTime(payment.created_at)}</td>
                      <td>
                        <span className={`cx-badge cx-badge-${payment.status}`}>{paymentStatusLabels[payment.status]}</span>
                        {payment.status === 'rejected' && payment.admin_note && <small className="d-block mt-1 text-danger">{payment.admin_note}</small>}
                        {payment.status === 'validated' && <Link className="d-block mt-1 small" to={`/mini/${payment.course}`}>Regarder la formation →</Link>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default MyPayments
