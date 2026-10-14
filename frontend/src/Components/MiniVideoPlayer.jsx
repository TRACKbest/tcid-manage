import React from 'react'
import { useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import axios from 'axios'
import "./Me.css"

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const MiniVideoPlayer = () => {

    let {course_id}=useParams();

    const [chapterData, setChapterData]=useState([]);
    const [isLoading, setIsLoading]=useState(true);
    const [loadError, setLoadError]=useState('');

    useEffect(() => {
      let active = true
      setIsLoading(true)
      setLoadError('')
      axios.get(`${baseUrl}/course/${course_id}`)
        .then((res) => {
          if (active) setChapterData(res.data.course_chapters || [])
        })
        .catch((error) => {
          console.error('Could not load course videos:', error.response?.data || error)
          if (active) setLoadError('Les vidéos du cours n’ont pas pu être chargées. Réessayez plus tard.')
        })
        .finally(() => {
          if (active) setIsLoading(false)
        })
      axios.get(`${baseUrl}/update-view/${course_id}`)
        .catch((error) => console.error('Could not update course view:', error.response?.data || error))
      return () => { active = false }
    }, [course_id]);

    useEffect(() => {
      window.scrollTo(0, 0)
    }, [])

    useEffect(()=>{
      document.title='TCiD Center | Contenu du cours'
    }, [])


  return (
    <main className="course-video-page">
      <header className="course-video-header">
        <span className="text-uppercase text-success fw-semibold">Votre apprentissage</span>
        <h1>Contenu vidéo du cours</h1>
        <p>Regardez les chapitres disponibles à votre rythme.</p>
      </header>
      {isLoading && <p className="course-video-status" role="status">Chargement des vidéos…</p>}
      {!isLoading && loadError && <p className="course-video-status text-danger" role="alert">{loadError}</p>}
      {!isLoading && !loadError && chapterData.filter((chapter) => chapter.video).length === 0 && (
        <section className="course-video-empty" role="status">
          <i className="bi bi-camera-video-off" aria-hidden="true"></i>
          <h2>Aucune vidéo disponible</h2>
          <p>Ce cours ne contient pas encore de vidéo. Revenez plus tard pour découvrir les nouveaux chapitres.</p>
        </section>
      )}
      {!isLoading && !loadError && chapterData.some((chapter) => chapter.video) && (
        <div className="course-video-grid">
          {chapterData.filter((chapter) => chapter.video).map((chapter, index) => (
            <article className="course-video-card" key={chapter.id}>
              <div className="course-video-frame">
                <video controls playsInline preload="metadata" src={chapter.video}>
                  Votre navigateur ne prend pas en charge la lecture vidéo.
                </video>
              </div>
              <div className="course-video-caption">
                <span className="course-video-number">CHAPITRE {index + 1}</span>
                <h2>{chapter.title || `Vidéo ${index + 1}`}</h2>
                {chapter.description && <p>{chapter.description}</p>}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}

export default MiniVideoPlayer
