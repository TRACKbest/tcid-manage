import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import { completeStudentLogin } from './Register'
import './LearnerAuth.css'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const GoogleAuthComplete = () => {
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'TCiD Center | Connexion Google'
    const params = new URLSearchParams(window.location.hash.slice(1))
    window.history.replaceState(null, '', window.location.pathname)
    const token = params.get('token')
    const next = params.get('next') || '/user-dashboard'
    if (!token) {
      setError('Lien de connexion invalide.')
      return
    }
    axios.post(`${baseUrl}/auth/google/exchange/`, { token })
      .then((response) => completeStudentLogin(response.data.student_id, next.startsWith('/') && !next.startsWith('//') ? next : '/user-dashboard'))
      .catch((requestError) => setError(requestError.response?.data?.detail || 'La connexion Google a échoué.'))
  }, [])

  return (
    <main className="learner-auth container">
      <section className="learner-auth-card is-centered">
        {error ? (
          <>
            <h1>Connexion impossible</h1>
            <div className="learner-auth-alert" role="alert">{error}</div>
            <Link className="learner-auth-submit" to="/user-register?mode=login">Revenir à la connexion</Link>
          </>
        ) : (
          <p role="status">Connexion avec Google…</p>
        )}
      </section>
    </main>
  )
}

export default GoogleAuthComplete
