import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import Swal from 'sweetalert2'
import TeacherSidebar from './TeacherSidebar'
import { formatAriary } from '../format'
import './ChapterEditor.css'
import './course.css'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const TeacherMyCourses = () => {
  const [courses, setCourses] = useState([])
  const teacherId = localStorage.getItem('teacherId')
  const [errorMsg, setErrorMsg] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    document.title = 'TCiD Center | Mes formations'
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    if (!teacherId) {
      setErrorMsg('Connectez-vous comme formateur pour afficher vos formations.')
      setIsLoading(false)
      return
    }
    axios.get(`${baseUrl}/teacher-course/${teacherId}`)
      .then((response) => setCourses(response.data))
      .catch((error) => {
        console.error('Could not load teacher courses:', error.response?.data || error)
        setErrorMsg('Impossible de charger vos formations. Réessayez dans un instant.')
      })
      .finally(() => setIsLoading(false))
  }, [teacherId])

  const handleDelete = async (course) => {
    const result = await Swal.fire({
      title: 'Supprimer la formation ?',
      text: `« ${course.title} », ses vidéos et ses documents seront supprimés définitivement.`,
      icon: 'warning',
      confirmButtonText: 'Supprimer',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#c0392b',
      showCancelButton: true,
    })
    if (!result.isConfirmed) return
    try {
      await axios.delete(`${baseUrl}/teacher-course-detail/${course.id}`)
      setCourses((current) => current.filter((item) => item.id !== course.id))
      Swal.fire('Formation supprimée', 'La formation a été supprimée.', 'success')
    } catch (error) {
      console.error('Could not delete course:', error.response?.data || error)
      Swal.fire('Échec de la suppression', 'La formation n’a pas pu être supprimée.', 'error')
    }
  }

  return (
    <div className="container mt-4">
      <div className="row">
        <aside className="col-md-3"><TeacherSidebar /></aside>
        <section className="col-md-9">
          <div className="ce-page">
            <header className="ce-page-header">
              <div>
                <p className="ce-kicker">ESPACE FORMATEUR</p>
                <h1>Mes formations</h1>
                <p>Gérez vos vidéos, vos prix, vos classes en direct et vos ressources.</p>
              </div>
              <Link className="btn btn-success" to="/add-course"><i className="bi bi-plus-lg me-1" aria-hidden="true" />Nouvelle formation</Link>
            </header>
            {errorMsg && <div className="alert alert-danger" role="alert">{errorMsg}</div>}
            {isLoading && <p role="status">Chargement des formations…</p>}
            {!isLoading && !errorMsg && courses.length === 0 && (
              <div className="ce-card ce-empty-state">
                <i className="bi bi-journal-plus" aria-hidden="true" />
                <h2>Créez votre première formation</h2>
                <p>Ajoutez un titre, une image et un prix, puis publiez vos vidéos.</p>
                <Link className="btn btn-primary" to="/add-course">Créer une formation</Link>
              </div>
            )}
            <ul className="ce-chapter-list">
              {courses.map((course) => (
                <li className="ce-card ce-chapter-row" key={course.id}>
                  {course.featured_img
                    ? <img className="ce-thumb" src={course.featured_img} alt="" />
                    : <div className="ce-thumb ce-thumb-empty"><i className="bi bi-image" aria-hidden="true" /></div>}
                  <div className="ce-chapter-copy">
                    <h2><Link to={`/all-chapters/${course.id}`}>{course.title}</Link></h2>
                    <div className="ce-badges">
                      {course.is_paid ? <span className="ce-badge is-paid">{formatAriary(course.price)}</span> : <span className="ce-badge is-free">Gratuite</span>}
                      <span className="ce-badge"><i className="bi bi-collection-play" aria-hidden="true" />{course.total_chapters} vidéo{course.total_chapters === 1 ? '' : 's'}</span>
                      <Link className="ce-badge" to={`/enrolled-students/${course.id}`}><i className="bi bi-people-fill" aria-hidden="true" />{course.total_enrolled_students} inscrit{course.total_enrolled_students === 1 ? '' : 's'}</Link>
                      <span className="ce-badge"><i className="bi bi-star-fill text-warning" aria-hidden="true" />{course.course_rating ? Number(course.course_rating).toFixed(1) : '—'} / 5</span>
                    </div>
                  </div>
                  <div className="ce-row-actions flex-wrap justify-content-end">
                    <Link to={`/all-chapters/${course.id}`} className="btn btn-primary btn-sm"><i className="bi bi-collection-play me-1" aria-hidden="true" />Vidéos</Link>
                    <Link to={`/edit-course/${course.id}`} className="btn btn-outline-secondary btn-sm" title="Modifier la formation et son prix"><i className="bi bi-pencil-square" aria-hidden="true" /><span className="visually-hidden">Modifier</span></Link>
                    <Link to={`/live-classroom/${course.id}`} className="btn btn-outline-danger btn-sm"><i className="bi bi-camera-video me-1" aria-hidden="true" />Direct</Link>
                    <Link to={`/study-material/${course.id}`} className="btn btn-outline-primary btn-sm"><i className="bi bi-folder2 me-1" aria-hidden="true" />Ressources</Link>
                    <Link to={`/teacher-course-ai-analytics/${course.id}`} className="btn btn-outline-dark btn-sm"><i className="bi bi-bar-chart-line me-1" aria-hidden="true" />Stats IA</Link>
                    <button type="button" onClick={() => handleDelete(course)} className="btn btn-outline-danger btn-sm" title="Supprimer"><i className="bi bi-trash" aria-hidden="true" /><span className="visually-hidden">Supprimer</span></button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  )
}

export default TeacherMyCourses
