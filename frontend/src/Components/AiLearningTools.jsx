import React, { useState } from 'react'
import axios from 'axios'
import './AiLearningTools.css'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const SUGGESTIONS = [
  'Explique-moi le sujet principal de cette formation simplement',
  'Quels sont les points clés à retenir ?',
  'Donne-moi un exemple concret',
  'Pose-moi 3 questions pour réviser',
]

const renderInline = (text) => text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => (
  part.startsWith('**') && part.endsWith('**')
    ? <strong key={index}>{part.slice(2, -2)}</strong>
    : <React.Fragment key={index}>{part}</React.Fragment>
))

const FormattedAnswer = ({ text }) => {
  const groups = []
  text.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim()
    if (!line) return
    const bullet = line.match(/^(?:[-•*]|\d+[.)])\s+(.*)$/)
    const last = groups[groups.length - 1]
    if (bullet && last?.type === 'list') last.items.push(bullet[1])
    else if (bullet) groups.push({ type: 'list', items: [bullet[1]] })
    else groups.push({ type: 'paragraph', text: line.replace(/^#+\s*/, '') })
  })
  return (
    <div className="ai-formatted-answer">
      {groups.map((group, index) => (group.type === 'list'
        ? <ul key={index}>{group.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}</ul>
        : <p key={index}>{renderInline(group.text)}</p>))}
    </div>
  )
}

const AiLearningTools = ({ courseId, studentId }) => {
  const [mode, setMode] = useState('tutor')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [messages, setMessages] = useState([])
  const [feedback, setFeedback] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const askTutor = async (event, suggestion) => {
    event?.preventDefault()
    const prompt = (suggestion || question).trim()
    if (!prompt || isLoading) return
    const history = messages
      .filter((message) => !message.pending && message.answer)
      .slice(-3)
      .map((message) => ({ question: message.question, answer: message.answer }))
    setIsLoading(true)
    setError('')
    setQuestion('')
    const messageId = `${Date.now()}-${Math.random()}`
    setMessages((current) => [...current, { id: messageId, question: prompt, pending: true }])
    try {
      const response = await axios.post(`${baseUrl}/ai/courses/${courseId}/tutor/`, {
        student_id: studentId,
        question: prompt,
        history,
      })
      setMessages((current) => current.map((message) => (
        message.id === messageId ? { ...message, ...response.data, pending: false } : message
      )))
    } catch (requestError) {
      setMessages((current) => current.filter((message) => message.id !== messageId))
      const detail = requestError.response?.data?.detail || 'Le tuteur est momentanément indisponible.'
      setError(detail)
      setQuestion(prompt)
    } finally {
      setIsLoading(false)
    }
  }

  const requestFeedback = async (event) => {
    event.preventDefault()
    if (!question.trim() || !answer.trim() || isLoading) return
    setIsLoading(true)
    setError('')
    setFeedback('')
    try {
      const response = await axios.post(`${baseUrl}/ai/courses/${courseId}/feedback/`, {
        student_id: studentId,
        question: question.trim(),
        answer: answer.trim(),
      })
      setFeedback(response.data.feedback)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Le feedback est momentanément indisponible.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="ai-learning-panel" aria-labelledby="ai-learning-title">
      <header className="ai-learning-header">
        <div className="ai-learning-mark"><i className="bi bi-stars" aria-hidden="true" /></div>
        <div>
          <p className="ai-learning-eyebrow">ASSISTANCE PÉDAGOGIQUE</p>
          <h2 id="ai-learning-title">Votre assistant de formation</h2>
          <p>Des réponses simples, basées sur les vidéos et documents de la formation.</p>
        </div>
      </header>

      <div className="ai-learning-tabs" role="tablist" aria-label="Outils IA">
        <button
          aria-selected={mode === 'tutor'}
          className={mode === 'tutor' ? 'is-selected' : ''}
          onClick={() => { setMode('tutor'); setError('') }}
          role="tab"
          type="button"
        >
          <i className="bi bi-chat-square-text" aria-hidden="true" /> Poser une question
        </button>
        <button
          aria-selected={mode === 'feedback'}
          className={mode === 'feedback' ? 'is-selected' : ''}
          onClick={() => { setMode('feedback'); setError('') }}
          role="tab"
          type="button"
        >
          <i className="bi bi-pencil-square" aria-hidden="true" /> Retour sur une réponse
        </button>
      </div>

      {error && <div className="ai-learning-error" role="alert">{error}</div>}

      {mode === 'tutor' ? (
        <>
          <div className="ai-tutor-history" aria-live="polite">
            {messages.length === 0 && (
              <div className="ai-learning-empty">
                <p>Posez une question sur une notion de cette formation. Exemples :</p>
                <div className="ai-suggestions">
                  {SUGGESTIONS.map((item) => (
                    <button key={item} type="button" disabled={isLoading} onClick={() => askTutor(null, item)}>{item}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message) => (
              <article className="ai-tutor-turn" key={message.id}>
                <p className="ai-tutor-question"><span>Vous</span>{message.question}</p>
                <div className="ai-tutor-response">
                  <span className="ai-tutor-label"><i className="bi bi-stars" aria-hidden="true" /> Tuteur</span>
                  {message.pending
                    ? <p className="ai-typing">Recherche dans les vidéos et documents de la formation…</p>
                    : <FormattedAnswer text={message.answer || ''} />}
                  {message.cached && <small>Réponse réutilisée depuis le cache</small>}
                  {message.sources?.length > 0 && <small>Sources : {message.sources.join(', ')}</small>}
                </div>
              </article>
            ))}
          </div>
          <form className="ai-learning-form" onSubmit={askTutor}>
            <label htmlFor="ai-tutor-question">Votre question</label>
            <div className="ai-learning-input-row">
              <input
                id="ai-tutor-question"
                maxLength="1000"
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ex. Explique la différence entre une liste et un tuple…"
                value={question}
              />
              <button aria-label="Envoyer la question" className="btn btn-dark" disabled={!question.trim() || isLoading} title="Envoyer" type="submit">
                <i className="bi bi-send-fill" aria-hidden="true" />
              </button>
            </div>
          </form>
        </>
      ) : (
        <form className="ai-feedback-form" onSubmit={requestFeedback}>
          <label htmlFor="ai-feedback-question">Question sur la formation</label>
          <input
            id="ai-feedback-question"
            maxLength="1000"
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Saisissez la question à laquelle vous répondez"
            value={question}
          />
          <label htmlFor="ai-feedback-answer">Votre réponse <small>500 mots maximum</small></label>
          <textarea
            id="ai-feedback-answer"
            maxLength="4000"
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="Rédigez votre réponse ici…"
            rows="5"
            value={answer}
          />
          <button className="btn btn-dark" disabled={!question.trim() || !answer.trim() || isLoading} type="submit">
            <i className="bi bi-check2-circle" aria-hidden="true" />
            {isLoading ? 'Analyse…' : 'Obtenir un retour'}
          </button>
          {feedback && <div className="ai-feedback-result"><span>Retour pédagogique · grille à 4 critères</span><FormattedAnswer text={feedback} /></div>}
        </form>
      )}
    </section>
  )
}

export default AiLearningTools