import React from 'react'
import { Link } from 'react-router-dom'
import { useEffect } from 'react'

const TeacherSidebar = () => {
  const confirmLogout = (event) => {
    if (!window.confirm('Voulez-vous vraiment vous déconnecter ?')) event.preventDefault()
  }

  useEffect(()=>{
    document.title='TCiD Center | Espace formateur'
  })
  
  return (
      <div className='card'>
                    <div className='list-group list-group-flush'>
                        <Link to='/teacher-dashboard' className='list-group-item list-group-item-action'><i className="bi bi-speedometer2 me-2" aria-hidden="true"></i>Tableau de bord</Link>
                        <Link to='/teacher-my-course' className='list-group-item list-group-item-action'><i className="bi bi-book me-2" aria-hidden="true"></i>Mes formations</Link>
                        <Link to='/add-course' className='list-group-item list-group-item-action'><i className="bi bi-plus-circle me-2" aria-hidden="true"></i>Ajouter une formation</Link>
                        <Link to='/my-users' className='list-group-item list-group-item-action'><i className="bi bi-people me-2" aria-hidden="true"></i>Mes apprenants</Link>
                        <Link to='/groups' className='list-group-item list-group-item-action'><i className="bi bi-chat-square-text me-2" aria-hidden="true"></i>Mes groupes</Link>
                        <Link to='/teacher-profile-setting' className='list-group-item list-group-item-action'><i className="bi bi-gear me-2" aria-hidden="true"></i>Mon profil</Link>
                        <Link to='/teacher-change-password' className='list-group-item list-group-item-action'><i className="bi bi-key me-2" aria-hidden="true"></i>Modifier le mot de passe</Link>
                        <Link to='/teacher-logout' onClick={confirmLogout} className='list-group-item list-group-item-action text-danger'><i className="bi bi-box-arrow-right me-2" aria-hidden="true"></i>Déconnexion</Link>
                    </div>
         </div>
  )
}

export default TeacherSidebar
