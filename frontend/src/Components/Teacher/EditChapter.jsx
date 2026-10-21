import React, { useEffect, useState } from 'react'
import axios from 'axios'
import Swal from 'sweetalert2'
import { Link, useParams } from 'react-router-dom'
import TeacherSidebar from './TeacherSidebar'
import ChapterForm from './ChapterForm'
import ChapterDocumentsManager from './ChapterDocumentsManager'
import './ChapterEditor.css'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const EditChapter = () => {
  const { chapter_id: chapterId } = useParams()
  const teacherId = localStorage.getItem('teacherId')
  const [chapter, setChapter] = useState(null)
  const [values, setValues] = useState({ title: '', description: '', video: null, remarks: '', is_free_preview: false })
  const [isFirstChapter, setIsFirstChapter] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'TCiD Center | Modifier une vidéo'
    axios.get(`${baseUrl}/chapter/${chapterId}`, { params: { teacher_id: teacherId } })
      .then(async (response) => {
        setChapter(response.data)
        setValues({
          title: response.data.title || '',
          description: response.data.description || '',
          video: null,
          remarks: response.data.remarks || '',
          is_free_preview: response.data.is_free_preview,
        })
        const chapters = await axios.get(`${baseUrl}/course-chapters/${response.data.course}`, { params: { teacher_id: teacherId } })
        setIsFirstChapter(chapters.data[0]?.id === response.data.id)
      })
      .catch((requestError) => setError(requestError.response?.data?.detail || 'Cette vidéo est introuvable.'))
  }, [chapterId, teacherId])

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    const formData = new FormData()
    formData.append('title', values.title.trim())
    formData.append('description', values.description)
    formData.append('remarks', values.remarks)
    formData.append('is_free_preview', values.is_free_preview ? 'true' : 'false')
    if (values.video) formData.append('video', values.video, values.video.name)
    try {
      const response = await axios.patch(`${baseUrl}/chapter/${chapterId}`, formData, {
        params: { teacher_id: teacherId },
        onUploadProgress: (progress) => {
          if (progress.total) setUploadProgress(Math.round(progress.loaded * 100 / progress.total))
        },
      })
      setChapter(response.data)
      setValues((current) => ({ ...current, video: null }))
      Swal.fire({ title: 'Vidéo mise à jour', icon: 'success', toast: true, timer: 2500, position: 'top-right', showConfirmButton: false })
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Les modifications n’ont pas pu être enregistrées.')
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
          {!chapter && !error && <p role="status">Chargement…</p>}
          {!chapter && error && <div className="alert alert-danger" role="alert">{error}</div>}
          {chapter && (
            <div className="ce-page">
              <header className="ce-page-header">
                <div>
                  <Link to={`/all-chapters/${chapter.course}`} className="ce-back"><i className="bi bi-arrow-left" aria-hidden="true" /> Programme de la formation</Link>
                  <h1>Modifier « {chapter.title} »</h1>
                  <p>Les changements sont visibles immédiatement par les apprenants.</p>
                </div>
              </header>
              <form onSubmit={submit}>
                <ChapterForm
                  courseId={chapter.course}
                  teacherId={teacherId}
                  values={values}
                  onChange={(changes) => setValues((current) => ({ ...current, ...changes }))}
                  previousVideo={chapter.video}
                  isFirstChapter={isFirstChapter}
                  uploadProgress={uploadProgress}
                />
                {error && <div className="alert alert-danger" role="alert">{error}</div>}
                <div className="ce-actions">
                  <button className="btn btn-primary" type="submit" disabled={saving || !values.title.trim()}>{saving ? 'Enregistrement…' : 'Enregistrer la vidéo'}</button>
                </div>
              </form>
              <ChapterDocumentsManager chapterId={chapter.id} teacherId={teacherId} />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default EditChapter
