import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import DOMPurify from 'dompurify'
import axios from 'axios'
import PaymentModal from './PaymentModal'
import { formatAriary, readStorage, writeStorage } from './format'
import './CourseExperience.css'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const fileIcon = (url = '') => {
  const extension = url.split('?')[0].split('.').pop().toLowerCase()
  if (extension === 'pdf') return 'bi-file-earmark-pdf'
  if (['doc', 'docx', 'odt', 'rtf'].includes(extension)) return 'bi-file-earmark-word'
  if (['xls', 'xlsx', 'csv', 'ods'].includes(extension)) return 'bi-file-earmark-excel'
  if (['ppt', 'pptx', 'odp'].includes(extension)) return 'bi-file-earmark-slides'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension)) return 'bi-file-earmark-image'
  if (['zip', 'rar', '7z'].includes(extension)) return 'bi-file-earmark-zip'
  return 'bi-file-earmark-text'
}

const MiniVideoPlayer = () => {
  const { course_id: courseId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const studentId = localStorage.getItem('studentId')
  const teacherId = localStorage.getItem('teacherId')
  const isStudent = localStorage.getItem('studentLoginStatus') === 'true' && Boolean(studentId)
  const isTeacher = localStorage.getItem('teacherLoginStatus') === 'true' && Boolean(teacherId)
  const progressKey = `tcid-progress-${courseId}-${isStudent ? studentId : 'guest'}`

  const [course, setCourse] = useState(null)
  const [chapters, setChapters] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [completed, setCompleted] = useState(() => readStorage(progressKey, []))
  const [pendingPayment, setPendingPayment] = useState(null)
  const [paymentOpen, setPaymentOpen] = useState(false)

  const loadChapters = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    const params = {}
    if (isStudent) params.student_id = studentId
    if (isTeacher) params.teacher_id = teacherId
    try {
      const [courseResponse, chapterResponse] = await Promise.all([
        axios.get(`${baseUrl}/course/${courseId}/`),
        axios.get(`${baseUrl}/course-chapters/${courseId}`, { params }),
      ])
      setCourse(courseResponse.data)
      setChapters(chapterResponse.data)
      if (isStudent && courseResponse.data.is_paid) {
        const paymentResponse = await axios.get(`${baseUrl}/courses/${courseId}/payments/`, { params: { student_id: studentId } })
        setPendingPayment(paymentResponse.data.payments.find((payment) => payment.status === 'pending') || null)
      }
    } catch (error) {
      console.error('Could not load course videos:', error.response?.data || error)
      setLoadError('Les vidéos de la formation n’ont pas pu être chargées. Réessayez plus tard.')
    } finally {
      setIsLoading(false)
    }
  }, [courseId, isStudent, isTeacher, studentId, teacherId])

  useEffect(() => {
    window.scrollTo(0, 0)
    document.title = 'TCiD Center | Lecture de la formation'
    loadChapters()
  }, [loadChapters])

  useEffect(() => {
    setCompleted(readStorage(progressKey, []))
  }, [progressKey])

  const requestedId = Number(searchParams.get('chapter'))
  const current = useMemo(() => (
    chapters.find((chapter) => chapter.id === requestedId)
      || chapters.find((chapter) => !chapter.is_locked)
      || chapters[0]
  ), [chapters, requestedId])
  const currentIndex = chapters.findIndex((chapter) => chapter.id === current?.id)
  const nextChapter = currentIndex >= 0 ? chapters[currentIndex + 1] : null
  const previousChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null
  const progress = chapters.length ? Math.round(chapters.filter((chapter) => completed.includes(chapter.id)).length * 100 / chapters.length) : 0

  const openChapter = (chapter) => {
    setSearchParams({ chapter: String(chapter.id) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const markCompleted = (chapterId) => {
    setCompleted((items) => {
      if (items.includes(chapterId)) return items
      const next = [...items, chapterId]
      writeStorage(progressKey, next)
      return next
    })
  }

  const unlockButton = () => {
    if (!course?.is_paid) {
      return <Link className="cx-button cx-button-primary" to={`/detail/${courseId}`}><i className="bi bi-door-open" aria-hidden="true" />Demander l’accès</Link>
    }
    if (!isStudent) {
      return <Link className="cx-button cx-button-pay" to={`/user-register?next=/mini/${courseId}`}><i className="bi bi-person" aria-hidden="true" />Connectez-vous pour débloquer</Link>
    }
    if (pendingPayment) {
      return <span className="cx-status cx-status-pending"><i className="bi bi-hourglass-split" aria-hidden="true" /><div><strong>Paiement en vérification</strong><span>Réf. {pendingPayment.reference}</span></div></span>
    }
    return <button className="cx-button cx-button-pay" type="button" onClick={() => setPaymentOpen(true)}><i className="bi bi-unlock-fill" aria-hidden="true" />Débloquer la suite · {formatAriary(course.price)}</button>
  }

  if (isLoading) return <main className="cx-page container"><p className="cx-muted" role="status">Chargement des vidéos…</p></main>
  if (loadError) return <main className="cx-page container"><div className="cx-empty" role="alert"><i className="bi bi-wifi-off" aria-hidden="true" /><h1>Chargement impossible</h1><p>{loadError}</p><button className="cx-button cx-button-primary" type="button" onClick={loadChapters}>Réessayer</button></div></main>
  if (!current) {
    return (
      <main className="cx-page container">
        <div className="cx-empty" role="status">
          <i className="bi bi-camera-video-off" aria-hidden="true" />
          <h1>Aucune vidéo pour le moment</h1>
          <p>Le formateur n’a pas encore publié de chapitre. Revenez bientôt !</p>
          <Link className="cx-button cx-button-ghost" to={`/detail/${courseId}`}>Retour à la formation</Link>
        </div>
      </main>
    )
  }

  const safeDescription = DOMPurify.sanitize(current.description || '')

  return (
    <main className="cx-page cx-player-page container-fluid">
      <header className="cx-player-header">
        <div>
          <Link className="cx-back" to={`/detail/${courseId}`}><i className="bi bi-arrow-left" aria-hidden="true" />{course?.title || 'Formation'}</Link>
          <h1>{current.title || `Vidéo ${currentIndex + 1}`}</h1>
        </div>
        <div className="cx-progress" aria-label={`Progression : ${progress} %`}>
          <span>Progression {progress} %</span>
          <div className="cx-progress-bar"><i style={{ width: `${progress}%` }} /></div>
        </div>
      </header>

      <div className="cx-player-layout">
        <section className="cx-player-main">
          <div className="cx-video-frame">
            {current.is_locked ? (
              <div className="cx-locked-overlay">
                <i className="bi bi-lock-fill" aria-hidden="true" />
                <h2>Cette vidéo est réservée aux inscrits</h2>
                <p>La première vidéo est gratuite. Débloquez la formation pour regarder la suite et télécharger les documents.</p>
                {unlockButton()}
              </div>
            ) : current.video ? (
              <video key={current.id} controls playsInline preload="metadata" src={current.video} onEnded={() => markCompleted(current.id)} controlsList="nodownload">
                Votre navigateur ne prend pas en charge la lecture vidéo.
              </video>
            ) : (
              <div className="cx-locked-overlay"><i className="bi bi-camera-video-off" aria-hidden="true" /><h2>Vidéo bientôt disponible</h2></div>
            )}
          </div>

          <div className="cx-player-nav">
            <button className="cx-button cx-button-ghost" type="button" disabled={!previousChapter} onClick={() => openChapter(previousChapter)}><i className="bi bi-chevron-left" aria-hidden="true" />Précédente</button>
            {!current.is_locked && (
              <button className={`cx-chip-button ${completed.includes(current.id) ? 'is-done' : ''}`} type="button" onClick={() => markCompleted(current.id)}>
                <i className={`bi ${completed.includes(current.id) ? 'bi-check-circle-fill' : 'bi-check-circle'}`} aria-hidden="true" />
                {completed.includes(current.id) ? 'Terminée' : 'Marquer comme terminée'}
              </button>
            )}
            {nextChapter && (nextChapter.is_locked
              ? <button className="cx-button cx-button-pay" type="button" disabled={Boolean(pendingPayment)} onClick={() => (isStudent ? setPaymentOpen(true) : openChapter(nextChapter))}>
                  <i className="bi bi-lock-fill" aria-hidden="true" />{pendingPayment ? 'Paiement en vérification' : 'Vidéo suivante (payante)'}
                </button>
              : <button className="cx-button cx-button-primary" type="button" onClick={() => openChapter(nextChapter)}>Vidéo suivante<i className="bi bi-chevron-right" aria-hidden="true" /></button>)}
          </div>

          {!current.is_locked && (
            <>
              <section className="cx-panel" aria-labelledby="cx-chapter-about">
                <h2 id="cx-chapter-about">Description de la vidéo</h2>
                {safeDescription
                  ? <div className="cx-rich-text" dangerouslySetInnerHTML={{ __html: safeDescription }} />
                  : <p className="cx-muted">Pas de description pour cette vidéo.</p>}
              </section>

              <section className="cx-panel" aria-labelledby="cx-chapter-docs">
                <h2 id="cx-chapter-docs">Documents de la vidéo <small>{current.documents.length}</small></h2>
                {current.documents.length === 0 && <p className="cx-muted">Aucun document n’accompagne cette vidéo.</p>}
                <ul className="cx-documents">
                  {current.documents.map((document) => (
                    <li key={document.id}>
                      <i className={`bi ${fileIcon(document.upload)}`} aria-hidden="true" />
                      <div>
                        <strong>{document.title}</strong>
                        {document.description && <div className="cx-rich-text is-compact" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(document.description) }} />}
                      </div>
                      <a className="cx-button cx-button-ghost" href={document.upload} target="_blank" rel="noreferrer" download><i className="bi bi-download" aria-hidden="true" />Ouvrir</a>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </section>

        <aside className="cx-playlist" aria-label="Liste des vidéos">
          <h2>Programme <small>{chapters.length} vidéos</small></h2>
          <ol>
            {chapters.map((chapter, index) => (
              <li key={chapter.id}>
                <button className={`${chapter.id === current.id ? 'is-current' : ''} ${chapter.is_locked ? 'is-locked' : ''}`} type="button" onClick={() => openChapter(chapter)} aria-current={chapter.id === current.id ? 'true' : undefined}>
                  <span className="cx-playlist-index">
                    {completed.includes(chapter.id) ? <i className="bi bi-check-lg" aria-label="Terminée" /> : index + 1}
                  </span>
                  <span className="cx-playlist-title">{chapter.title || `Vidéo ${index + 1}`}</span>
                  {chapter.is_free && course?.is_paid && <span className="cx-free-tag">Gratuit</span>}
                  {chapter.is_locked && <i className="bi bi-lock-fill" aria-label="Verrouillée" />}
                </button>
              </li>
            ))}
          </ol>
          {chapters.some((chapter) => chapter.is_locked) && <div className="cx-playlist-cta">{unlockButton()}</div>}
        </aside>
      </div>

      {paymentOpen && course && (
        <PaymentModal course={course} studentId={studentId} onClose={() => setPaymentOpen(false)} onSubmitted={(payment) => setPendingPayment(payment)} />
      )}
    </main>
  )
}

export default MiniVideoPlayer
