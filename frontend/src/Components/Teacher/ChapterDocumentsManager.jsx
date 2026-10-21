import React, { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import Swal from 'sweetalert2'
import RichTextEditor from '../RichTextEditor'
import './ChapterEditor.css'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const emptyDraft = () => ({ key: `${Date.now()}-${Math.random()}`, title: '', description: '', file: null })

export const uploadChapterDocument = (chapterId, teacherId, draft) => {
  const formData = new FormData()
  formData.append('title', draft.title.trim() || draft.file.name)
  formData.append('description', draft.description || '')
  formData.append('upload', draft.file, draft.file.name)
  return axios.post(`${baseUrl}/chapter/${chapterId}/documents/`, formData, { params: { teacher_id: teacherId } })
}

/** Draft list used before the chapter exists (AddChapter) and for new uploads (EditChapter). */
export const DocumentDrafts = ({ drafts, onChange }) => {
  const update = (key, changes) => onChange(drafts.map((draft) => (draft.key === key ? { ...draft, ...changes } : draft)))
  return (
    <div className="ce-doc-drafts">
      {drafts.map((draft, index) => (
        <article className="ce-doc-card" key={draft.key}>
          <header>
            <strong>Document {index + 1}</strong>
            <button className="ce-link-danger" type="button" onClick={() => onChange(drafts.filter((item) => item.key !== draft.key))}>
              <i className="bi bi-x-circle" aria-hidden="true" /> Retirer
            </button>
          </header>
          <label className="ce-field">
            <span>Fichier <b>*</b> <small>PDF, Word, Excel, PowerPoint, image, ZIP…</small></span>
            <input type="file" required onChange={(event) => {
              const file = event.target.files?.[0] || null
              update(draft.key, { file, title: draft.title || (file ? file.name.replace(/\.[^.]+$/, '') : '') })
            }} />
          </label>
          <label className="ce-field">
            <span>Titre du document</span>
            <input maxLength="150" value={draft.title} onChange={(event) => update(draft.key, { title: event.target.value })} placeholder="Ex. Fiche récapitulative" />
          </label>
          <div className="ce-field">
            <span>Description <small>(facultatif)</small></span>
            <RichTextEditor value={draft.description} onChange={(description) => update(draft.key, { description })} placeholder="À quoi sert ce document ?" />
          </div>
        </article>
      ))}
      <button className="ce-add-doc" type="button" onClick={() => onChange([...drafts, emptyDraft()])}>
        <i className="bi bi-paperclip" aria-hidden="true" /> Ajouter un document
      </button>
    </div>
  )
}

const ChapterDocumentsManager = ({ chapterId, teacherId }) => {
  const [documents, setDocuments] = useState([])
  const [drafts, setDrafts] = useState([])
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const response = await axios.get(`${baseUrl}/chapter/${chapterId}/documents/`, { params: { teacher_id: teacherId } })
      setDocuments(response.data)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Les documents n’ont pas pu être chargés.')
    }
  }, [chapterId, teacherId])

  useEffect(() => { load() }, [load])

  const uploadDrafts = async () => {
    const ready = drafts.filter((draft) => draft.file)
    if (!ready.length) return
    setBusy(true)
    setError('')
    try {
      for (const draft of ready) await uploadChapterDocument(chapterId, teacherId, draft)
      setDrafts([])
      await load()
      Swal.fire({ title: `${ready.length} document(s) ajouté(s)`, icon: 'success', toast: true, timer: 2500, position: 'top-right', showConfirmButton: false })
    } catch (requestError) {
      const data = requestError.response?.data
      setError(data?.upload?.[0] || data?.detail || 'Un document n’a pas pu être envoyé.')
    } finally {
      setBusy(false)
    }
  }

  const saveEdit = async () => {
    setBusy(true)
    try {
      await axios.patch(`${baseUrl}/chapter-documents/${editing.id}/`, {
        title: editing.title,
        description: editing.description,
      }, { params: { teacher_id: teacherId } })
      setEditing(null)
      await load()
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Le document n’a pas pu être modifié.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (document) => {
    const result = await Swal.fire({
      title: 'Supprimer ce document ?',
      text: document.title,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Supprimer',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#c0392b',
    })
    if (!result.isConfirmed) return
    try {
      await axios.delete(`${baseUrl}/chapter-documents/${document.id}/`, { params: { teacher_id: teacherId } })
      await load()
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Le document n’a pas pu être supprimé.')
    }
  }

  return (
    <section className="ce-card" aria-labelledby="chapter-docs-title">
      <div className="ce-card-heading">
        <div>
          <p className="ce-kicker">ÉTAPE 3 · FACULTATIF</p>
          <h2 id="chapter-docs-title">Documents qui accompagnent la vidéo</h2>
          <p>Une vidéo peut avoir 0, 1 ou plusieurs documents. Ils sont visibles sous la vidéo.</p>
        </div>
        <span className="ce-count">{documents.length}</span>
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <ul className="ce-doc-list">
        {documents.map((document) => (
          <li key={document.id}>
            {editing?.id === document.id ? (
              <div className="ce-doc-edit">
                <label className="ce-field"><span>Titre</span><input maxLength="150" value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} /></label>
                <div className="ce-field"><span>Description</span><RichTextEditor value={editing.description} onChange={(description) => setEditing({ ...editing, description })} /></div>
                <div className="ce-actions"><button className="btn btn-outline-secondary" type="button" onClick={() => setEditing(null)}>Annuler</button><button className="btn btn-primary" type="button" disabled={busy} onClick={saveEdit}>Enregistrer</button></div>
              </div>
            ) : (
              <>
                <i className="bi bi-file-earmark-text" aria-hidden="true" />
                <a href={document.upload} target="_blank" rel="noreferrer">{document.title}</a>
                <button className="ce-icon" type="button" onClick={() => setEditing({ id: document.id, title: document.title, description: document.description })} aria-label={`Modifier ${document.title}`}><i className="bi bi-pencil" aria-hidden="true" /></button>
                <button className="ce-icon is-danger" type="button" onClick={() => remove(document)} aria-label={`Supprimer ${document.title}`}><i className="bi bi-trash" aria-hidden="true" /></button>
              </>
            )}
          </li>
        ))}
        {documents.length === 0 && <li className="ce-empty">Aucun document pour l’instant.</li>}
      </ul>
      <DocumentDrafts drafts={drafts} onChange={setDrafts} />
      {drafts.some((draft) => draft.file) && (
        <div className="ce-actions"><button className="btn btn-success" type="button" disabled={busy} onClick={uploadDrafts}>{busy ? 'Envoi…' : 'Envoyer les nouveaux documents'}</button></div>
      )}
    </section>
  )
}

export default ChapterDocumentsManager
