import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import Sidebar from './User/Sidebar'
import TeacherSidebar from './Teacher/TeacherSidebar'
import RichTextEditor from './RichTextEditor'
import DOMPurify from 'dompurify'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const Groups = () => {
  const { group_id: routeGroupId } = useParams()
  const teacherId = localStorage.getItem('teacherId')
  const studentId = localStorage.getItem('studentId')
  const isTeacher = localStorage.getItem('teacherLoginStatus') === 'true' && Boolean(teacherId)
  const memberParams = useMemo(
    () => isTeacher ? { teacher_id: teacherId } : { student_id: studentId },
    [isTeacher, teacherId, studentId],
  )
  const [groups, setGroups] = useState([])
  const [activeGroupId, setActiveGroupId] = useState(routeGroupId || '')
  const [messages, setMessages] = useState([])
  const [message, setMessage] = useState('')
  const [assignment, setAssignment] = useState({ title: '', detail: '' })
  const [showAssignmentForm, setShowAssignmentForm] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const activeGroup = groups.find((group) => String(group.id) === String(activeGroupId))

  useEffect(() => {
    document.title = 'TCiD Center | Groupes de discussion'
  }, [])

  useEffect(() => {
    if (!studentId && !teacherId) return
    axios.get(`${baseUrl}/groups/`, { params: memberParams })
      .then((response) => {
        setGroups(response.data)
        if (routeGroupId && response.data.some((group) => String(group.id) === routeGroupId)) {
          setActiveGroupId(routeGroupId)
        } else if (response.data.length) setActiveGroupId((current) => current || String(response.data[0].id))
      })
      .catch((requestError) => {
        console.error('Impossible de charger les groupes :', requestError.response?.data || requestError)
        setError('Impossible de charger vos groupes.')
      })
  }, [studentId, teacherId, routeGroupId, memberParams])

  useEffect(() => {
    if (!activeGroupId || (!studentId && !teacherId)) return undefined
    let cancelled = false
    const loadMessages = () => axios.get(`${baseUrl}/groups/${activeGroupId}/messages/`, { params: memberParams })
      .then((response) => {
        if (!cancelled) {
          setMessages(response.data)
          setError('')
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          console.error('Impossible de charger la discussion :', requestError.response?.data || requestError)
          setError('Vous devez être membre de ce groupe pour accéder à la discussion.')
        }
      })
    loadMessages()
    const intervalId = window.setInterval(loadMessages, 8000)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [activeGroupId, studentId, teacherId, memberParams])

  const sendMessage = async (event) => {
    event.preventDefault()
    if (!activeGroupId || !message.trim()) return
    try {
      await axios.post(`${baseUrl}/groups/${activeGroupId}/messages/`, {
        ...memberParams,
        message: message.trim(),
      })
      setMessage('')
      setError('')
      setNotice('Message envoyé.')
      const response = await axios.get(`${baseUrl}/groups/${activeGroupId}/messages/`, { params: memberParams })
      setMessages(response.data)
    } catch (requestError) {
      console.error('Impossible d’envoyer le message :', requestError.response?.data || requestError)
      setError(requestError.response?.data?.detail || 'Impossible d’envoyer le message.')
    }
  }

  const sendAssignment = async (event) => {
    event.preventDefault()
    try {
      const response = await axios.post(`${baseUrl}/groups/${activeGroupId}/assignments/`, {
        teacher_id: teacherId,
        ...assignment,
        detail: DOMPurify.sanitize(assignment.detail),
      })
      setNotice(`Devoir envoyé à ${response.data.created} apprenant(s) du groupe.`)
      setAssignment({ title: '', detail: '' })
      setShowAssignmentForm(false)
      setError('')
    } catch (requestError) {
      console.error('Impossible d’envoyer le devoir au groupe :', requestError.response?.data || requestError)
      setError(requestError.response?.data?.detail || 'Impossible d’envoyer le devoir au groupe.')
    }
  }

  const SidebarComponent = isTeacher ? TeacherSidebar : Sidebar

  return (
    <div className="container mt-4">
      <div className="row">
        <aside className="col-md-3"><SidebarComponent /></aside>
        <section className="col-md-9">
          <div className="card">
            <h4 className="card-header">Mes groupes de discussion</h4>
            {error && <div className="alert alert-danger m-3" role="alert">{error}</div>}
            {notice && <div className="alert alert-success m-3" role="status">{notice}</div>}
            {!groups.length ? <div className="card-body">Vous n’êtes membre d’aucun groupe. Contactez l’administration pour être ajouté.</div> : (
              <div className="card-body">
                <label className="form-label" htmlFor="group-selector">Choisir un groupe</label>
                <select className="form-select mb-3" id="group-selector" value={activeGroupId} onChange={(event) => setActiveGroupId(event.target.value)}>
                  {groups.map((group) => <option key={group.id} value={group.id}>{group.name} ({group.member_count} membres)</option>)}
                </select>
                {activeGroup && <div className="d-flex align-items-center gap-3 mb-3">
                  {activeGroup.cover_image && <img src={activeGroup.cover_image} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8 }} />}
                  <h5 className="mb-0">{activeGroup.name}</h5>
                  {isTeacher && <button className="btn btn-outline-primary btn-sm ms-auto" type="button" onClick={() => setShowAssignmentForm((visible) => !visible)}>Donner un devoir au groupe</button>}
                </div>}
                {isTeacher && showAssignmentForm && <form className="border rounded p-3 mb-3" onSubmit={sendAssignment}>
                  <h6>Devoir envoyé aux apprenants du groupe</h6>
                  <label className="form-label" htmlFor="group-assignment-title">Titre</label>
                  <input className="form-control mb-2" id="group-assignment-title" required value={assignment.title} onChange={(event) => setAssignment({ ...assignment, title: event.target.value })} />
                  <label className="form-label" htmlFor="group-assignment-detail">Consignes</label>
                  <div id="group-assignment-detail" className="mb-3 assignment-rich-editor">
                    <RichTextEditor value={assignment.detail} onChange={(detail) => setAssignment((current) => ({ ...current, detail }))} placeholder="Rédigez les consignes du devoir…" />
                  </div>
                  <button className="btn btn-primary" type="submit">Envoyer aux apprenants</button>
                </form>}
                <div className="border rounded p-3 mb-3" style={{ height: 420, overflowY: 'auto' }} aria-live="polite">
                  {messages.map((item) => <article className="mb-3" key={item.id}>
                    <strong>{item.sender_name}</strong><small className="text-muted ms-2">{new Date(item.created_at).toLocaleString()}</small>
                    <p className="mb-0 text-break">{item.message}</p>
                  </article>)}
                  {!messages.length && <p className="text-muted">Aucun message pour le moment. Lancez la discussion.</p>}
                </div>
                <form onSubmit={sendMessage}>
                  <label className="form-label" htmlFor="group-message">Message</label>
                  <textarea id="group-message" className="form-control mb-2" rows="2" maxLength={5000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Écrire aux membres du groupe…" required />
                  <button className="btn btn-success" type="submit" disabled={!message.trim()}>Envoyer</button>
                </form>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

export default Groups
