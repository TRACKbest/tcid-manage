import React, { useState } from 'react'
import axios from 'axios'
import RichTextEditor from '../RichTextEditor'
import './ChapterEditor.css'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const ChapterForm = ({ courseId, teacherId, values, onChange, previousVideo, isFirstChapter, uploadProgress }) => {
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState('')

  const generateDescription = async () => {
    setAiBusy(true)
    setAiError('')
    try {
      const response = await axios.post(`${baseUrl}/ai/courses/${courseId}/chapter-description/`, {
        teacher_id: teacherId,
        title: values.title,
        notes: values.description,
      })
      onChange({ description: response.data.description })
    } catch (error) {
      setAiError(error.response?.data?.detail || 'L’assistant IA est indisponible pour le moment.')
    } finally {
      setAiBusy(false)
    }
  }

  return (
    <>
      <section className="ce-card" aria-labelledby="chapter-info-title">
        <div className="ce-card-heading">
          <div>
            <p className="ce-kicker">ÉTAPE 1 · OBLIGATOIRE</p>
            <h2 id="chapter-info-title">La vidéo</h2>
            <p>Donnez un titre clair : les apprenants le voient dans le programme.</p>
          </div>
        </div>
        <label className="ce-field">
          <span>Titre de la vidéo <b>*</b></span>
          <input required maxLength="150" value={values.title} onChange={(event) => onChange({ title: event.target.value })} placeholder="Ex. Introduction à Python" />
        </label>
        <label className="ce-field">
          <span>Fichier vidéo {previousVideo ? <small>(laisser vide pour garder la vidéo actuelle)</small> : <b>*</b>}</span>
          <input type="file" accept="video/*" required={!previousVideo} onChange={(event) => onChange({ video: event.target.files?.[0] || null })} />
        </label>
        {previousVideo && !values.video && (
          <video className="ce-video-preview" controls preload="metadata" src={previousVideo}>
            <track kind="captions" />
          </video>
        )}
        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="ce-upload" role="progressbar" aria-valuenow={uploadProgress} aria-valuemin="0" aria-valuemax="100">
            <span>Envoi de la vidéo… {uploadProgress} %</span>
            <div><i style={{ width: `${uploadProgress}%` }} /></div>
          </div>
        )}
        <label className="ce-switch">
          <input type="checkbox" checked={isFirstChapter || values.is_free_preview} disabled={isFirstChapter} onChange={(event) => onChange({ is_free_preview: event.target.checked })} />
          <span>
            <strong>Vidéo gratuite (aperçu)</strong>
            <small>{isFirstChapter ? 'La première vidéo de chaque formation est toujours gratuite.' : 'Visible par tous, même sans paiement.'}</small>
          </span>
        </label>
      </section>

      <section className="ce-card" aria-labelledby="chapter-description-title">
        <div className="ce-card-heading">
          <div>
            <p className="ce-kicker">ÉTAPE 2 · RECOMMANDÉ</p>
            <h2 id="chapter-description-title">Description de la vidéo</h2>
            <p>Mettez en gras, faites des listes à puces ou numérotées, ajoutez des liens.</p>
          </div>
          <button className="btn btn-outline-primary btn-sm" type="button" disabled={aiBusy || !values.title.trim()} onClick={generateDescription} title="Rédiger une description à partir du titre et de vos notes">
            <i className="bi bi-stars me-1" aria-hidden="true" />{aiBusy ? 'Rédaction…' : 'Rédiger avec l’IA'}
          </button>
        </div>
        {aiError && <div className="alert alert-warning" role="alert">{aiError}</div>}
        <RichTextEditor value={values.description} onChange={(description) => onChange({ description })} placeholder="Ce que l’apprenant va découvrir dans cette vidéo…" />
        <label className="ce-field mt-3">
          <span>Note interne <small>(visible uniquement par les inscrits)</small></span>
          <textarea rows="2" value={values.remarks || ''} onChange={(event) => onChange({ remarks: event.target.value })} placeholder="Ex. Durée 12 min · prérequis : chapitre 1" />
        </label>
      </section>
    </>
  )
}

export default ChapterForm
