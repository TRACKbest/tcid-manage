import React, { useEffect, useState } from 'react'
import axios from 'axios'
import DOMPurify from 'dompurify'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import TeacherSidebar from './TeacherSidebar'
import './AddCourseWizard.css'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const editorModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ align: [] }],
    ['blockquote', 'link'],
    ['clean'],
  ],
}

const editorFormats = ['header', 'bold', 'italic', 'underline', 'strike', 'list', 'bullet', 'align', 'blockquote', 'link']

const fileKey = (file) => `${file.name}:${file.size}:${file.lastModified}`

const AddCourseWizard = () => {
  const [categories, setCategories] = useState([])
  const [courseData, setCourseData] = useState({ category: '', title: '', f_img: null, techs: '', description: '', price: '0' })
  const [imagePreview, setImagePreview] = useState('')
  const [pdfFiles, setPdfFiles] = useState([])
  const [uploadedPdfKeys, setUploadedPdfKeys] = useState([])
  const [createdCourseId, setCreatedCourseId] = useState(null)
  const [step, setStep] = useState(1)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    document.title = 'TCiD Center | Créer une formation'
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    if (!courseData.f_img) {
      setImagePreview('')
      return undefined
    }
    const imageUrl = URL.createObjectURL(courseData.f_img)
    setImagePreview(imageUrl)
    return () => URL.revokeObjectURL(imageUrl)
  }, [courseData.f_img])

  useEffect(() => {
    let cancelled = false
    axios.get(`${baseUrl}/category/`)
      .then((response) => {
        if (!cancelled) {
          setCategories(response.data)
          if (response.data.length) {
            setCourseData((current) => ({ ...current, category: String(response.data[0].id) }))
          }
        }
      })
      .catch((error) => {
        console.error('Could not load course categories:', error.response?.data || error)
        if (!cancelled) setErrorMsg('Impossible de charger les catégories. Vérifiez que Django est démarré.')
      })
    return () => { cancelled = true }
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setCourseData((current) => ({ ...current, [name]: value }))
  }

  const handleImageChange = (event) => {
    setCourseData((current) => ({ ...current, f_img: event.target.files?.[0] || null }))
  }

  const handlePdfChange = (event) => {
    const selected = Array.from(event.target.files || [])
    const invalidFiles = selected.filter((file) => file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))
    if (invalidFiles.length) {
      setErrorMsg('Seuls les fichiers PDF sont acceptés à cette étape.')
      event.target.value = ''
      return
    }
    setErrorMsg('')
    setPdfFiles((current) => {
      const knownKeys = new Set(current.map(fileKey))
      return [...current, ...selected.filter((file) => !knownKeys.has(fileKey(file)))]
    })
    event.target.value = ''
  }

  const submitCourse = async (skipDescription = false) => {
    const teacherId = localStorage.getItem('teacherId')
    if (!teacherId) {
      setErrorMsg('Connectez-vous avec un compte formateur avant de créer une formation.')
      return
    }
    if (!courseData.category || !courseData.title.trim() || !courseData.f_img) {
      setStep(1)
      setErrorMsg('Le titre, la catégorie et l’image de la formation sont obligatoires.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg('')
    setSuccessMsg('')
    let courseWasCreated = Boolean(createdCourseId)
    try {
      let courseId = createdCourseId
      if (!courseId) {
        const formData = new FormData()
        formData.append('category', courseData.category)
        formData.append('teacher', teacherId)
        formData.append('title', courseData.title.trim())
        formData.append('description', skipDescription ? '' : courseData.description)
        formData.append('featured_img', courseData.f_img, courseData.f_img.name)
        formData.append('techs', courseData.techs)
        formData.append('price', String(Number(courseData.price) || 0))
        const response = await axios.post(`${baseUrl}/course/`, formData, {
          headers: { 'content-type': 'multipart/form-data' },
        })
        courseId = response.data.id
        courseWasCreated = Boolean(courseId)
        setCreatedCourseId(courseId)
      }

      const pendingFiles = pdfFiles.filter((file) => !uploadedPdfKeys.includes(fileKey(file)))
      for (const file of pendingFiles) {
        const documentData = new FormData()
        const documentTitle = file.name.replace(/\.pdf$/i, '')
        documentData.append('course', courseId)
        documentData.append('title', documentTitle || file.name)
        documentData.append('description', documentTitle || file.name)
        documentData.append('upload', file, file.name)
        await axios.post(`${baseUrl}/study-material/${courseId}/${teacherId}`, documentData, {
          headers: { 'content-type': 'multipart/form-data' },
        })
        setUploadedPdfKeys((current) => [...current, fileKey(file)])
      }

      setSuccessMsg(`Formation créée${pendingFiles.length ? ` avec ${pendingFiles.length} document${pendingFiles.length === 1 ? '' : 's'} PDF` : ''}. Ajoutez maintenant vos vidéos depuis « Mes formations » → Vidéos.`)
      setCourseData({ category: courseData.category, title: '', f_img: null, techs: '', description: '', price: '0' })
      setPdfFiles([])
      setUploadedPdfKeys([])
      setCreatedCourseId(null)
      setStep(1)
      window.scrollTo(0, 0)
    } catch (error) {
      console.error('Could not create course:', error.response?.data || error)
      if (courseWasCreated) {
        setErrorMsg(`La formation n°${createdCourseId || 'nouvelle'} est créée, mais un document n’a pas pu être envoyé. Revenez à l’étape 2 pour réessayer.`)
        setStep(2)
      } else {
        setErrorMsg(error.response?.data
          ? JSON.stringify(error.response.data)
          : 'Impossible de créer la formation. Vérifiez la connexion au serveur Django.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const safePreview = DOMPurify.sanitize(courseData.description || '')

  return (
    <div className="container mt-4">
      <div className="row">
        <aside className="col-md-3"><TeacherSidebar /></aside>
        <section className="col-md-9">
          <div className="card course-wizard-card">
            <header className="card-header course-wizard-header">
              <div><p className="course-wizard-kicker">ESPACE FORMATEUR</p><h1>Créer une formation</h1></div>
              <span className="course-wizard-count">Étape {step} sur 3</span>
            </header>
            <div className="card-body course-wizard-body">
              <ol className="course-wizard-steps" aria-label="Étapes de création de la formation">
                {['Informations', 'Documents PDF', 'Présentation'].map((label, index) => {
                  const stepNumber = index + 1
                  return <li className={stepNumber === step ? 'is-current' : stepNumber < step ? 'is-complete' : ''} key={label}>
                    <span>{stepNumber < step ? '✓' : stepNumber}</span>{label}
                  </li>
                })}
              </ol>

              {errorMsg && <div className="alert alert-danger" role="alert">{errorMsg}</div>}
              {successMsg && <div className="alert alert-success" role="status">{successMsg}</div>}

              {step === 1 && <section className="course-wizard-step">
                <div className="course-wizard-step-heading"><div><p className="course-wizard-kicker">OBLIGATOIRE</p><h2>Informations sur la formation</h2></div></div>
                <div className="mb-3">
                  <label htmlFor="course-category" className="form-label">Catégorie</label>
                  <select id="course-category" name="category" value={courseData.category} onChange={handleChange} className="form-select" disabled={!categories.length}>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}
                  </select>
                  {!categories.length && <p className="form-text">Aucune catégorie disponible.</p>}
                </div>
                <div className="mb-3">
                  <label htmlFor="course-title" className="form-label">Titre de la formation</label>
                  <input id="course-title" name="title" value={courseData.title} onChange={handleChange} className="form-control" required maxLength={150} />
                </div>
                <div className="mb-3">
                  <label htmlFor="course-image" className="form-label">Image de la formation</label>
                  <input id="course-image" type="file" accept="image/*" onChange={handleImageChange} className="form-control" required={!courseData.f_img} />
                  {courseData.f_img && <span className="course-wizard-file">{courseData.f_img.name}</span>}
                </div>
                <div className="mb-3">
                  <label htmlFor="course-techs" className="form-label">Technologies (facultatif)</label>
                  <input id="course-techs" name="techs" value={courseData.techs} onChange={handleChange} className="form-control" placeholder="Python, React, Django…" />
                </div>
                <div className="mb-3">
                  <label htmlFor="course-price" className="form-label">Prix de la formation (Ar)</label>
                  <input id="course-price" name="price" type="number" min="0" step="500" value={courseData.price} onChange={handleChange} className="form-control" />
                  <p className="form-text">0 = gratuite. Si la formation est payante, la 1re vidéo reste gratuite et l’administrateur valide les paiements mobile money.</p>
                </div>
                <div className="course-wizard-actions"><span className="course-wizard-hint">Les étapes suivantes sont facultatives.</span><button type="button" className="btn btn-primary" disabled={!courseData.title.trim() || !courseData.category || !courseData.f_img} onClick={() => { setErrorMsg(''); setStep(2) }}>Continuer</button></div>
              </section>}

              {step === 2 && <section className="course-wizard-step">
                <div className="course-wizard-step-heading"><div><p className="course-wizard-kicker">FACULTATIF</p><h2>Documents PDF</h2><p>Ajoutez un ou plusieurs documents à télécharger avec la formation.</p></div></div>
                <div className="course-pdf-dropzone">
                  <label htmlFor="course-pdfs" className="form-label">Choisir des fichiers PDF</label>
                  <input id="course-pdfs" type="file" accept="application/pdf,.pdf" multiple onChange={handlePdfChange} className="form-control" />
                </div>
                {pdfFiles.length > 0 && <ul className="course-pdf-list">
                  {pdfFiles.map((file) => <li key={fileKey(file)}><span>{file.name}</span><button type="button" aria-label={`Retirer ${file.name}`} onClick={() => setPdfFiles((current) => current.filter((item) => fileKey(item) !== fileKey(file)))}>Retirer</button></li>)}
                </ul>}
                <div className="course-wizard-actions">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setStep(1)}>Retour</button>
                  <div className="course-wizard-action-group">
                    <button type="button" className="btn btn-link" onClick={() => { setPdfFiles([]); setStep(3) }}>Passer cette étape</button>
                    <button type="button" className="btn btn-primary" onClick={() => setStep(3)}>Continuer</button>
                  </div>
                </div>
              </section>}

              {step === 3 && <section className="course-wizard-step">
                <div className="course-wizard-step-heading"><div><p className="course-wizard-kicker">FACULTATIF</p><h2>Présentation détaillée</h2><p>Rédigez une explication structurée. L’aperçu ci-dessous montre le rendu de la formation.</p></div></div>
                <div className="course-editor-layout">
                  <div className="course-editor-pane">
                    <label className="form-label">Contenu de la formation</label>
                    <ReactQuill theme="snow" value={courseData.description} onChange={(description) => setCourseData((current) => ({ ...current, description }))} modules={editorModules} formats={editorFormats} placeholder="Présentez le cours, ses objectifs et les points abordés…" />
                  </div>
                  <div className="course-preview-pane">
                    <div className="course-preview-label">APERÇU SUR LE SITE</div>
                    {imagePreview && <img src={imagePreview} alt="Aperçu du cours" className="course-preview-image" />}
                    <h3>{courseData.title || 'Titre du cours'}</h3>
                    <div className="course-description-preview" dangerouslySetInnerHTML={{ __html: safePreview || '<p>Votre présentation apparaîtra ici.</p>' }} />
                  </div>
                </div>
                <div className="course-wizard-actions">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setStep(2)}>Retour</button>
                  <div className="course-wizard-action-group">
                    <button type="button" className="btn btn-link" disabled={isSubmitting} onClick={() => submitCourse(true)}>Passer et créer la formation</button>
                    <button type="button" className="btn btn-primary" disabled={isSubmitting} onClick={() => submitCourse(false)}>{isSubmitting ? 'Création…' : 'Créer la formation'}</button>
                  </div>
                </div>
              </section>}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default AddCourseWizard
