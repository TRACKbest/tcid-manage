import React, { useEffect, useState } from 'react'
import axios from 'axios'
import Swal from 'sweetalert2'
import { Link, useParams } from 'react-router-dom'
import TeacherSidebar from './TeacherSidebar'
import RichTextEditor from '../RichTextEditor'
import { formatAriary } from '../format'
import './ChapterEditor.css'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const EditCourse = () => {
  const { course_id: courseId } = useParams()
  const teacherId = localStorage.getItem('teacherId')
  const [categories, setCategories] = useState([])
  const [values, setValues] = useState(null)
  const [image, setImage] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'TCiD Center | Modifier une formation'
    Promise.all([
      axios.get(`${baseUrl}/category/`),
      axios.get(`${baseUrl}/teacher-course-detail/${courseId}`),
    ])
      .then(([categoryResponse, courseResponse]) => {
        setCategories(categoryResponse.data)
        const course = courseResponse.data
        setValues({
          category: String(course.category?.id ?? course.category ?? ''),
          title: course.title || '',
          description: course.description || '',
          techs: course.techs || '',
          price: String(course.price ?? 0),
          prevImage: course.featured_img,
        })
      })
      .catch((requestError) => setError(requestError.response?.data?.detail || 'La formation n’a pas pu être chargée.'))
  }, [courseId])

  const update = (changes) => setValues((current) => ({ ...current, ...changes }))

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    const formData = new FormData()
    formData.append('category', values.category)
    formData.append('teacher', teacherId)
    formData.append('title', values.title.trim())
    formData.append('description', values.description)
    formData.append('techs', values.techs)
    formData.append('price', String(Number(values.price) || 0))
    if (image) formData.append('featured_img', image, image.name)
    try {
      await axios.patch(`${baseUrl}/teacher-course-detail/${courseId}`, formData)
      Swal.fire({ title: 'Formation enregistrée', icon: 'success', toast: true, timer: 2500, position: 'top-right', showConfirmButton: false })
    } catch (requestError) {
      const data = requestError.response?.data
      setError(data?.price?.[0] || data?.detail || 'Les modifications n’ont pas pu être enregistrées.')
    } finally {
      setSaving(false)
    }
  }

  const price = Number(values?.price) || 0

  return (
    <div className="container mt-4">
      <div className="row">
        <aside className="col-md-3"><TeacherSidebar /></aside>
        <section className="col-md-9">
          {!values && !error && <p role="status">Chargement…</p>}
          {error && !values && <div className="alert alert-danger" role="alert">{error}</div>}
          {values && (
            <form className="ce-page" onSubmit={submit}>
              <header className="ce-page-header">
                <div>
                  <Link to="/teacher-my-course" className="ce-back"><i className="bi bi-arrow-left" aria-hidden="true" /> Mes formations</Link>
                  <h1>Modifier la formation</h1>
                  <p>Titre, prix, image et présentation visibles sur la page publique.</p>
                </div>
                <Link className="btn btn-outline-primary" to={`/all-chapters/${courseId}`}><i className="bi bi-collection-play me-1" aria-hidden="true" />Gérer les vidéos</Link>
              </header>

              <section className="ce-card">
                <div className="ce-card-heading"><div><p className="ce-kicker">INFORMATIONS</p><h2>Informations principales</h2></div></div>
                <label className="ce-field"><span>Catégorie</span>
                  <select className="form-select" value={values.category} onChange={(event) => update({ category: event.target.value })}>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}
                  </select>
                </label>
                <label className="ce-field"><span>Titre <b>*</b></span><input required maxLength="150" value={values.title} onChange={(event) => update({ title: event.target.value })} /></label>
                <label className="ce-field"><span>Mots-clés <small>séparés par des virgules</small></span><input value={values.techs} onChange={(event) => update({ techs: event.target.value })} placeholder="Python, Django, Web…" /></label>
                <label className="ce-field"><span>Image de couverture <small>(laisser vide pour garder l’image actuelle)</small></span><input type="file" accept="image/*" onChange={(event) => setImage(event.target.files?.[0] || null)} /></label>
                {values.prevImage && !image && <img className="ce-video-preview" src={values.prevImage} alt="Couverture actuelle" style={{ objectFit: 'cover' }} />}
              </section>

              <section className="ce-card">
                <div className="ce-card-heading"><div><p className="ce-kicker">PRIX</p><h2>Prix de la formation</h2><p>Vous fixez librement votre prix. Mettez 0 pour une formation gratuite.</p></div></div>
                <label className="ce-field"><span>Prix en ariary</span>
                  <div className="ce-price-field"><input type="number" min="0" step="500" value={values.price} onChange={(event) => update({ price: event.target.value })} /><strong>Ar</strong></div>
                </label>
                <p className="mb-0 text-muted">{price > 0
                  ? `Les apprenants regardent la 1re vidéo gratuitement puis paient ${formatAriary(price)} (Orange Money, Airtel Money ou MVola). L’administrateur valide chaque paiement.`
                  : 'Formation gratuite : vous approuvez vous-même les demandes d’accès.'}</p>
              </section>

              <section className="ce-card">
                <div className="ce-card-heading"><div><p className="ce-kicker">PRÉSENTATION</p><h2>Description détaillée</h2><p>Objectifs, public visé, ce que l’apprenant saura faire à la fin.</p></div></div>
                <RichTextEditor value={values.description} onChange={(description) => update({ description })} placeholder="Présentez votre formation…" />
              </section>

              {error && <div className="alert alert-danger" role="alert">{error}</div>}
              <div className="ce-actions ce-sticky-actions">
                <button className="btn btn-primary" type="submit" disabled={saving || !values.title.trim()}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  )
}

export default EditCourse
