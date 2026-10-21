import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import Stars from './Stars'
import PriceTag from './PriceTag'
import './Home.css'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const features = [
  { icon: 'bi-mortarboard-fill', title: 'Formateurs qualifiés', text: 'Des experts passionnés qui partagent un savoir concret, à jour et directement applicable.' },
  { icon: 'bi-camera-video-fill', title: 'Classes virtuelles', text: 'Rejoignez des sessions en direct, échangez avec votre formateur et participez aux sondages.' },
  { icon: 'bi-lightning-charge-fill', title: 'Exercices pratiques', text: 'Quiz, devoirs et projets conçus par les formateurs pour ancrer chaque notion essentielle.' },
  { icon: 'bi-journal-richtext', title: 'Ressources pédagogiques', text: 'Vidéos, documents et supports de cours accessibles à tout moment, sur tous vos appareils.' },
]

const benefits = [
  'Formateurs qualifiés',
  'Formations en ligne',
  'Échanges avec les formateurs',
  'Ressources pédagogiques',
  'Exercices réguliers',
  'Apprentissage autonome',
]

const cubeFaces = [
  { side: 'front', icon: 'bi-code-slash' },
  { side: 'back', icon: 'bi-globe2' },
  { side: 'right', icon: 'bi-book-half' },
  { side: 'left', icon: 'bi-cpu' },
  { side: 'top', icon: 'bi-mortarboard' },
  { side: 'bottom', icon: 'bi-lightbulb' },
]

// Follows the pointer to tilt a card in 3D; CSS only applies it on hover-capable devices.
const tilt = (event) => {
  const card = event.currentTarget
  const rect = card.getBoundingClientRect()
  const x = (event.clientX - rect.left) / rect.width - 0.5
  const y = (event.clientY - rect.top) / rect.height - 0.5
  card.style.setProperty('--rx', `${(-y * 10).toFixed(2)}deg`)
  card.style.setProperty('--ry', `${(x * 12).toFixed(2)}deg`)
}

const resetTilt = (event) => {
  event.currentTarget.style.setProperty('--rx', '0deg')
  event.currentTarget.style.setProperty('--ry', '0deg')
}

const CourseCard = ({ course, showRating, delay }) => (
  <div className="col-lg-4 col-md-6" data-reveal style={{ '--delay': `${delay}ms` }}>
    <article className="hm-course hm-tilt" onMouseMove={tilt} onMouseLeave={resetTilt}>
      <Link to={`/detail/${course.id}`} className="hm-course-media">
        <img src={course.featured_img} alt={course.title} loading="lazy" />
        <span className="hm-course-play" aria-hidden="true"><i className="bi bi-play-fill"></i></span>
      </Link>
      <div className="hm-course-body">
        <PriceTag course={course} />
        <h3 className="hm-course-title"><Link to={`/detail/${course.id}`}>{course.title}</Link></h3>
        {showRating && <div className="hm-course-rating"><Stars stars={course.course_rating} /></div>}
      </div>
      <div className="hm-course-meta">
        <span><i className="bi bi-person-video3" aria-hidden="true"></i>{course.teacher?.full_name}</span>
        <span title="Apprenants inscrits"><i className="bi bi-people-fill" aria-hidden="true"></i><span>{course.total_enrolled_students}</span></span>
      </div>
    </article>
  </div>
)

const SectionHead = ({ eyebrow, title, text }) => (
  <div className="hm-head" data-reveal>
    <span className="hm-eyebrow">{eyebrow}</span>
    <h2>{title}</h2>
    {text && <p>{text}</p>}
  </div>
)

const Home = () => {
  const navigate = useNavigate()
  const heroRef = useRef(null)

  const [courseData, setCourseData] = useState([])
  const [popularcourseData, setPopularcourseData] = useState([])
  const [popularteacherData, setPopularteacherData] = useState([])
  const [testData, setTestData] = useState([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    document.title = 'TCiD Center'
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    const load = (path, setter, pick) => axios.get(baseUrl + path)
      .then((res) => setter(pick(res.data) || []))
      .catch((error) => console.log(error))

    load('/course/?result=3', setCourseData, (data) => data.results)
    load('/popular-teachers/?popular=1', setPopularteacherData, (data) => data)
    load('/popular-courses/?popular=1', setPopularcourseData, (data) => data.results)
    load('/student-test/', setTestData, (data) => data.results)
  }, [])

  // Reveal sections as they scroll into view; content loaded later is picked up on each data change.
  useEffect(() => {
    const items = document.querySelectorAll('[data-reveal]:not(.is-visible)')
    if (!('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('is-visible'))
      return undefined
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
    items.forEach((item) => observer.observe(item))
    return () => observer.disconnect()
  }, [courseData, popularcourseData, popularteacherData, testData])

  const handleHeroMove = (event) => {
    const hero = heroRef.current
    if (!hero) return
    const rect = hero.getBoundingClientRect()
    hero.style.setProperty('--mx', ((event.clientX - rect.left) / rect.width - 0.5).toFixed(3))
    hero.style.setProperty('--my', ((event.clientY - rect.top) / rect.height - 0.5).toFixed(3))
  }

  const handleSearchSubmit = (event) => {
    event.preventDefault()
    const query = search.trim()
    if (query) navigate(`/search/${encodeURIComponent(query)}`)
  }

  return (
    <div className="hm">
      {/* Hero */}
      <section className="hm-hero" ref={heroRef} onMouseMove={handleHeroMove}>
        <div className="hm-hero-bg" aria-hidden="true">
          <span className="hm-blob hm-blob-1"></span>
          <span className="hm-blob hm-blob-2"></span>
          <span className="hm-blob hm-blob-3"></span>
          <span className="hm-grid"></span>
        </div>

        <div className="container hm-hero-inner">
          <div className="hm-hero-copy">
            <span className="hm-pill"><span className="hm-pill-dot"></span>Plateforme e-learning · Madagascar</span>
            <h1 className="hm-title">
              Apprenez sans cesse.<br />
              <span className="hm-gradient-text">Progressez chaque jour.</span>
            </h1>
            <p className="hm-lead">Apprenez auprès des meilleurs formateurs, suivez des classes virtuelles en direct et maîtrisez les dernières tendances technologiques.</p>

            <form className="hm-search" onSubmit={handleSearchSubmit} role="search">
              <i className="bi bi-search" aria-hidden="true"></i>
              <input name="search" type="search" onChange={(event) => setSearch(event.target.value)} placeholder="Que voulez-vous apprendre ?" aria-label="Rechercher" value={search} />
              <button type="submit">Rechercher</button>
            </form>

            <div className="hm-hero-actions">
              <Link to="/all-courses" className="hm-btn hm-btn-primary">Explorer les formations<i className="bi bi-arrow-right" aria-hidden="true"></i></Link>
              <Link to="/teacher-register" className="hm-btn hm-btn-ghost"><i className="bi bi-person-badge" aria-hidden="true"></i>Devenir formateur</Link>
            </div>

            <ul className="hm-hero-points">
              <li><i className="bi bi-check2-circle" aria-hidden="true"></i>Cours vidéo</li>
              <li><i className="bi bi-check2-circle" aria-hidden="true"></i>Classes en direct</li>
              <li><i className="bi bi-check2-circle" aria-hidden="true"></i>Quiz & devoirs</li>
            </ul>
          </div>

          <div className="hm-scene" aria-hidden="true">
            <div className="hm-scene-rig">
              <div className="hm-orbit hm-orbit-1"><span></span></div>
              <div className="hm-orbit hm-orbit-2"><span></span></div>
              <div className="hm-cube-wrap">
                <div className="hm-cube">
                  {cubeFaces.map((face) => (
                    <div key={face.side} className={`hm-face hm-face-${face.side}`}><i className={`bi ${face.icon}`}></i></div>
                  ))}
                </div>
              </div>
              <div className="hm-float hm-float-1">
                <span className="hm-float-icon is-violet"><i className="bi bi-play-circle-fill"></i></span>
                <div><strong>Cours vidéo</strong><small>Chapitre 3 · 12 min</small></div>
              </div>
              <div className="hm-float hm-float-2">
                <span className="hm-float-icon is-cyan"><i className="bi bi-broadcast"></i></span>
                <div><strong>En direct</strong><small>Classe virtuelle</small></div>
              </div>
              <div className="hm-float hm-float-3">
                <span className="hm-float-icon is-pink"><i className="bi bi-trophy-fill"></i></span>
                <div><strong>Quiz réussi</strong><small className="hm-progress"><span></span></small></div>
              </div>
            </div>
          </div>
        </div>

        <div className="hm-hero-wave" aria-hidden="true"></div>
      </section>

      {/* Features */}
      <section className="hm-section hm-features">
        <div className="container">
          <div className="row g-4">
            {features.map((feature, index) => (
              <div className="col-lg-3 col-sm-6" key={feature.title} data-reveal style={{ '--delay': `${index * 90}ms` }}>
                <div className="hm-feature hm-tilt" onMouseMove={tilt} onMouseLeave={resetTilt}>
                  <span className="hm-feature-icon"><i className={`bi ${feature.icon}`} aria-hidden="true"></i></span>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section className="hm-section">
        <div className="container">
          <div className="row g-5 align-items-center">
            <div className="col-lg-6" data-reveal>
              <div className="hm-about-visual">
                <div className="hm-about-frame">
                  <img src="/Etudiant.png" alt="Étudiant du TCiD Center" loading="lazy" />
                </div>
                <div className="hm-about-badge">
                  <i className="bi bi-patch-check-fill" aria-hidden="true"></i>
                  <div><strong>Apprentissage</strong><small>actif et guidé</small></div>
                </div>
              </div>
            </div>
            <div className="col-lg-6" data-reveal style={{ '--delay': '120ms' }}>
              <span className="hm-eyebrow">À propos de nous</span>
              <h2 className="hm-about-title">Bienvenue à <span className="hm-gradient-text">TCiD Center</span></h2>
              <p className="hm-text">Les apprenants apprennent mieux lorsqu’ils échangent, réfléchissent à ce qu’ils découvrent, font le lien avec leurs expériences et mettent leurs connaissances en pratique.</p>
              <p className="hm-text">Au TCiD Center, nous créons des formations en ligne stimulantes qui donnent envie d’apprendre, de développer de nouvelles compétences et de progresser.</p>
              <ul className="hm-checklist">
                {benefits.map((benefit) => (
                  <li key={benefit}><i className="bi bi-check-lg" aria-hidden="true"></i>{benefit}</li>
                ))}
              </ul>
              <Link to="/aboutus" className="hm-btn hm-btn-dark">En savoir plus<i className="bi bi-arrow-right" aria-hidden="true"></i></Link>
            </div>
          </div>
        </div>
      </section>

      {/* Latest courses */}
      <section className="hm-section hm-section-tinted">
        <div className="container">
          <SectionHead eyebrow="Formations" title="Dernières formations" text="Les nouveautés publiées par nos formateurs." />
          <div className="row g-4 justify-content-center">
            {courseData.map((course, index) => <CourseCard key={course.id} course={course} delay={index * 90} />)}
          </div>
          <div className="hm-more" data-reveal>
            <Link to="/all-courses" className="hm-btn hm-btn-primary">Voir toutes les formations<i className="bi bi-arrow-right" aria-hidden="true"></i></Link>
          </div>
        </div>
      </section>

      {/* Popular courses */}
      <section className="hm-section">
        <div className="container">
          <SectionHead eyebrow="Tendances" title="Formations populaires" text="Les formations les plus suivies et les mieux notées." />
          <div className="row g-4 justify-content-center">
            {popularcourseData.map((course, index) => <CourseCard key={course.id} course={course} showRating delay={index * 90} />)}
          </div>
          <div className="hm-more" data-reveal>
            <Link to="/popular-courses" className="hm-btn hm-btn-primary">Voir les formations populaires<i className="bi bi-arrow-right" aria-hidden="true"></i></Link>
          </div>
        </div>
      </section>

      {/* Popular teachers */}
      {popularteacherData.length > 0 && (
        <section className="hm-section hm-section-tinted">
          <div className="container">
            <SectionHead eyebrow="Formateurs" title="Formateurs populaires" text="Apprenez avec des formateurs reconnus par les apprenants." />
            <div className="row g-4 justify-content-center">
              {popularteacherData.map((teacher, index) => (
                <div className="col-xl-3 col-lg-4 col-sm-6" key={teacher.id} data-reveal style={{ '--delay': `${index * 90}ms` }}>
                  <article className="hm-teacher hm-tilt" onMouseMove={tilt} onMouseLeave={resetTilt}>
                    <Link to={`/teacher-detail/${teacher.id}`} className="hm-teacher-avatar">
                      {teacher.profile_img
                        ? <img src={teacher.profile_img} alt={teacher.full_name} loading="lazy" />
                        : <span className="hm-avatar-fallback" aria-label={teacher.full_name}>{(teacher.full_name || '?').charAt(0)}</span>}
                    </Link>
                    <h3><Link to={`/teacher-detail/${teacher.id}`}>{teacher.full_name}</Link></h3>
                    <p>{teacher.qualification}</p>
                    <div className="hm-teacher-social">
                      {teacher.insta_url && <a href={teacher.insta_url} target="_blank" rel="noreferrer"><i className="bi bi-instagram" aria-hidden="true"></i><span className="visually-hidden">Instagram</span></a>}
                      {teacher.twit_url && <a href={teacher.twit_url} target="_blank" rel="noreferrer"><i className="bi bi-twitter-x" aria-hidden="true"></i><span className="visually-hidden">Twitter</span></a>}
                      {teacher.face_url && <a href={teacher.face_url} target="_blank" rel="noreferrer"><i className="bi bi-facebook" aria-hidden="true"></i><span className="visually-hidden">Facebook</span></a>}
                    </div>
                  </article>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Testimonials */}
      {testData.length > 0 && (
        <section className="hm-section">
          <div className="container">
            <SectionHead eyebrow="Leurs avis" title="Témoignages d’apprenants" />
            <div className="hm-testimonials" data-reveal>
              {testData.map((row, index) => (
                <figure className="hm-quote" key={row.id || index}>
                  <i className="bi bi-quote hm-quote-mark" aria-hidden="true"></i>
                  <blockquote>{row.reviews}</blockquote>
                  {row.rating !== undefined && <Stars stars={row.rating} />}
                  <figcaption>
                    {row.student?.profile_img
                      ? <img src={row.student.profile_img} alt="" loading="lazy" />
                      : <span className="hm-avatar-fallback" aria-hidden="true">{(row.student?.fullname || '?').charAt(0)}</span>}
                    <div>
                      <strong>{row.student?.fullname}</strong>
                      <small>{row.course?.title}</small>
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Call to action */}
      <section className="hm-section hm-cta-wrap">
        <div className="container">
          <div className="hm-cta" data-reveal>
            <div className="hm-cta-glow" aria-hidden="true"></div>
            <div>
              <h2>Prêt à passer au niveau supérieur ?</h2>
              <p>Créez votre compte gratuitement et commencez à apprendre dès aujourd’hui.</p>
            </div>
            <div className="hm-cta-actions">
              <Link to="/user-register" className="hm-btn hm-btn-light">Commencer maintenant<i className="bi bi-arrow-right" aria-hidden="true"></i></Link>
              <Link to="/category" className="hm-btn hm-btn-outline-light">Voir les catégories</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Home
