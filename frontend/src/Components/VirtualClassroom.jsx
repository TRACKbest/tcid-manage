import React, { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import { Link, useParams } from 'react-router-dom'
import LiveRoom from './LiveRoom'
import './LiveClassroom.css'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const VirtualClassroom = () => {
  const { course_id: courseId } = useParams()
  const teacherId = localStorage.getItem('teacherId')
  const studentId = localStorage.getItem('studentId')
  const isTeacher = localStorage.getItem('teacherLoginStatus') === 'true' && Boolean(teacherId)
  const isStudent = localStorage.getItem('studentLoginStatus') === 'true' && Boolean(studentId)
  const [course, setCourse] = useState(null)
  const [sessions, setSessions] = useState([])
  const [title, setTitle] = useState('Classe en direct')
  const [scheduledAt, setScheduledAt] = useState('')
  const [joinInfo, setJoinInfo] = useState(null)
  const [activeClassroom, setActiveClassroom] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busySessionId, setBusySessionId] = useState(null)
  const [error, setError] = useState('')

  const loadPage = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const courseResponse = await axios.get(`${baseUrl}/course/${courseId}/`)
      setCourse(courseResponse.data)
      const params = isTeacher ? { teacher_id: teacherId } : { student_id: studentId }
      const sessionResponse = await axios.get(
        `${baseUrl}/courses/${courseId}/live-classrooms/`,
        { params },
      )
      setSessions(sessionResponse.data)
    } catch (requestError) {
      console.error('Could not load live classrooms:', requestError.response?.data || requestError)
      setError(requestError.response?.data?.detail || 'Impossible de charger les classes virtuelles.')
    } finally {
      setLoading(false)
    }
  }, [courseId, isTeacher, teacherId, studentId])

  useEffect(() => {
    document.title = 'TCiD Center | Classe virtuelle'
    if (!isTeacher && !isStudent) {
      setError('Connectez-vous avec un compte formateur ou apprenant.')
      setLoading(false)
      return
    }
    loadPage()
  }, [courseId, isTeacher, isStudent, teacherId, studentId, loadPage])

  const createSession = async (event) => {
    event.preventDefault()
    setError('')
    try {
      await axios.post(`${baseUrl}/courses/${courseId}/live-classrooms/`, {
        title: title.trim(),
        scheduled_at: scheduledAt || null,
        teacher_id: teacherId,
      })
      setTitle('Classe en direct')
      setScheduledAt('')
      await loadPage()
    } catch (requestError) {
      console.error('Could not create live classroom:', requestError.response?.data || requestError)
      setError(requestError.response?.data?.detail || 'La classe virtuelle n’a pas pu être créée.')
    }
  }

  const enterSession = async (classroom, startFirst = false) => {
    setBusySessionId(classroom.id)
    setError('')
    try {
      if (startFirst) {
        await axios.post(`${baseUrl}/live-classrooms/${classroom.id}/start/`, {
          teacher_id: teacherId,
        })
      }
      const identity = isTeacher ? { teacher_id: teacherId } : { student_id: studentId }
      const joinResponse = await axios.post(
        `${baseUrl}/live-classrooms/${classroom.id}/join/`,
        identity,
      )
      const updatedClassroom = startFirst
        ? { ...classroom, status: 'live' }
        : classroom
      setActiveClassroom(updatedClassroom)
      setJoinInfo(joinResponse.data)
    } catch (requestError) {
      console.error('Could not join live classroom:', requestError.response?.data || requestError)
      setError(requestError.response?.data?.detail || 'Impossible de rejoindre cette classe.')
      await loadPage()
    } finally {
      setBusySessionId(null)
    }
  }

  const endSession = async () => {
    if (!activeClassroom) return
    try {
      await axios.post(`${baseUrl}/live-classrooms/${activeClassroom.id}/end/`, {
        teacher_id: teacherId,
      })
    } catch (requestError) {
      console.error('Could not end live classroom:', requestError.response?.data || requestError)
    }
    setJoinInfo(null)
    setActiveClassroom(null)
    await loadPage()
  }

  if (activeClassroom && joinInfo) {
    return (
      <LiveRoom
        classroom={activeClassroom}
        joinInfo={joinInfo}
        role={isTeacher ? 'teacher' : 'student'}
        participantId={isTeacher ? teacherId : studentId}
        onLeave={() => {
          setJoinInfo(null)
          setActiveClassroom(null)
          loadPage()
        }}
        onEnd={isTeacher ? endSession : undefined}
      />
    )
  }

  return (
    <main className="live-class-page container py-4">
      <header className="live-class-header">
        <div>
          <Link className="live-class-back" to={isTeacher ? '/teacher-my-course' : '/my-courses'}>
            <i className="bi bi-arrow-left" aria-hidden="true" /> Retour aux formations
          </Link>
          <p className="live-class-eyebrow">SALLE DE CLASSE</p>
          <h1>{course?.title || 'Classe virtuelle'}</h1>
          <p className="live-class-subtitle">
            {isTeacher ? 'Planifiez et animez une session en direct.' : 'Rejoignez les sessions de votre formation.'}
          </p>
        </div>
        <span className="live-class-role">
          <i className={`bi ${isTeacher ? 'bi-easel2' : 'bi-mortarboard'}`} aria-hidden="true" />
          {isTeacher ? 'Formateur' : 'Apprenant'}
        </span>
      </header>

      {error && <div className="live-class-error" role="alert">{error}</div>}

      {isTeacher && (
        <form className="live-class-create" onSubmit={createSession}>
          <div className="live-class-create-heading">
            <i className="bi bi-calendar2-plus" aria-hidden="true" />
            <div>
              <h2>Nouvelle session</h2>
              <p>La salle devient accessible aux apprenants inscrits dès son démarrage.</p>
            </div>
          </div>
          <div className="live-class-create-fields">
            <label>
              <span>Nom de la session</span>
              <input
                maxLength="200"
                onChange={(event) => setTitle(event.target.value)}
                required
                value={title}
              />
            </label>
            <label>
              <span>Date prévue <small>(facultatif)</small></span>
              <input
                onChange={(event) => setScheduledAt(event.target.value)}
                type="datetime-local"
                value={scheduledAt}
              />
            </label>
            <button className="btn btn-dark" type="submit" disabled={!title.trim()}>
              <i className="bi bi-plus-lg me-2" aria-hidden="true" />Créer la session
            </button>
          </div>
        </form>
      )}

      <section className="live-class-sessions" aria-labelledby="live-class-sessions-title">
        <div className="live-class-section-heading">
          <div>
            <p className="live-class-eyebrow">FORMATION · {course?.title || ''}</p>
            <h2 id="live-class-sessions-title">Sessions</h2>
          </div>
          <button className="btn btn-outline-secondary btn-sm" onClick={loadPage} type="button" title="Actualiser">
            <i className="bi bi-arrow-clockwise" aria-hidden="true" />
            <span className="visually-hidden">Actualiser</span>
          </button>
        </div>

        {loading ? <p role="status">Chargement des sessions…</p> : null}
        {!loading && sessions.length === 0 && (
          <div className="live-class-empty">
            <i className="bi bi-camera-video" aria-hidden="true" />
            <p>{isTeacher ? 'Aucune session pour ce cours.' : 'Aucune session n’a encore été planifiée.'}</p>
          </div>
        )}
        <div className="live-class-session-list">
          {sessions.map((session) => (
            <article className="live-class-session-row" key={session.id}>
              <div className="live-class-session-icon" aria-hidden="true">
                <i className={`bi ${session.status === 'live' ? 'bi-broadcast' : 'bi-camera-video'}`} />
              </div>
              <div className="live-class-session-copy">
                <h3>{session.title}</h3>
                <p>
                  {session.scheduled_at
                    ? new Date(session.scheduled_at).toLocaleString('fr-FR')
                    : 'Sans date planifiée'}
                </p>
              </div>
              <span className={`live-class-status live-class-status-${session.status}`}>
                {session.status === 'live' ? 'En direct' : session.status === 'ended' ? 'Terminée' : 'Planifiée'}
              </span>
              {isTeacher && session.status === 'scheduled' && (
                <button
                  className="btn btn-success"
                  disabled={busySessionId === session.id}
                  onClick={() => enterSession(session, true)}
                  type="button"
                >
                  <i className="bi bi-play-fill me-1" aria-hidden="true" />Démarrer
                </button>
              )}
              {session.status === 'live' && (
                <button
                  className="btn btn-dark"
                  disabled={busySessionId === session.id}
                  onClick={() => enterSession(session)}
                  type="button"
                >
                  <i className="bi bi-box-arrow-in-right me-2" aria-hidden="true" />Rejoindre
                </button>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

export default VirtualClassroom