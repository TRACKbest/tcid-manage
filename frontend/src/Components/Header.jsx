import React from 'react'
import { useState } from 'react'
import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const Header = () => {
  const teacherLoginStatus=localStorage.getItem('teacherLoginStatus')
  const studentLoginStatus=localStorage.getItem('studentLoginStatus')
  const activeAccountType = localStorage.getItem('activeAccountType')
  const location = useLocation()
  const studentPaths = ['/user-', '/my-courses', '/my-teachers', '/favorite-courses', '/recommended-courses', '/profile-setting', '/change-password', '/my-assignments', '/course-quiz', '/take-quiz']
  const teacherPaths = ['/teacher-', '/my-users', '/add-course', '/add-assignment', '/show-assignment', '/enrolled-students', '/study-material', '/attempted-students']
  const routeAccountType = studentPaths.some((path) => location.pathname.startsWith(path))
    ? 'student'
    : teacherPaths.some((path) => location.pathname.startsWith(path))
      ? 'teacher'
      : ''
  const preferredAccountType = activeAccountType || routeAccountType
  const recipientType = preferredAccountType === 'teacher' && teacherLoginStatus === 'true'
    ? 'teacher'
    : preferredAccountType === 'student' && studentLoginStatus === 'true'
      ? 'student'
      : teacherLoginStatus === 'true' ? 'teacher' : studentLoginStatus === 'true' ? 'student' : ''
  const recipientId = recipientType ? localStorage.getItem(`${recipientType}Id`) : ''
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [openAccountMenu, setOpenAccountMenu] = useState('')
  const unreadCount = notifications.filter(notification => !notification.is_read).length

  const closeMenu = () => {
    setMenuOpen(false)
    setOpenAccountMenu('')
  }
  
  useEffect(() => {
    if (!recipientType || !recipientId) {
      setNotifications([])
      return undefined
    }

    const loadNotifications = async () => {
      try {
        const response = await axios.get(`${baseUrl}/notifications/${recipientType}/${recipientId}/`)
        setNotifications(response.data)
      } catch (error) {
        console.error('Could not load notifications:', error.response?.data || error)
      }
    }

    loadNotifications()
    const intervalId = window.setInterval(loadNotifications, 30000)
    return () => window.clearInterval(intervalId)
  }, [recipientType, recipientId])

  useEffect(() => {
    if (!recipientType || !recipientId) return undefined

    const checkAccountStatus = async () => {
      try {
        const response = await axios.get(`${baseUrl}/${recipientType}/${recipientId}/`)
        if (response.data.is_active === false) {
          localStorage.removeItem(`${recipientType}Id`)
          localStorage.removeItem(`${recipientType}LoginStatus`)
          navigate(recipientType === 'teacher' ? '/teacher-login' : '/user-login', { replace: true })
        }
      } catch (error) {
        console.error('Could not verify account status:', error.response?.data || error)
      }
    }

    checkAccountStatus()
    const intervalId = window.setInterval(checkAccountStatus, 30000)
    return () => window.clearInterval(intervalId)
  }, [recipientType, recipientId, navigate])

  const openNotification = async (notification) => {
    if (!notification.is_read) {
      try {
        await axios.post(`${baseUrl}/notifications/${recipientType}/${recipientId}/${notification.id}/read/`)
      } catch (error) {
        console.error('Could not mark notification as read:', error.response?.data || error)
      }
      setNotifications(currentNotifications => currentNotifications.map(item =>
        item.id === notification.id ? { ...item, is_read: true } : item
      ))
    }
    setNotificationsOpen(false)
    closeMenu()
    navigate(notification.link)
  }

  return (
    <>
    <nav className="navbar navbar-expand-lg bg-white navbar-light shadow sticky-top p-0">
        <Link to="/" className="navbar-brand d-flex align-items-center px-4 px-lg-5">
          <img
            src="/tcid-center-logo.png"
            alt=""
            aria-hidden="true"
            className="me-2"
            style={{ width: 48, height: 48, objectFit: 'contain' }}
          />
          <h2 className="m-0">TCiD Center</h2>
        </Link>
        <button
          type="button"
          className="navbar-toggler me-4"
          aria-label={menuOpen ? 'Fermer le menu de navigation' : 'Ouvrir le menu de navigation'}
          aria-expanded={menuOpen}
          aria-controls="navbarCollapse"
          onClick={() => setMenuOpen(open => !open)}
        >
            <span className="navbar-toggler-icon"></span>
        </button>
        <div className={`collapse navbar-collapse${menuOpen ? ' show' : ''}`} id="navbarCollapse">
            <div className="navbar-nav ms-auto p-4 p-lg-0">
                <Link to="/" onClick={closeMenu} className="nav-item nav-link"><i className="bi bi-house-door" aria-hidden="true"></i>Accueil</Link>
                <Link to="/category" onClick={closeMenu} className="nav-item nav-link"><i className="bi bi-grid" aria-hidden="true"></i>Catégories</Link>
                <Link to="/all-courses" onClick={closeMenu} className="nav-item nav-link"><i className="bi bi-book" aria-hidden="true"></i>Cours</Link>
                {recipientType && recipientId && <div className="nav-item dropdown">
                  <button type="button" className="nav-link btn border-0 d-flex align-items-center gap-2" aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} non lues` : 'Notifications'} aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen(!notificationsOpen)}>
                    <i className="bi bi-bell" aria-hidden="true"></i>
                    {unreadCount > 0 && <span className="badge rounded-pill bg-danger">{unreadCount}</span>}
                  </button>
                  {notificationsOpen && <div className="dropdown-menu dropdown-menu-end show p-2" style={{ minWidth: '280px', maxWidth: 'min(90vw, 420px)', maxHeight: '70vh', overflowY: 'auto', zIndex: 1080 }}>
                    <h6 className="dropdown-header">Notifications</h6>
                    {notifications.length === 0 && <span className="dropdown-item-text text-muted">Aucune notification</span>}
                    {notifications.map(notification => <button type="button" key={notification.id} className={`dropdown-item text-wrap ${notification.is_read ? '' : 'fw-bold'}`} onClick={() => openNotification(notification)}>
                      <span className="d-block">{notification.subject}</span>
                      <small className="d-block text-muted">{notification.message}</small>
                      <small className="text-muted">{new Date(notification.created_at).toLocaleString()}</small>
                    </button>)}
                  </div>}
                </div>}
                <div className="nav-item dropdown">
                    <button type="button" className="nav-link dropdown-toggle" aria-expanded={openAccountMenu === 'teacher'} onClick={() => setOpenAccountMenu(openAccountMenu === 'teacher' ? '' : 'teacher')}><i className="bi bi-person-badge" aria-hidden="true"></i>Enseignant</button>
                    <div className={`dropdown-menu fade-down m-0${openAccountMenu === 'teacher' ? ' show' : ''}`}>
                    {teacherLoginStatus !== 'true' && 
                    <>
                      <li><Link className="dropdown-item" onClick={closeMenu} to="/teacher-login"><i className="bi bi-box-arrow-in-right me-2" aria-hidden="true"></i>Connexion</Link></li>
                      <li><Link className="dropdown-item" onClick={closeMenu} to="/teacher-register"><i className="bi bi-person-plus me-2" aria-hidden="true"></i>Inscription</Link></li>
                    </>
                    }
                    {teacherLoginStatus ==='true' && 
                    <>
                      <li><Link className="dropdown-item" onClick={closeMenu} to="/teacher-dashboard"><i className="bi bi-speedometer2 me-2" aria-hidden="true"></i>Tableau de bord</Link></li>
                      <li><Link className="dropdown-item" onClick={closeMenu} to="/teacher-logout"><i className="bi bi-box-arrow-right me-2" aria-hidden="true"></i>Déconnexion</Link></li>
                    </>
                    }
                    </div>
                </div>
                <div className="nav-item dropdown">
                    <button type="button" className="nav-link dropdown-toggle ps-0 px-5" aria-expanded={openAccountMenu === 'student'} onClick={() => setOpenAccountMenu(openAccountMenu === 'student' ? '' : 'student')}><i className="bi bi-mortarboard" aria-hidden="true"></i>Étudiant</button>
                    <div className={`dropdown-menu fade-down m-0${openAccountMenu === 'student' ? ' show' : ''}`}>
                    {studentLoginStatus !== 'true' && 
                    <>
                      <li><Link className="dropdown-item" onClick={closeMenu} to="/user-login"><i className="bi bi-box-arrow-in-right me-2" aria-hidden="true"></i>Connexion</Link></li>
                      <li><Link className="dropdown-item" onClick={closeMenu} to="/user-register"><i className="bi bi-person-plus me-2" aria-hidden="true"></i>Inscription</Link></li>
                    </>
                    }
                    {studentLoginStatus === 'true' &&
                    <>
                      <li><Link className="dropdown-item" onClick={closeMenu} to="/user-dashboard"><i className="bi bi-speedometer2 me-2" aria-hidden="true"></i>Tableau de bord</Link></li>
                      <li><Link className="dropdown-item" onClick={closeMenu} to="/user-logout"><i className="bi bi-box-arrow-right me-2" aria-hidden="true"></i>Déconnexion</Link></li>
                    </>
                    }
                    </div>
                </div>
                <a className="nav-link nav-item" href="/admin/" target="_blank" rel="noreferrer" onClick={closeMenu}><i className="bi bi-lock-fill" aria-hidden="true"></i>Administration</a>
            </div>
        </div>
    </nav> 
    </>
  )
}

export default Header