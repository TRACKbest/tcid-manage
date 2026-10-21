import React, { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import Swal from 'sweetalert2'
import { Link, useParams } from 'react-router-dom'
import TeacherSidebar from './TeacherSidebar'
import { formatAriary } from '../format'
import './ChapterEditor.css'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const CourseChapters = () => {
  const { course_id: courseId } = useParams()
  const teacherId = localStorage.getItem('teacherId')
  const [course, setCourse] = useState(null)
  const [chapters, setChapters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [courseResponse, chapterResponse] = await Promise.all([
        axios.get(`${baseUrl}/course/${courseId}/`),
        axios.get(`${baseUrl}/course-chapters/${courseId}`, { params: { teacher_id: teacherId } }),
      ])
      setCourse(courseResponse.data)
      setChapters(chapterResponse.data)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Le programme n’a pas pu être chargé.')
    } finally {
      setLoading(false)
    }
  }, [courseId, teacherId])

  useEffect(() => {
    document.title = 'TCiD Center | Programme de la formation'
    load()
  }, [load])

  const move = async (index, direction) => {
    const target = index + direction
    if (target < 0 || target >= chapters.length) return
    const reordered = [...chapters]
    const [item] = reordered.splice(index, 1)
    reordered.splice(target, 0, item)
    setChapters(reordered)
    try {
      await axios.post(`${baseUrl}/course-chapters/${courseId}/reorder/`, {
        chapter_ids: reordered.map((chapter) => chapter.id),
      }, { params: { teacher_id: teacherId } })
      await load()
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'L’ordre n’a pas pu être enregistré.')
      load()
    }
  }

  const remove = async (chapter) => {
    const result = await Swal.fire({
      title: 'Supprimer cette vidéo ?',
      text: `« ${chapter.title} » et ses documents seront supprimés définitivement.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Supprimer',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#c0392b',
    })
    if (!result.isConfirmed) return
    try {
      await axios.delete(`${baseUrl}/chapter/${chapter.id}`, { params: { teacher_id: teacherId } })
      Swal.fire({ title: 'Vidéo supprimée', icon: 'success', toast: true, timer: 2500, position: 'top-right', showConfirmButton: false })
      load()
    } catch (requestError) {
      Swal.fire('Erreur', requestError.response?.data?.detail || 'La vidéo n’a pas pu être supprimée.', 'error')
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
                <Link to="/teacher-my-course" className="ce-back"><i className="bi bi-arrow-left" aria-hidden="true" /> Mes formations</Link>
                <h1>{course?.title || 'Programme'}</h1>
                <p>
                  {chapters.length} vidéo{chapters.length === 1 ? '' : 's'} ·{' '}
                  {course?.is_paid ? <>prix <strong>{formatAriary(course.price)}</strong> (1re vidéo gratuite)</> : 'formation gratuite'} ·{' '}
                  <Link to={`/edit-course/${courseId}`}>modifier le prix</Link>
                </p>
              </div>
              <Link className="btn btn-success" to={`/add-chapter/${courseId}`}><i className="bi bi-plus-lg me-1" aria-hidden="true" />Ajouter une vidéo</Link>
            </header>
            {error && <div className="alert alert-danger" role="alert">{error}</div>}
            {loading && <p role="status">Chargement…</p>}
            {!loading && chapters.length === 0 && (
              <div className="ce-card ce-empty-state">
                <i className="bi bi-camera-reels" aria-hidden="true" />
                <h2>Aucune vidéo pour l’instant</h2>
                <p>Commencez par la vidéo de présentation : elle sera gratuite pour donner envie aux apprenants.</p>
                <Link className="btn btn-primary" to={`/add-chapter/${courseId}`}>Ajouter la première vidéo</Link>
              </div>
            )}
            <ol className="ce-chapter-list">
              {chapters.map((chapter, index) => (
                <li className="ce-card ce-chapter-row" key={chapter.id}>
                  <div className="ce-order">
                    <button type="button" className="ce-icon" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Monter ${chapter.title}`}><i className="bi bi-arrow-up" aria-hidden="true" /></button>
                    <strong>{index + 1}</strong>
                    <button type="button" className="ce-icon" disabled={index === chapters.length - 1} onClick={() => move(index, 1)} aria-label={`Descendre ${chapter.title}`}><i className="bi bi-arrow-down" aria-hidden="true" /></button>
                  </div>
                  {chapter.video
                    ? <video className="ce-thumb" preload="metadata" src={chapter.video} muted><track kind="captions" /></video>
                    : <div className="ce-thumb ce-thumb-empty"><i className="bi bi-camera-video-off" aria-hidden="true" /></div>}
                  <div className="ce-chapter-copy">
                    <h2><Link to={`/edit-chapter/${chapter.id}`}>{chapter.title}</Link></h2>
                    <div className="ce-badges">
                      {chapter.is_free ? <span className="ce-badge is-free">Gratuite</span> : <span className="ce-badge is-paid">Payante</span>}
                      <span className="ce-badge"><i className="bi bi-paperclip" aria-hidden="true" />{chapter.documents.length} document{chapter.documents.length === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                  <div className="ce-row-actions">
                    <Link className="btn btn-outline-primary btn-sm" to={`/edit-chapter/${chapter.id}`}><i className="bi bi-pencil-square me-1" aria-hidden="true" />Modifier</Link>
                    <button className="btn btn-outline-danger btn-sm" type="button" onClick={() => remove(chapter)}><i className="bi bi-trash" aria-hidden="true" /><span className="visually-hidden">Supprimer</span></button>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
    </div>
  )
}

export default CourseChapters
