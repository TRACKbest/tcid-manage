import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { Link, useSearchParams } from 'react-router-dom'
import GoogleSignInButton from './GoogleSignInButton'
import './LearnerAuth.css'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const googleMessages = {
  pending: 'Votre compte Google est enregistré. Il sera accessible dès que l’administrateur l’aura validé.',
  blocked: 'Ce compte apprenant est bloqué. Contactez l’administration.',
  unverified: 'Votre adresse Google n’est pas vérifiée. Utilisez un autre compte Google.',
  cancelled: 'Connexion Google annulée.',
  expired: 'La connexion Google a expiré. Recommencez.',
  unavailable: 'La connexion Google n’est pas encore activée sur le site.',
  failed: 'La connexion Google a échoué. Réessayez dans un instant.',
}

const fieldLabels = {
  fullname: 'Nom complet',
  email: 'Adresse e-mail',
  password: 'Mot de passe',
  username: 'Nom d’utilisateur',
  interseted_categories: 'Centres d’intérêt',
  profile_img: 'Photo de profil',
  non_field_errors: 'Inscription',
}

const emptyRegistration = { fullname: '', email: '', password: '', username: '', interseted_categories: '' }

const completeStudentLogin = (studentId, next = '/user-dashboard') => {
  localStorage.removeItem('teacherLoginStatus')
  localStorage.removeItem('teacherId')
  localStorage.setItem('activeAccountType', 'student')
  localStorage.setItem('studentLoginStatus', 'true')
  localStorage.setItem('studentId', studentId)
  window.location.assign(next)
}

const Register = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const mode = searchParams.get('mode') === 'login' ? 'login' : 'register'
  const googleCode = searchParams.get('google')
  const next = searchParams.get('next') || '/user-dashboard'
  const [login, setLogin] = useState({ email: '', password: '' })
  const [registration, setRegistration] = useState(emptyRegistration)
  const [profileImage, setProfileImage] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    document.title = mode === 'login' ? 'TCiD Center | Connexion apprenant' : 'TCiD Center | Inscription apprenant'
    setError('')
  }, [mode])

  useEffect(() => {
    if (localStorage.getItem('studentLoginStatus') === 'true') window.location.assign('/user-dashboard')
  }, [])

  const switchMode = (value) => {
    const params = new URLSearchParams(searchParams)
    params.delete('google')
    if (value === 'login') params.set('mode', 'login')
    else params.delete('mode')
    setSearchParams(params, { replace: true })
  }

  const submitLogin = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    const formData = new FormData()
    formData.append('email', login.email)
    formData.append('password', login.password)
    try {
      const response = await axios.post(`${baseUrl}/student-login`, formData)
      if (response.data.bool === true) {
        completeStudentLogin(response.data.student_id, next)
        return
      }
      setError(response.data.status === 'pending_approval'
        ? 'Votre compte est en attente de validation par l’administrateur.'
        : 'Adresse e-mail ou mot de passe incorrect.')
    } catch (requestError) {
      console.error('Student login failed:', requestError.response?.data || requestError)
      setError('Connexion au serveur impossible. Réessayez dans un instant.')
    } finally {
      setSubmitting(false)
    }
  }

  const submitRegistration = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    const formData = new FormData()
    Object.entries(registration).forEach(([key, value]) => formData.append(key, value))
    if (profileImage) formData.append('profile_img', profileImage, profileImage.name)
    try {
      await axios.post(`${baseUrl}/student/`, formData)
      setRegistration(emptyRegistration)
      setProfileImage(null)
      setSuccess('Demande envoyée ! Votre compte sera accessible après validation par l’administrateur.')
    } catch (requestError) {
      const data = requestError.response?.data
      const messages = Object.entries(data || {}).flatMap(([field, values]) => (Array.isArray(values) ? values : [values])
        .filter((message) => typeof message === 'string')
        .map((message) => `${fieldLabels[field] || field} : ${message}`))
      setError(typeof data?.detail === 'string' ? data.detail : messages.join(' ') || 'Impossible de créer le compte. Réessayez.')
    } finally {
      setSubmitting(false)
    }
  }

  const updateRegistration = (event) => setRegistration((current) => ({ ...current, [event.target.name]: event.target.value }))

  return (
    <main className="learner-auth container">
      <section className="learner-auth-card">
        <header>
          <p className="learner-auth-kicker">ESPACE APPRENANT</p>
          <h1>{mode === 'login' ? 'Bon retour parmi nous' : 'Rejoignez TCiD Center'}</h1>
          <p>{mode === 'login' ? 'Connectez-vous pour reprendre vos formations.' : 'Créez votre compte en quelques secondes.'}</p>
        </header>

        {googleCode && googleMessages[googleCode] && (
          <div className={`learner-auth-alert ${googleCode === 'pending' ? 'is-info' : ''}`} role="status">{googleMessages[googleCode]}</div>
        )}

        <GoogleSignInButton next={next} />
        <div className="learner-auth-divider"><span>ou avec votre e-mail</span></div>

        <div className="learner-auth-tabs" role="tablist" aria-label="Connexion ou inscription">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'is-active' : ''} onClick={() => switchMode('login')}>Se connecter</button>
          <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'is-active' : ''} onClick={() => switchMode('register')}>Créer un compte</button>
        </div>

        {error && <div className="learner-auth-alert" role="alert">{error}</div>}
        {success && <div className="learner-auth-alert is-success" role="status">{success}</div>}

        {mode === 'login' ? (
          <form className="learner-auth-form" onSubmit={submitLogin}>
            <label><span>Adresse e-mail</span><input type="email" autoComplete="email" required value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })} placeholder="nom@exemple.com" /></label>
            <label><span>Mot de passe</span><input type="password" autoComplete="current-password" required value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} /></label>
            <button className="learner-auth-submit" type="submit" disabled={submitting}>{submitting ? 'Connexion…' : 'Se connecter'}</button>
          </form>
        ) : (
          <form className="learner-auth-form" onSubmit={submitRegistration}>
            <label><span>Nom complet</span><input name="fullname" autoComplete="name" required value={registration.fullname} onChange={updateRegistration} /></label>
            <label><span>Adresse e-mail</span><input name="email" type="email" autoComplete="email" required value={registration.email} onChange={updateRegistration} /></label>
            <div className="learner-auth-row">
              <label><span>Nom d’utilisateur</span><input name="username" autoComplete="username" required value={registration.username} onChange={updateRegistration} /></label>
              <label><span>Mot de passe <small>6 caractères min.</small></span><input name="password" type="password" autoComplete="new-password" minLength="6" required value={registration.password} onChange={updateRegistration} /></label>
            </div>
            <label><span>Centres d’intérêt</span><input name="interseted_categories" required value={registration.interseted_categories} onChange={updateRegistration} placeholder="Programmation, langues, mathématiques…" /></label>
            <label><span>Photo de profil <small>(facultative)</small></span><input type="file" accept="image/*" onChange={(event) => setProfileImage(event.target.files?.[0] || null)} /></label>
            <button className="learner-auth-submit" type="submit" disabled={submitting}>{submitting ? 'Envoi…' : 'Créer mon compte'}</button>
          </form>
        )}

        <p className="learner-auth-footer">Vous êtes formateur ? <Link to="/teacher-login">Espace formateur</Link></p>
      </section>
    </main>
  )
}

export { completeStudentLogin }
export default Register
