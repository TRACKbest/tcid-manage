import React from 'react'
import { Link } from 'react-router-dom'
import { useEffect } from 'react'

const Sidebar = () => {
  useEffect(()=>{
    document.title='TCiD Center | Espace apprenant'
  })

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
      <div className='card'>
                    <div className='list-group list-group-flush'>
                        <Link to='/user-dashboard' className='list-group-item list-group-item-action'><i className="bi bi-speedometer2 me-2" aria-hidden="true"></i>Tableau de bord</Link>
                        <Link to='/my-courses' className='list-group-item list-group-item-action'><i className="bi bi-book me-2" aria-hidden="true"></i>Mes formations</Link>
                        <Link to='/favorite-courses' className='list-group-item list-group-item-action'><i className="bi bi-heart me-2" aria-hidden="true"></i>Formations favorites</Link>
                        <Link to='/my-teachers' className='list-group-item list-group-item-action'><i className="bi bi-people me-2" aria-hidden="true"></i>Mes formateurs</Link>
                        <Link to='/groups' className='list-group-item list-group-item-action'><i className="bi bi-chat-square-text me-2" aria-hidden="true"></i>Mes groupes</Link>
                        <Link to='/recommended-courses' className='list-group-item list-group-item-action'><i className="bi bi-star me-2" aria-hidden="true"></i>Formations recommandées</Link>
                        <Link to='/my-assignments' className='list-group-item list-group-item-action'><i className="bi bi-clipboard me-2" aria-hidden="true"></i>Mes devoirs</Link>
                        <Link to='/profile-setting' className='list-group-item list-group-item-action'><i className="bi bi-gear me-2" aria-hidden="true"></i>Mon profil</Link>
                        <Link to='/change-password' className='list-group-item list-group-item-action'><i className="bi bi-key me-2" aria-hidden="true"></i>Modifier le mot de passe</Link>
                        <Link to='/user-logout' className='list-group-item list-group-item-action text-danger'><i className="bi bi-box-arrow-right me-2" aria-hidden="true"></i>Déconnexion</Link>
                    </div>
         </div>
  )
}

export default Sidebar
