import React, { useEffect, useState } from 'react'
import axios from 'axios'
import Swal from 'sweetalert2'
import { Link, useNavigate, useParams } from 'react-router-dom'
import TeacherSidebar from './TeacherSidebar'
import ChapterForm from './ChapterForm'
import { DocumentDrafts, uploadChapterDocument } from './ChapterDocumentsManager'
import './ChapterEditor.css'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const AddChapter = () => {
  const { course_id: courseId } = useParams()
  const navigate = useNavigate()
  const teacherId = localStorage.getItem('teacherId')
  const [values, setValues] = useState({ title: '', description: '', video: null, remarks: '', is_free_preview: false })
  const [drafts, setDrafts] = useState([])
  const [existingCount, setExistingCount] = useState(0)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'TCiD Center | Ajouter une vidéo'
    axios.get(`${baseUrl}/course-chapters/${courseId}`, { params: { teacher_id: teacherId } })
      .then((response) => setExistingCount(response.data.length))
      .catch((requestError) => console.error('Could not count chapters:', requestError.response?.data || requestError))
  }, [courseId, teacherId])

  const submit = async (event) => {
    event.preventDefault()
    if (!values.video) {
      setError('Choisissez le fichier vidéo.')
      return
    }
    setSaving(true)
    setError('')
    const formData = new FormData()
    formData.append('course', courseId)
    formData.append('title', values.title.trim())
    formData.append('description', values.description)
    formData.append('remarks', values.remarks)
    formData.append('is_free_preview', values.is_free_preview ? 'true' : 'false')
    formData.append('video', values.video, values.video.name)
    try {
      const response = await axios.post(`${baseUrl}/course-chapters/${courseId}`, formData, {
        params: { teacher_id: teacherId },
        onUploadProgress: (progress) => {
          if (progress.total) setUploadProgress(Math.round(progress.loaded * 100 / progress.total))
        },
      })
      const ready = drafts.filter((draft) => draft.file)
      for (const draft of ready) await uploadChapterDocument(response.data.id, teacherId, draft)
      await Swal.fire({
        title: 'Vidéo publiée !',
        text: ready.length ? `${ready.length} document(s) ajouté(s).` : 'Vous pourrez ajouter des documents plus tard.',
        icon: 'success',
        confirmButtonText: 'Voir le programme',
      })
      navigate(`/all-chapters/${courseId}`)
    } catch (requestError) {
      const data = requestError.response?.data
      setError(data?.detail || data?.video?.[0] || data?.upload?.[0] || 'La vidéo n’a pas pu être enregistrée.')
    } finally {
      setSaving(false)
      setUploadProgress(0)
    }
  }

  return (
    <div className="container mt-4">
      <div className="row">
        <aside className="col-md-3"><TeacherSidebar /></aside>
        <section className="col-md-9">
          <form className="ce-page" onSubmit={submit}>
            <header className="ce-page-header">
              <div>
                <Link to={`/all-chapters/${courseId}`} className="ce-back"><i className="bi bi-arrow-left" aria-hidden="true" /> Programme de la formation</Link>
                <h1>Ajouter une vidéo</h1>
                <p>Vidéo n°{existingCount + 1} de la formation{existingCount === 0 ? ' — elle sera gratuite pour attirer les apprenants.' : '.'}</p>
              </div>
            </header>
            <ChapterForm
              courseId={courseId}
              teacherId={teacherId}
              values={values}
              onChange={(changes) => setValues((current) => ({ ...current, ...changes }))}
              isFirstChapter={existingCount === 0}
              uploadProgress={uploadProgress}
            />
            <section className="ce-card" aria-labelledby="new-chapter-docs">
              <div className="ce-card-heading">
                <div>
                  <p className="ce-kicker">ÉTAPE 3 · FACULTATIF</p>
                  <h2 id="new-chapter-docs">Documents qui accompagnent la vidéo</h2>
                  <p>Ajoutez 0, 1 ou plusieurs documents (support PDF, exercices, code…).</p>
                </div>
              </div>
              <DocumentDrafts drafts={drafts} onChange={setDrafts} />
            </section>
            {error && <div className="alert alert-danger" role="alert">{error}</div>}
            <div className="ce-actions ce-sticky-actions">
              <Link className="btn btn-outline-secondary" to={`/all-chapters/${courseId}`}>Annuler</Link>
              <button className="btn btn-primary" type="submit" disabled={saving || !values.title.trim()}>{saving ? 'Publication…' : 'Publier la vidéo'}</button>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}

export default AddChapter
