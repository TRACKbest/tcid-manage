import React, { useEffect, useState } from 'react'
import axios from 'axios'
import TeacherSidebar from './TeacherSidebar'
import { formatAriary, formatDateTime, paymentMethodIcons, paymentStatusLabels } from '../format'
import '../CourseExperience.css'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const TeacherPayments = () => {
  const teacherId = localStorage.getItem('teacherId')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'TCiD Center | Paiements reçus'
    if (!teacherId) {
      setError('Connectez-vous comme formateur.')
      return
    }
    axios.get(`${baseUrl}/teacher/${teacherId}/payments/`)
      .then((response) => setData(response.data))
      .catch(() => setError('Les paiements n’ont pas pu être chargés.'))
  }, [teacherId])

  return (
    <div className="container mt-4">
      <div className="row">
        <aside className="col-md-3"><TeacherSidebar /></aside>
        <section className="col-md-9 cx-page pt-0">
          <p className="cx-eyebrow">ESPACE FORMATEUR</p>
          <h1 className="h3">Paiements de mes formations</h1>
          <p className="cx-muted mb-3">Les paiements sont vérifiés et validés par l’administrateur. Un apprenant validé accède automatiquement à toutes vos vidéos.</p>
          {error && <div className="cx-alert" role="alert">{error}</div>}
          {!data && !error && <p className="cx-muted" role="status">Chargement…</p>}
          {data && (
            <>
              <div className="cx-kpis">
                <div className="cx-kpi"><span>Revenus validés</span><strong>{formatAriary(data.revenue)}</strong></div>
                <div className="cx-kpi"><span>Apprenants payants</span><strong>{data.validated_count}</strong></div>
                <div className="cx-kpi"><span>En attente de validation</span><strong>{data.pending_count}</strong></div>
              </div>
              {data.payments.length === 0 ? (
                <div className="cx-empty"><i className="bi bi-cash-coin" aria-hidden="true" /><h2 className="h5">Aucun paiement pour l’instant</h2><p>Fixez un prix à vos formations depuis « Mes formations ».</p></div>
              ) : (
                <div className="cx-table-wrap">
                  <table className="cx-table">
                    <thead><tr><th>Apprenant</th><th>Formation</th><th>Opérateur</th><th>Montant</th><th>Date</th><th>Statut</th></tr></thead>
                    <tbody>
                      {data.payments.map((payment) => (
                        <tr key={payment.id}>
                          <td>{payment.student_name}</td>
                          <td>{payment.course_title}</td>
                          <td>{paymentMethodIcons[payment.method]} {payment.method_label}</td>
                          <td>{formatAriary(payment.amount_received || payment.amount)}</td>
                          <td>{formatDateTime(payment.created_at)}</td>
                          <td><span className={`cx-badge cx-badge-${payment.status}`}>{paymentStatusLabels[payment.status]}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}

export default TeacherPayments
