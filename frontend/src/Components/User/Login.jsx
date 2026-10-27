import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'

// Learner sign-in now lives on /user-register (Google + e-mail, sign-in and sign-up tabs).
const Login = () => {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  params.set('mode', 'login')
  return <Navigate replace to={`/user-register?${params}`} />
}

export default Login
