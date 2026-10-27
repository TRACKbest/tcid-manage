import React, { useCallback, useEffect, useState } from 'react'
import DOMPurify from 'dompurify'
import { Link, useParams } from 'react-router-dom'
import Swal from 'sweetalert2'
import axios from 'axios'
import PaymentModal from './PaymentModal'
import { formatAriary, formatDateTime } from './format'
import './main.css'
import './style.css'
import './bootstrap.min.css'
import './CourseExperience.css'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'
const siteUrl = process.env.REACT_APP_SITE_URL || 'http://127.0.0.1:8000/'

const toast = (title, icon = 'success') => Swal.fire({
  title,
  icon,
  toast: true,
  timer: 3000,
  position: 'top-right',
  timerProgressBar: true,
  showConfirmButton: false,
})

const CourseDetail = () => {
  const { course_id: courseId } = useParams()
  const studentId = localStorage.getItem('studentId')
  const isStudent = localStorage.getItem('studentLoginStatus') === 'true' && Boolean(studentId)

  const [course, setCourse] = useState(null)
  const [relatedCourses, setRelatedCourses] = useState([])
  const [loadError, setLoadError] = useState('')
  const [enrollmentStatus, setEnrollmentStatus] = useState('')
  const [payments, setPayments] = useState([])
  const [hasRated, setHasRated] = useState(false)
  const [isFavorite, setIsFavorite] = useState(false)
  const [courseViews, setCourseViews] = useState(0)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [ratingModalOpen, setRatingModalOpen] = useState(false)
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const [ratingError, setRatingError] = useState('')
  const [ratingData, setRatingData] = useState({ rating: '', reviews: '' })

  const loadCourse = useCallback(async () => {
    try {
      const response = await axios.get(`${baseUrl}/course/${courseId}/`, {
        params: isStudent ? { student_id: studentId } : {},
      })
      setCourse(response.data)
      setCourseViews(response.data.course_views || 0)
      try {
        setRelatedCourses(JSON.parse(response.data.related_videos || '[]'))
      } catch {
        setRelatedCourses([])
      }
    } catch (error) {
      console.error('Could not load the course:', error.response?.data || error)
      setLoadError('Cette formation est introuvable ou momentanément indisponible.')
    }
  }, [courseId, isStudent, studentId])

  const loadAccess = useCallback(async () => {
    if (!isStudent) return
    try {
      const [enrollResponse, paymentResponse] = await Promise.all([
        axios.get(`${baseUrl}/fetch-enroll-status/${studentId}/${courseId}`),
        axios.get(`${baseUrl}/courses/${courseId}/payments/`, { params: { student_id: studentId } }),
      ])
      setEnrollmentStatus(enrollResponse.data.status || '')
      setPayments(paymentResponse.data.payments || [])
    } catch (error) {
      console.error('Could not load course access:', error.response?.data || error)
    }
  }, [courseId, isStudent, studentId])

  useEffect(() => {
    window.scrollTo(0, 0)
    document.title = 'TCiD Center | Détails de la formation'
  }, [])

  useEffect(() => {
    loadCourse()
    loadAccess()
    if (!isStudent) return
    axios.get(`${baseUrl}/update-view/${courseId}`, { params: { student_id: studentId } })
      .then((response) => setCourseViews(response.data.views))
      .catch((error) => console.error('Could not count the view:', error.response?.data || error))
    axios.get(`${baseUrl}/fetch-rating-status/${studentId}/${courseId}`)
      .then((response) => setHasRated(response.data.bool === true))
      .catch((error) => console.error('Could not load rating status:', error.response?.data || error))
    axios.get(`${baseUrl}/fetch-favorite-status/${studentId}/${courseId}`)
      .then((response) => setIsFavorite(response.data.bool === true))
      .catch((error) => console.error('Could not load favorite status:', error.response?.data || error))
  }, [courseId, isStudent, studentId, loadCourse, loadAccess])

  const hasAccess = enrollmentStatus === 'approved'
  const pendingPayment = payments.find((payment) => payment.status === 'pending')
  const lastRejected = !pendingPayment && payments.find((payment) => payment.status === 'rejected')
  const chapters = course?.course_chapters || []
  const firstFreeChapter = chapters.find((chapter) => chapter.is_free)

  const requestFreeAccess = async () => {
    const formData = new FormData()
    formData.append('course', courseId)
    formData.append('student', studentId)
    try {
      const response = await axios.post(`${baseUrl}/student-enroll-course/`, formData)
      setEnrollmentStatus(response.data.status || 'pending')
      toast('Demande envoyée au formateur')
    } catch (error) {
      Swal.fire('Demande impossible', error.response?.data?.detail || 'Vérifiez votre connexion puis réessayez.', 'error')
    }
  }

  const toggleFavorite = async () => {
    try {
      if (isFavorite) {
        await axios.get(`${baseUrl}/student-remove-favorite-course/${courseId}/${studentId}`)
        setIsFavorite(false)
        toast('Formation retirée de vos favoris')
      } else {
        const formData = new FormData()
        formData.append('course', courseId)
        formData.append('student', studentId)
        formData.append('status', true)
        await axios.post(`${baseUrl}/student-add-favorte-course/`, formData)
        setIsFavorite(true)
        toast('Formation ajoutée à vos favoris')
      }
    } catch (error) {
      console.error('Could not update favorites:', error.response?.data || error)
    }
  }

  const submitRating = async (event) => {
    event.preventDefault()
    if (!studentId || ratingSubmitting) return
    const rating = Number(ratingData.rating)
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      setRatingError('Choisissez une note entre 1 et 5.')
      return
    }
    setRatingSubmitting(true)
    setRatingError('')
    const formData = new FormData()
    formData.append('course', courseId)
    formData.append('student', studentId)
    formData.append('rating', String(rating))
    formData.append('reviews', ratingData.reviews)
    try {
      await axios.post(`${baseUrl}/course-rating/`, formData)
      setHasRated(true)
      setRatingModalOpen(false)
      loadCourse()
      toast('Votre évaluation a été enregistrée.')
    } catch (error) {
      setRatingError(error.response?.data?.detail || 'Votre évaluation n’a pas pu être envoyée. Réessayez.')
    } finally {
      setRatingSubmitting(false)
    }
  }

  if (loadError) {
    return <main className="cx-page container"><div className="cx-empty"><i className="bi bi-exclamation-circle" aria-hidden="true" /><h1>Formation indisponible</h1><p>{loadError}</p><Link className="cx-button cx-button-primary" to="/all-courses">Voir les formations</Link></div></main>
  }
  if (!course) {
    return <main className="cx-page container"><p className="cx-muted" role="status">Chargement de la formation…</p></main>
  }

  const teacher = course.teacher || {}
  const rating = course.course_rating ? Number(course.course_rating).toFixed(1) : null
  const safeDescription = DOMPurify.sanitize(course.description || '')

  const renderAccessActions = () => {
    if (!isStudent) {
      return (
        <>
          {firstFreeChapter && <Link className="cx-button cx-button-primary" to={`/mini/${course.id}?chapter=${firstFreeChapter.id}`}><i className="bi bi-play-circle-fill" aria-hidden="true" />Regarder la 1re vidéo gratuite</Link>}
          <Link className="cx-button cx-button-ghost" to={`/user-register?next=/detail/${course.id}`}><i className="bi bi-person" aria-hidden="true" />Se connecter pour s’inscrire</Link>
        </>
      )
    }
    if (hasAccess) {
      return (
        <>
          <Link className="cx-button cx-button-primary" to={`/mini/${course.id}`}><i className="bi bi-play-circle-fill" aria-hidden="true" />Continuer la formation</Link>
          <div className="cx-action-links">
            <Link to={`/user/study-material/${course.id}`}><i className="bi bi-folder2-open" aria-hidden="true" />Ressources &amp; assistant IA</Link>
            <Link to={`/live-classroom/${course.id}`}><i className="bi bi-camera-video" aria-hidden="true" />Classe virtuelle</Link>
            <Link to={`/course-quiz/${course.id}`}><i className="bi bi-patch-question" aria-hidden="true" />Quiz</Link>
          </div>
        </>
      )
    }
    return (
      <>
        {firstFreeChapter && <Link className="cx-button cx-button-ghost" to={`/mini/${course.id}?chapter=${firstFreeChapter.id}`}><i className="bi bi-play-circle" aria-hidden="true" />Regarder la 1re vidéo gratuite</Link>}
        {course.is_paid ? (
          pendingPayment ? (
            <div className="cx-status cx-status-pending" role="status">
              <i className="bi bi-hourglass-split" aria-hidden="true" />
              <div><strong>Paiement en cours de vérification</strong><span>Réf. {pendingPayment.reference} · {formatAriary(pendingPayment.amount)} · {formatDateTime(pendingPayment.created_at)}</span></div>
            </div>
          ) : (
            <>
              {lastRejected && (
                <div className="cx-status cx-status-rejected" role="alert">
                  <i className="bi bi-x-octagon" aria-hidden="true" />
                  <div><strong>Paiement refusé</strong><span>{lastRejected.admin_note}</span></div>
                </div>
              )}
              <button className="cx-button cx-button-pay" type="button" onClick={() => setPaymentOpen(true)}>
                <i className="bi bi-unlock-fill" aria-hidden="true" />Débloquer toute la formation · {formatAriary(course.price)}
              </button>
            </>
          )
        ) : enrollmentStatus === 'pending' ? (
          <div className="cx-status cx-status-pending" role="status"><i className="bi bi-hourglass-split" aria-hidden="true" /><div><strong>Demande envoyée</strong><span>Le formateur va approuver votre accès.</span></div></div>
        ) : (
          <button className="cx-button cx-button-primary" type="button" onClick={requestFreeAccess}><i className="bi bi-door-open" aria-hidden="true" />Accéder gratuitement</button>
        )}
      </>
    )
  }

  return (
    <main className="cx-page container">
      <nav className="cx-breadcrumb" aria-label="Fil d’Ariane">
        <Link to="/">Accueil</Link><i className="bi bi-chevron-right" aria-hidden="true" /><Link to="/all-courses">Formations</Link><i className="bi bi-chevron-right" aria-hidden="true" /><span>{course.title}</span>
      </nav>

      <section className="cx-hero">
        <div className="cx-hero-media">
          {course.featured_img ? <img src={course.featured_img} alt={course.title} /> : <div className="cx-hero-placeholder"><i className="bi bi-mortarboard" aria-hidden="true" /></div>}
          <span className={`cx-price-badge ${course.is_paid ? '' : 'is-free'}`}>{course.is_paid ? formatAriary(course.price) : 'Gratuit'}</span>
        </div>
        <div className="cx-hero-copy">
          {course.category?.title && <span className="cx-chip">{course.category.title}</span>}
          <h1>{course.title}</h1>
          <p className="cx-teacher-line">
            {teacher.profile_img ? <img src={teacher.profile_img} alt="" /> : <i className="bi bi-person-circle" aria-hidden="true" />}
            Par <Link to={`/teacher-detail/${teacher.id}`}>{teacher.full_name}</Link>
          </p>
          <ul className="cx-stats" aria-label="Statistiques de la formation">
            <li><i className="bi bi-star-fill" aria-hidden="true" />{rating ? `${rating} / 5` : 'Pas encore noté'}</li>
            <li><i className="bi bi-people-fill" aria-hidden="true" />{course.total_enrolled_students} apprenant{course.total_enrolled_students === 1 ? '' : 's'}</li>
            <li><i className="bi bi-collection-play-fill" aria-hidden="true" />{chapters.length} vidéo{chapters.length === 1 ? '' : 's'}</li>
            <li><i className="bi bi-eye-fill" aria-hidden="true" />{courseViews} vue{courseViews === 1 ? '' : 's'}</li>
          </ul>
          {course.teach_list?.length > 0 && <div className="cx-tags">{course.teach_list.map((tech) => <span key={tech}>{tech}</span>)}</div>}
        </div>
        <aside className="cx-action-card" aria-label="Accès à la formation">
          <p className="cx-eyebrow">{course.is_paid ? 'FORMATION PAYANTE' : 'FORMATION GRATUITE'}</p>
          <strong className="cx-action-price">{course.is_paid ? formatAriary(course.price) : 'Gratuit'}</strong>
          <p className="cx-muted">{course.is_paid ? 'La 1re vidéo est offerte. Payez une fois pour débloquer toutes les vidéos et documents.' : 'Demandez l’accès au formateur pour suivre la formation.'}</p>
          <div className="cx-action-stack">{renderAccessActions()}</div>
          {isStudent && (
            <div className="cx-secondary-actions">
              <button className={`cx-chip-button ${isFavorite ? 'is-active' : ''}`} type="button" onClick={toggleFavorite} aria-pressed={isFavorite}>
                <i className={`bi ${isFavorite ? 'bi-heart-fill' : 'bi-heart'}`} aria-hidden="true" />{isFavorite ? 'Dans vos favoris' : 'Ajouter aux favoris'}
              </button>
              {hasAccess && !hasRated && <button className="cx-chip-button" type="button" onClick={() => { setRatingError(''); setRatingModalOpen(true) }}><i className="bi bi-star" aria-hidden="true" />Évaluer</button>}
              {hasAccess && hasRated && <span className="cx-chip-button is-done"><i className="bi bi-check2" aria-hidden="true" />Déjà évaluée</span>}
            </div>
          )}
        </aside>
      </section>

      {course.is_paid && !hasAccess && (
        <section className="cx-how" aria-labelledby="cx-how-title">
          <h2 id="cx-how-title">Comment débloquer la formation ?</h2>
          <ol>
            <li><span>1</span><strong>Essayez gratuitement</strong><p>Regardez la première vidéo pour découvrir le formateur.</p></li>
            <li><span>2</span><strong>Payez par mobile money</strong><p>Orange Money, Airtel Money ou MVola, au numéro affiché.</p></li>
            <li><span>3</span><strong>Envoyez la référence</strong><p>Indiquez la référence du SMS et le montant payé.</p></li>
            <li><span>4</span><strong>Accès débloqué</strong><p>Après validation par l’administrateur, tout est accessible.</p></li>
          </ol>
        </section>
      )}

      <div className="cx-columns">
        <section className="cx-panel" aria-labelledby="cx-about-title">
          <h2 id="cx-about-title">À propos de la formation</h2>
          {safeDescription
            ? <div className="cx-rich-text" dangerouslySetInnerHTML={{ __html: safeDescription }} />
            : <p className="cx-muted">Le formateur n’a pas encore rédigé de présentation.</p>}
        </section>

        <section className="cx-panel" aria-labelledby="cx-program-title">
          <h2 id="cx-program-title">Programme <small>{chapters.length} vidéo{chapters.length === 1 ? '' : 's'}</small></h2>
          {chapters.length === 0 && <p className="cx-muted">Les vidéos arrivent bientôt.</p>}
          <ol className="cx-curriculum">
            {chapters.map((chapter) => (
              <li className={chapter.is_locked ? 'is-locked' : ''} key={chapter.id}>
                <span className="cx-curriculum-index">{chapter.position}</span>
                <div>
                  {chapter.is_locked
                    ? <span className="cx-curriculum-title">{chapter.title}</span>
                    : <Link className="cx-curriculum-title" to={`/mini/${course.id}?chapter=${chapter.id}`}>{chapter.title}</Link>}
                  <small>{chapter.documents_count > 0 ? `${chapter.documents_count} document${chapter.documents_count === 1 ? '' : 's'}` : 'Vidéo'}</small>
                </div>
                {chapter.is_free && !hasAccess && <span className="cx-free-tag">Gratuit</span>}
                <i className={`bi ${chapter.is_locked ? 'bi-lock-fill' : 'bi-play-circle'}`} aria-label={chapter.is_locked ? 'Verrouillé' : 'Disponible'} />
              </li>
            ))}
          </ol>
          {course.is_paid && !hasAccess && isStudent && !pendingPayment && chapters.some((chapter) => chapter.is_locked) && (
            <button className="cx-button cx-button-pay is-block" type="button" onClick={() => setPaymentOpen(true)}><i className="bi bi-unlock-fill" aria-hidden="true" />Débloquer les vidéos suivantes</button>
          )}
        </section>
      </div>

      {relatedCourses.length > 0 && (
        <section className="cx-related" aria-labelledby="cx-related-title">
          <h2 id="cx-related-title">Formations similaires</h2>
          <div className="cx-related-grid">
            {relatedCourses.map((related) => (
              <Link className="cx-related-card" key={related.pk} to={`/detail/${related.pk}`}>
                <img src={`${siteUrl}media/${related.fields.featured_img}`} alt="" />
                <span>{related.fields.title}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {paymentOpen && (
        <PaymentModal
          course={course}
          studentId={studentId}
          onClose={() => setPaymentOpen(false)}
          onSubmitted={() => loadAccess()}
        />
      )}

      {ratingModalOpen && (
        <div className="cx-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !ratingSubmitting) setRatingModalOpen(false)
        }}>
          <form className="cx-modal cx-modal-small" role="dialog" aria-modal="true" aria-labelledby="rating-modal-title" onSubmit={submitRating}>
            <header className="cx-modal-header">
              <div><p className="cx-eyebrow">VOTRE AVIS</p><h2 id="rating-modal-title">Évaluer « {course.title} »</h2></div>
              <button className="cx-icon-button" type="button" onClick={() => setRatingModalOpen(false)} aria-label="Fermer" disabled={ratingSubmitting}><i className="bi bi-x-lg" aria-hidden="true" /></button>
            </header>
            <div className="cx-payment-body">
              <div className="cx-star-picker" role="radiogroup" aria-label="Note">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button aria-checked={Number(ratingData.rating) === value} aria-label={`${value} sur 5`} className={Number(ratingData.rating) >= value ? 'is-on' : ''} key={value} onClick={() => setRatingData((current) => ({ ...current, rating: String(value) }))} role="radio" type="button">
                    <i className="bi bi-star-fill" aria-hidden="true" />
                  </button>
                ))}
              </div>
              <label className="cx-form-grid-single">
                <span>Votre avis (facultatif)</span>
                <textarea rows="4" value={ratingData.reviews} onChange={(event) => setRatingData((current) => ({ ...current, reviews: event.target.value }))} />
              </label>
              {ratingError && <div className="cx-alert" role="alert">{ratingError}</div>}
              <footer className="cx-modal-footer">
                <button className="cx-button cx-button-ghost" type="button" onClick={() => setRatingModalOpen(false)} disabled={ratingSubmitting}>Annuler</button>
                <button className="cx-button cx-button-primary" type="submit" disabled={ratingSubmitting}>{ratingSubmitting ? 'Envoi…' : 'Envoyer'}</button>
              </footer>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}

export default CourseDetail
