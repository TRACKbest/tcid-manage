import React, { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'
const WHITEBOARD_CHUNK_SIZE = 100
const MAX_RECONNECT_ATTEMPTS = 8

const loadJitsiApi = (domain) => {
  if (window.JitsiMeetExternalAPI) return Promise.resolve(window.JitsiMeetExternalAPI)
  if (!window.tcidJitsiApiPromise) {
    window.tcidJitsiApiPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = `https://${domain}/external_api.js`
      script.async = true
      script.onload = () => resolve(window.JitsiMeetExternalAPI)
      script.onerror = () => {
        window.tcidJitsiApiPromise = null
        script.remove()
        reject(new Error('jitsi-unavailable'))
      }
      document.body.appendChild(script)
    })
  }
  return window.tcidJitsiApiPromise
}

const drawStroke = (canvas, stroke) => {
  if (!canvas || !stroke?.points?.length) return
  const context = canvas.getContext('2d')
  context.strokeStyle = stroke.color || '#00a99d'
  context.lineWidth = 3
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.beginPath()
  stroke.points.forEach((point, index) => {
    const x = point.x * canvas.width
    const y = point.y * canvas.height
    if (index === 0) context.moveTo(x, y)
    else context.lineTo(x, y)
  })
  if (stroke.points.length === 1) context.lineTo(stroke.points[0].x * canvas.width + 0.1, stroke.points[0].y * canvas.height + 0.1)
  context.stroke()
}

const LiveRoom = ({ classroom, joinInfo, role, participantId, onLeave, onEnd }) => {
  const jitsiContainerRef = useRef(null)
  const jitsiApiRef = useRef(null)
  const socketRef = useRef(null)
  const canvasRef = useRef(null)
  const drawingRef = useRef(null)
  const onLeaveRef = useRef(onLeave)
  const [videoStatus, setVideoStatus] = useState('Chargement de la visioconférence…')
  const [videoError, setVideoError] = useState('')
  const [connectionStatus, setConnectionStatus] = useState('Connexion…')
  const [boardStrokes, setBoardStrokes] = useState([])
  const [boardOpen, setBoardOpen] = useState(false)
  const [poll, setPoll] = useState(null)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState('Oui\nNon')
  const [voted, setVoted] = useState(false)
  const [notice, setNotice] = useState('')
  const [roomEnded, setRoomEnded] = useState(false)
  const [strokeColor, setStrokeColor] = useState('#00a99d')
  const canModerate = role === 'teacher'
  const jitsi = joinInfo.jitsi

  useEffect(() => {
    onLeaveRef.current = onLeave
  }, [onLeave])

  // Video, audio, screen sharing, chat and raised hands run on the Jitsi SFU.
  useEffect(() => {
    if (!jitsi) {
      setVideoError('La visioconférence n’est pas encore configurée sur le serveur. Contactez l’administrateur.')
      return undefined
    }
    let disposed = false
    loadJitsiApi(jitsi.domain)
      .then((JitsiMeetExternalAPI) => {
        if (disposed || !jitsiContainerRef.current) return
        const api = new JitsiMeetExternalAPI(jitsi.domain, {
          roomName: jitsi.room,
          jwt: jitsi.jwt,
          parentNode: jitsiContainerRef.current,
          width: '100%',
          height: '100%',
          lang: 'fr',
          userInfo: { displayName: joinInfo.display_name },
          configOverwrite: {
            subject: classroom.title,
            prejoinConfig: { enabled: true },
            disableDeepLinking: true,
            disableInviteFunctions: true,
            startWithAudioMuted: !canModerate,
            resolution: 720,
            constraints: { video: { height: { ideal: 720, max: 720, min: 180 } } },
            disableThirdPartyRequests: true,
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_BRAND_WATERMARK: false,
            MOBILE_APP_PROMO: false,
            SHOW_CHROME_EXTENSION_BANNER: false,
          },
        })
        jitsiApiRef.current = api
        setVideoStatus('Testez votre caméra puis cliquez sur « Rejoindre la réunion ».')
        api.addListener('videoConferenceJoined', () => setVideoStatus('Vous êtes en direct.'))
        api.addListener('readyToClose', () => onLeaveRef.current?.())
      })
      .catch(() => {
        if (!disposed) setVideoError('Le serveur de visioconférence est injoignable. Vérifiez votre connexion puis rechargez la page.')
      })
    return () => {
      disposed = true
      jitsiApiRef.current?.dispose()
      jitsiApiRef.current = null
    }
  }, [jitsi, joinInfo.display_name, classroom.title, canModerate])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    context.clearRect(0, 0, canvas.width, canvas.height)
    boardStrokes.forEach((stroke) => drawStroke(canvas, stroke))
  }, [boardStrokes, boardOpen])

  // Whiteboard, polls and the end-of-session signal use the TCiD WebSocket.
  useEffect(() => {
    let disposed = false
    let reconnectTimer = null
    let attempts = 0

    const handleMessage = (event) => {
      const message = JSON.parse(event.data)
      if (message.type === 'whiteboard') {
        setBoardStrokes((current) => [...current, message.stroke])
      } else if (message.type === 'whiteboard_clear') {
        setBoardStrokes([])
      } else if (message.type === 'poll_started' || message.type === 'poll_results') {
        setPoll(message.poll)
        if (message.type === 'poll_started') setVoted(false)
      } else if (message.type === 'session_ended') {
        setRoomEnded(true)
        setConnectionStatus('Session terminée')
        jitsiApiRef.current?.executeCommand('hangup')
      }
    }

    const connect = () => {
      const socketUrl = new URL(`/ws/live-classrooms/${classroom.id}/`, window.location.origin)
      socketUrl.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      socketUrl.searchParams.set('token', joinInfo.token)
      const socket = new WebSocket(socketUrl.toString())
      socketRef.current = socket
      socket.onmessage = handleMessage
      socket.onopen = () => {
        attempts = 0
        setConnectionStatus('Connecté')
      }
      socket.onclose = (event) => {
        if (disposed || socketRef.current !== socket) return
        if (event.code === 4401) {
          setConnectionStatus('Accès refusé')
          return
        }
        if (attempts >= MAX_RECONNECT_ATTEMPTS) {
          setConnectionStatus('Déconnecté')
          return
        }
        attempts += 1
        setConnectionStatus('Reconnexion…')
        reconnectTimer = window.setTimeout(connect, Math.min(1000 * 2 ** attempts, 15000))
      }
    }
    connect()

    const params = role === 'teacher' ? { teacher_id: participantId } : { student_id: participantId }
    axios.get(`${baseUrl}/live-classrooms/${classroom.id}/polls/`, { params })
      .then((response) => {
        const currentPoll = response.data.find((item) => item.is_active)
        if (currentPoll && !disposed) setPoll(currentPoll)
      })
      .catch((error) => console.error('Could not load live polls:', error.response?.data || error))

    return () => {
      disposed = true
      window.clearTimeout(reconnectTimer)
      socketRef.current?.close()
    }
  }, [classroom.id, joinInfo.token, participantId, role])

  const sendMessage = useCallback((message) => {
    const socket = socketRef.current
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
  }, [])

  const endClass = () => {
    jitsiApiRef.current?.executeCommand('endConference')
    onEnd?.()
  }

  const createPoll = async (event) => {
    event.preventDefault()
    const options = pollOptions.split('\n').map((option) => option.trim()).filter(Boolean)
    try {
      const response = await axios.post(`${baseUrl}/live-classrooms/${classroom.id}/polls/`, {
        teacher_id: participantId,
        question: pollQuestion.trim(),
        options,
      })
      setPoll(response.data)
      setPollQuestion('')
      setVoted(false)
    } catch (error) {
      setNotice(error.response?.data?.detail || 'Le sondage n’a pas pu être lancé.')
    }
  }

  const voteInPoll = async (optionIndex) => {
    if (!poll) return
    try {
      const response = await axios.post(`${baseUrl}/live-class-polls/${poll.id}/vote/`, {
        student_id: participantId,
        option_index: optionIndex,
      })
      setPoll(response.data)
      setVoted(true)
    } catch (error) {
      setNotice(error.response?.data?.detail || 'Votre réponse n’a pas été enregistrée.')
    }
  }

  const getCanvasPoint = (event) => {
    const bounds = canvasRef.current.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    }
  }

  const startDrawing = (event) => {
    if (event.button !== 0) return
    canvasRef.current.setPointerCapture(event.pointerId)
    const stroke = { color: strokeColor, points: [getCanvasPoint(event)] }
    drawingRef.current = stroke
    setBoardStrokes((current) => [...current, stroke])
  }

  const continueDrawing = (event) => {
    if (!drawingRef.current) return
    const stroke = { ...drawingRef.current, points: [...drawingRef.current.points, getCanvasPoint(event)] }
    drawingRef.current = stroke
    setBoardStrokes((current) => [...current.slice(0, -1), stroke])
  }

  const finishDrawing = () => {
    if (!drawingRef.current) return
    const stroke = drawingRef.current
    drawingRef.current = null
    for (let start = 0; start < stroke.points.length; start += WHITEBOARD_CHUNK_SIZE - 1) {
      const points = stroke.points.slice(start, start + WHITEBOARD_CHUNK_SIZE)
      if (points.length) sendMessage({ type: 'whiteboard', stroke: { ...stroke, points } })
    }
  }

  const clearBoard = () => {
    setBoardStrokes([])
    sendMessage({ type: 'whiteboard_clear' })
  }

  return (
    <main className="live-room-page">
      <header className="live-room-header">
        <div className="live-room-title-block">
          <span className="live-room-live-mark"><i className="bi bi-broadcast" aria-hidden="true" />{roomEnded ? 'TERMINÉE' : 'EN DIRECT'}</span>
          <h1>{classroom.title}</h1>
          <span className="live-room-course">{classroom.course_title}</span>
        </div>
        <div className="live-room-header-actions">
          <span className="live-room-connection" title="Tableau blanc et sondages"><span />{connectionStatus}</span>
          {canModerate && onEnd ? (
            <button className="btn btn-outline-danger btn-sm" onClick={endClass} type="button">Terminer la classe</button>
          ) : null}
          <button className="btn btn-dark btn-sm" onClick={onLeave} type="button">Quitter</button>
        </div>
      </header>

      {(notice || roomEnded) && (
        <div className={`live-room-notice ${roomEnded ? 'is-ended' : ''}`} role="status">
          {roomEnded ? 'Le formateur a terminé cette session.' : notice}
          {!roomEnded && <button type="button" onClick={() => setNotice('')} aria-label="Fermer le message">×</button>}
        </div>
      )}

      <div className="live-room-layout">
        <section className="live-room-main-column">
          <div className="live-jitsi-stage">
            {videoError
              ? <div className="live-jitsi-message" role="alert"><i className="bi bi-camera-video-off" aria-hidden="true" /><p>{videoError}</p></div>
              : <div className="live-jitsi-frame" ref={jitsiContainerRef} />}
          </div>
          {!videoError && <p className="live-jitsi-status"><i className="bi bi-info-circle" aria-hidden="true" /> {videoStatus} Le chat, la main levée et le partage d’écran sont dans la barre de la visioconférence.</p>}

          <section className="live-whiteboard" aria-labelledby="live-whiteboard-title">
            <div className="live-panel-heading">
              <div><span className="live-class-eyebrow">COLLABORATION</span><h2 id="live-whiteboard-title">Tableau blanc</h2></div>
              <div className="live-board-tools">
                {boardOpen && ['#00a99d', '#e55c50', '#29354b', '#e5ad39'].map((color) => (
                  <button
                    aria-label={`Choisir la couleur ${color}`}
                    className={`live-color-swatch ${strokeColor === color ? 'is-selected' : ''}`}
                    key={color}
                    onClick={() => setStrokeColor(color)}
                    style={{ '--swatch-color': color }}
                    type="button"
                  />
                ))}
                {boardOpen && canModerate && <button className="btn btn-outline-secondary btn-sm" onClick={clearBoard} type="button">Effacer</button>}
                <button className="btn btn-outline-dark btn-sm" onClick={() => setBoardOpen((value) => !value)} type="button" aria-expanded={boardOpen}>
                  {boardOpen ? 'Masquer' : `Afficher${boardStrokes.length ? ` (${boardStrokes.length})` : ''}`}
                </button>
              </div>
            </div>
            {boardOpen && (
              <canvas
                aria-label="Tableau blanc collaboratif"
                className="live-whiteboard-canvas"
                height="420"
                onPointerCancel={finishDrawing}
                onPointerDown={startDrawing}
                onPointerMove={continueDrawing}
                onPointerUp={finishDrawing}
                ref={canvasRef}
                width="960"
              />
            )}
          </section>
        </section>

        <aside className="live-room-sidebar">
          <section className="live-side-panel live-poll-panel">
            <div className="live-panel-heading"><div><span className="live-class-eyebrow">PARTICIPATION</span><h2>Sondage</h2></div><i className="bi bi-bar-chart-line" aria-hidden="true" /></div>
            {canModerate && (
              <form className="live-poll-form" onSubmit={createPoll}>
                <label><span>Question</span><input maxLength="300" onChange={(event) => setPollQuestion(event.target.value)} placeholder="Votre question" value={pollQuestion} /></label>
                <label><span>Choix <small>un par ligne</small></span><textarea onChange={(event) => setPollOptions(event.target.value)} rows="3" value={pollOptions} /></label>
                <button className="btn btn-dark btn-sm" disabled={!pollQuestion.trim()} type="submit"><i className="bi bi-play-fill me-1" />Lancer le sondage</button>
              </form>
            )}
            {!poll && <p className="live-panel-empty">Aucun sondage actif.</p>}
            {poll && (
              <div className="live-poll-results">
                <h3>{poll.question}</h3>
                {poll.options.map((option, index) => {
                  const result = poll.results?.[index]
                  const totalVotes = poll.results?.reduce((sum, item) => sum + item.votes, 0) || 0
                  const percentage = totalVotes ? Math.round((result?.votes || 0) / totalVotes * 100) : 0
                  return (
                    <button
                      className="live-poll-option"
                      disabled={canModerate || voted || !poll.is_active}
                      key={`${poll.id}-${option}`}
                      onClick={() => voteInPoll(index)}
                      type="button"
                    >
                      <span>{option}</span><strong>{result?.votes || 0}</strong>
                      <span className="live-poll-bar"><i style={{ width: `${percentage}%` }} /></span>
                    </button>
                  )
                })}
                {voted && <p className="live-poll-confirmation">Réponse enregistrée.</p>}
              </div>
            )}
          </section>
          <section className="live-side-panel live-help-panel">
            <div className="live-panel-heading"><div><span className="live-class-eyebrow">AIDE</span><h2>Bien démarrer</h2></div><i className="bi bi-lightbulb" aria-hidden="true" /></div>
            <ul>
              <li>Autorisez la caméra et le micro quand le navigateur le demande.</li>
              <li>Utilisez des écouteurs pour éviter l’écho.</li>
              <li>Connexion faible ? Coupez votre caméra : le son reste fluide.</li>
            </ul>
          </section>
        </aside>
      </div>
    </main>
  )
}

export default LiveRoom
