import React from 'react'
import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import relativeMessageTime from './relativeMessageTime'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const ChatAvatar = ({ source, name }) => {
  const [hasError, setHasError] = useState(!source)

  useEffect(() => setHasError(!source), [source])

  if (!source || hasError) {
    return <span className="chat-message-avatar chat-message-avatar--fallback" aria-label={`${name} profile`}>{name?.trim().charAt(0).toUpperCase() || '?'}</span>
  }

  return <img className="chat-message-avatar" src={source} alt="" onError={() => setHasError(true)} />
}

const ChatThread = ({ teacherId, studentId, viewer }) => {
  const [messages, setMessages] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const threadRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const loadMessages = async () => {
      try {
        const response = await axios.get(
          `${baseUrl}/get-message/${teacherId}/${studentId}?viewer=${viewer}`
        )
        if (!cancelled) setMessages(response.data)
      } catch (error) {
        console.error('Could not load conversation:', error.response?.data || error)
      }
    }

    loadMessages()
    const intervalId = window.setInterval(loadMessages, 30000)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [teacherId, studentId, viewer, refreshKey])

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight
  }, [messages])

  const saveMessage = async (messageId) => {
    const updatedText = editText.trim()
    if (!updatedText) return
    try {
      const response = await axios.patch(`${baseUrl}/message/${messageId}/${viewer}/`, {
        msg_to: updatedText,
      })
      setMessages(currentMessages => currentMessages.map(message =>
        message.id === messageId ? response.data : message
      ))
      setEditingId(null)
      setEditText('')
    } catch (error) {
      console.error('Could not edit message:', error.response?.data || error)
    }
  }

  const deleteMessage = async (messageId) => {
    if (!window.confirm('Supprimer ce message ?')) return
    try {
      await axios.delete(`${baseUrl}/message/${messageId}/${viewer}/`)
      setMessages(currentMessages => currentMessages.filter(message => message.id !== messageId))
    } catch (error) {
      console.error('Could not delete message:', error.response?.data || error)
    }
  }

  return (
    <>
      <div className="chat-toolbar">
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setRefreshKey(key => key + 1)} title="Actualiser les messages" aria-label="Actualiser les messages">
          <i className="bi bi-arrow-clockwise" aria-hidden="true"></i> Actualiser
        </button>
      </div>
      <div className="chat-thread" id="msgList" ref={threadRef} aria-live="polite">
        {messages.map(message => {
          const isOwnMessage = message.msg_from === viewer
          return (
            <div className={`chat-row ${isOwnMessage ? 'chat-row--sent' : 'chat-row--received'}`} key={message.id}>
              {!isOwnMessage && <ChatAvatar source={message.sender_profile_img} name={message.sender_name} />}
              <div className={`chat-message ${isOwnMessage ? 'chat-message--sent' : 'chat-message--received'}`}>
                <div className="chat-message-sender">{message.sender_name}</div>
                {editingId === message.id ? (
                  <div className="chat-edit-form">
                    <textarea className="form-control" value={editText} onChange={event => setEditText(event.target.value)} rows="2" aria-label="Modifier le message" />
                    <div className="chat-message-actions">
                      <button type="button" className="btn btn-sm btn-success" onClick={() => saveMessage(message.id)}>Enregistrer</button>
                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setEditingId(null)}>Annuler</button>
                    </div>
                  </div>
                ) : <div>{message.msg_to}</div>}
                <div className="chat-message-footer">
                  <small className="chat-time" title={new Date(message.msg_time).toLocaleString('fr-FR')}>
                    {relativeMessageTime(message.msg_time)}{message.edited_at ? ' · modifié' : ''}
                  </small>
                  {isOwnMessage && <small className="chat-read-state">{message.is_read ? 'Lu' : 'Non lu'}</small>}
                </div>
                {isOwnMessage && editingId !== message.id && <div className="chat-message-actions">
                  <button type="button" className="chat-icon-button" aria-label="Modifier le message" title="Modifier" onClick={() => { setEditingId(message.id); setEditText(message.msg_to) }}>
                    <i className="bi bi-pencil" aria-hidden="true"></i>
                  </button>
                  <button type="button" className="chat-icon-button chat-icon-button--danger" aria-label="Supprimer le message" title="Supprimer" onClick={() => deleteMessage(message.id)}>
                    <i className="bi bi-trash" aria-hidden="true"></i>
                  </button>
                </div>}
              </div>
              {isOwnMessage && <ChatAvatar source={message.sender_profile_img} name={message.sender_name} />}
            </div>
          )
        })}
      </div>
    </>
  )
}

export default ChatThread