import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { Link, useParams } from 'react-router-dom'
import TeacherSidebar from './TeacherSidebar'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const TeacherCourseAIAnalytics = () => {
  const { course_id: courseId } = useParams()
  const teacherId = localStorage.getItem('teacherId')
  const [analytics, setAnalytics] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'TCiD Center | Analyse des questions'
    if (!teacherId) {
      setError('Connectez-vous comme formateur pour voir ces statistiques.')
      return
    }
    axios.get(`${baseUrl}/ai/courses/${courseId}/analytics/`, { params: { teacher_id: teacherId } })
      .then((response) => setAnalytics(response.data))
      .catch((requestError) => {
        console.error('Could not load AI learning analytics:', requestError.response?.data || requestError)
        setError(requestError.response?.data?.detail || 'Impossible de charger les statistiques.')
      })
  }, [courseId, teacherId])

  return (
    <main className="container mt-4 mb-5">
      <div className="row">
        <aside className="col-md-3"><TeacherSidebar /></aside>
        <section className="col-md-9">
          <Link className="d-inline-flex align-items-center gap-2 mb-3" to="/teacher-my-course">
            <i className="bi bi-arrow-left" aria-hidden="true" /> Retour aux formations
          </Link>
          <p className="text-success fw-bold small mb-1">STATISTIQUES PÉDAGOGIQUES · ANALYSE SQL</p>
          <h1 className="h3 mb-3">Questions des apprenants</h1>
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          {analytics && (
            <>
              <p className="text-muted">{analytics.course} · {analytics.total_questions} questions analysées</p>
              {analytics.topics.length === 0 ? (
                <div className="border-top border-bottom py-5 text-center text-muted">
                  Les tendances apparaîtront après les premières questions au tuteur.
                </div>
              ) : (
                <div className="ai-analytics-topics">
                  {analytics.topics.map((topic) => (
                    <div className="ai-analytics-topic" key={topic.topic}>
                      <div className="d-flex align-items-center justify-content-between gap-3">
                        <strong>{topic.label}</strong>
                        <span>{topic.questions} · {topic.percentage}%</span>
                      </div>
                      <div className="progress mt-2" role="img" aria-label={`${topic.percentage}% des questions sont classées ${topic.label}`}>
                        <div className="progress-bar bg-success" style={{ width: `${topic.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="small text-muted mt-3 mb-0">Les questions sont regroupées par mots-clés, sans analyse IA ni affichage des messages individuels.</p>
            </>
          )}
        </section>
      </div>
    </main>
  )
}

export default TeacherCourseAIAnalytics