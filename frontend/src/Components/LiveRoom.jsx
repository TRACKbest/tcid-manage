import React, { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import {
  DEFAULT_ICE_SERVERS,
  acquireMedia,
  getDeviceErrorMessage,
  listMediaDevices,
  requestSingleTrack,
  stopStream,
} from './liveMedia'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'
const WHITEBOARD_CHUNK_SIZE = 100
const MAX_ICE_RESTARTS = 3

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

const transceiverFor = (connection, kind) => connection.getTransceivers().find(
  (transceiver) => !transceiver.stopped && transceiver.receiver.track?.kind === kind,
)

const pickVideoTrack = (screenStream, localStream) => screenStream?.getVideoTracks()[0]
  || localStream?.getVideoTracks()[0]
  || null

const peerStateLabels = {
  new: 'Connexion…',
  connecting: 'Connexion…',
  disconnected: 'Reconnexion…',
  failed: 'Connexion impossible',
}

const LiveRoom = ({ classroom, joinInfo, initialStream, role, participantId, onLeave, onEnd }) => {
  const socketRef = useRef(null)
  const localStreamRef = useRef(initialStream || null)
  const screenStreamRef = useRef(null)
  const peersRef = useRef(new Map())
  const remoteStreamsRef = useRef(new Map())
  const remoteVideoRefs = useRef(new Map())
  const mediaStateRef = useRef({ microphone: false, camera: false, screen: false })
  const canvasRef = useRef(null)
  const drawingRef = useRef(null)
  const peerIdRef = useRef('')
  const localVideoRef = useRef(null)
  const [peerId, setPeerId] = useState('')
  const [participants, setParticipants] = useState([])
  const [remoteStreams, setRemoteStreams] = useState({})
  const [remoteVideoLive, setRemoteVideoLive] = useState({})
  const [peerStates, setPeerStates] = useState({})
  const [autoplayBlocked, setAutoplayBlocked] = useState(false)
  const [boardStrokes, setBoardStrokes] = useState([])
  const [chatMessages, setChatMessages] = useState([])
  const [draftMessage, setDraftMessage] = useState('')
  const [poll, setPoll] = useState(null)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState('Oui\nNon')
  const [voted, setVoted] = useState(false)
  const [handRaised, setHandRaised] = useState(false)
  const [micEnabled, setMicEnabled] = useState(() => Boolean(initialStream?.getAudioTracks()[0]?.enabled))
  const [micAvailable, setMicAvailable] = useState(() => Boolean(initialStream?.getAudioTracks().length))
  const [cameraEnabled, setCameraEnabled] = useState(() => Boolean(initialStream?.getVideoTracks()[0]?.enabled))
  const [cameraAvailable, setCameraAvailable] = useState(() => Boolean(initialStream?.getVideoTracks().length))
  const [forcedMicOff, setForcedMicOff] = useState(false)
  const [forcedCameraOff, setForcedCameraOff] = useState(false)
  const [sharingScreen, setSharingScreen] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('Connexion…')
  const [mediaError, setMediaError] = useState('')
  const [roomEnded, setRoomEnded] = useState(false)
  const [strokeColor, setStrokeColor] = useState('#00a99d')
  const [expandedVideo, setExpandedVideo] = useState(null)
  const [fullscreenVideoId, setFullscreenVideoId] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [devices, setDevices] = useState({ cameras: [], microphones: [] })
  const [mediaReady, setMediaReady] = useState(Boolean(initialStream))
  const canShareScreen = Boolean(navigator.mediaDevices?.getDisplayMedia)

  const sendMessage = useCallback((message) => {
    const socket = socketRef.current
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
  }, [])

  const replaceOutgoingTrack = useCallback(async (kind, track) => {
    for (const { connection } of peersRef.current.values()) {
      const transceiver = transceiverFor(connection, kind)
      if (transceiver) {
        try {
          await transceiver.sender.replaceTrack(track)
        } catch (error) {
          console.error(`Could not replace the outgoing ${kind} track:`, error)
        }
      }
    }
  }, [])

  const refreshLocalPreview = useCallback(() => {
    const video = localVideoRef.current
    if (!video) return
    video.srcObject = null
    video.srcObject = screenStreamRef.current || localStreamRef.current
    if (video.srcObject) video.play().catch(() => {})
  }, [])

  const playRemote = useCallback((element) => {
    if (!element?.srcObject) return
    element.play().catch((error) => {
      if (error?.name === 'NotAllowedError') setAutoplayBlocked(true)
    })
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    context.clearRect(0, 0, canvas.width, canvas.height)
    boardStrokes.forEach((stroke) => drawStroke(canvas, stroke))
  }, [boardStrokes])

  useEffect(() => {
    refreshLocalPreview()
  }, [cameraAvailable, sharingScreen, mediaReady, refreshLocalPreview])

  useEffect(() => {
    remoteVideoRefs.current.forEach((element, remotePeerId) => {
      const stream = remoteStreams[remotePeerId] || null
      if (element && element.srcObject !== stream) {
        element.srcObject = stream
        playRemote(element)
      }
    })
  }, [remoteStreams, participants, playRemote])

  useEffect(() => {
    const state = {
      microphone: micAvailable && micEnabled,
      camera: (cameraAvailable && cameraEnabled) || sharingScreen,
      screen: sharingScreen,
    }
    mediaStateRef.current = state
    if (peerId) sendMessage({ type: 'media_state', ...state })
  }, [micAvailable, micEnabled, cameraAvailable, cameraEnabled, sharingScreen, peerId, sendMessage])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreenVideoId(document.fullscreenElement?.dataset.videoId || null)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    let disposed = false
    let reconnectTimer = null
    const peers = peersRef.current
    const remoteStreamMap = remoteStreamsRef.current
    const rtcConfiguration = {
      iceServers: joinInfo.ice_servers?.length ? joinInfo.ice_servers : DEFAULT_ICE_SERVERS,
      bundlePolicy: 'max-bundle',
    }

    const removePeer = (remotePeerId) => {
      const peer = peers.get(remotePeerId)
      if (peer) {
        window.clearTimeout(peer.restartTimer)
        peer.connection.close()
      }
      peers.delete(remotePeerId)
      remoteStreamMap.delete(remotePeerId)
      setRemoteStreams((current) => {
        const next = { ...current }
        delete next[remotePeerId]
        return next
      })
    }

    const startRoom = async () => {
      if (!localStreamRef.current) {
        const result = await acquireMedia()
        if (disposed) {
          stopStream(result.stream)
          return
        }
        localStreamRef.current = result.stream
        setCameraAvailable(result.stream.getVideoTracks().length > 0)
        setCameraEnabled(result.stream.getVideoTracks().length > 0)
        setMicAvailable(result.stream.getAudioTracks().length > 0)
        setMicEnabled(result.stream.getAudioTracks().length > 0)
        if (result.videoError) setMediaError(getDeviceErrorMessage(result.videoError, 'caméra'))
        else if (result.audioError) setMediaError(getDeviceErrorMessage(result.audioError, 'micro'))
        setMediaReady(true)
      }
      listMediaDevices().then((found) => { if (!disposed) setDevices(found) }).catch(() => {})

      let reconnectAttempts = 0
      const send = (message) => {
        const socket = socketRef.current
        if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
      }

      const sendOffer = async (remotePeerId, options = {}) => {
        const peer = peers.get(remotePeerId)
        if (!peer) return
        try {
          const offer = await peer.connection.createOffer(options)
          await peer.connection.setLocalDescription(offer)
          send({ type: 'signal', target: remotePeerId, signal: peer.connection.localDescription.toJSON() })
        } catch (error) {
          console.error('Could not send a WebRTC offer:', error)
        }
      }

      const restartIce = (remotePeerId) => {
        const peer = peers.get(remotePeerId)
        if (!peer || !peer.isOfferer || peer.restarts >= MAX_ICE_RESTARTS) return
        peer.restarts += 1
        peer.connection.restartIce?.()
        sendOffer(remotePeerId, { iceRestart: true })
      }

      const createPeer = (remotePeerId, isOfferer) => {
        const existing = peers.get(remotePeerId)
        if (existing) return existing
        const connection = new RTCPeerConnection(rtcConfiguration)
        const peer = { connection, isOfferer, pendingCandidates: [], restarts: 0, restartTimer: null }
        peers.set(remotePeerId, peer)

        if (isOfferer) {
          // Always negotiate both kinds so a camera/mic enabled later only needs replaceTrack().
          const stream = localStreamRef.current || new MediaStream()
          connection.addTransceiver(stream.getAudioTracks()[0] || 'audio', { direction: 'sendrecv', streams: [stream] })
          connection.addTransceiver(pickVideoTrack(screenStreamRef.current, localStreamRef.current) || 'video', { direction: 'sendrecv', streams: [stream] })
        }

        connection.onicecandidate = (event) => {
          if (event.candidate) send({ type: 'signal', target: remotePeerId, signal: { candidate: event.candidate.toJSON() } })
        }
        connection.ontrack = (event) => {
          const { track } = event
          const previous = remoteStreamMap.get(remotePeerId)
          const tracks = previous ? previous.getTracks().filter((item) => item.kind !== track.kind) : []
          const stream = new MediaStream([...tracks, track])
          remoteStreamMap.set(remotePeerId, stream)
          setRemoteStreams((current) => ({ ...current, [remotePeerId]: stream }))
          if (track.kind === 'video') {
            const updateLive = () => setRemoteVideoLive((current) => ({ ...current, [remotePeerId]: !track.muted }))
            track.onmute = updateLive
            track.onunmute = updateLive
            updateLive()
          }
        }
        connection.onconnectionstatechange = () => {
          const state = connection.connectionState
          setPeerStates((current) => ({ ...current, [remotePeerId]: state }))
          window.clearTimeout(peer.restartTimer)
          if (state === 'connected') peer.restarts = 0
          if (state === 'failed') restartIce(remotePeerId)
          if (state === 'disconnected') {
            peer.restartTimer = window.setTimeout(() => {
              if (connection.connectionState === 'disconnected') restartIce(remotePeerId)
            }, 4000)
          }
        }
        return peer
      }

      const attachLocalTracks = async (connection) => {
        const stream = localStreamRef.current || new MediaStream()
        const tracks = { audio: stream.getAudioTracks()[0] || null, video: pickVideoTrack(screenStreamRef.current, localStreamRef.current) }
        for (const kind of ['audio', 'video']) {
          const transceiver = transceiverFor(connection, kind)
          if (!transceiver) continue
          transceiver.direction = 'sendrecv'
          if (transceiver.sender.track !== tracks[kind]) await transceiver.sender.replaceTrack(tracks[kind])
          transceiver.sender.setStreams?.(stream)
        }
      }

      const flushCandidates = async (peer) => {
        const pending = peer.pendingCandidates.splice(0)
        for (const candidate of pending) {
          try {
            await peer.connection.addIceCandidate(candidate)
          } catch (error) {
            console.warn('Ignored an ICE candidate:', error)
          }
        }
      }

      const handleSignal = async (message) => {
        const { signal } = message
        try {
          if (signal.type === 'offer') {
            const peer = createPeer(message.from, false)
            await peer.connection.setRemoteDescription(signal)
            await attachLocalTracks(peer.connection)
            await flushCandidates(peer)
            const answer = await peer.connection.createAnswer()
            await peer.connection.setLocalDescription(answer)
            send({ type: 'signal', target: message.from, signal: peer.connection.localDescription.toJSON() })
          } else if (signal.type === 'answer') {
            const peer = peers.get(message.from)
            if (!peer || peer.connection.signalingState !== 'have-local-offer') return
            await peer.connection.setRemoteDescription(signal)
            await flushCandidates(peer)
          } else if (signal.candidate) {
            const peer = peers.get(message.from) || createPeer(message.from, false)
            if (peer.connection.remoteDescription) await peer.connection.addIceCandidate(signal.candidate)
            else peer.pendingCandidates.push(signal.candidate)
          }
        } catch (error) {
          console.error('WebRTC signaling failed:', error)
        }
      }

      const handleMessage = async (event) => {
        const message = JSON.parse(event.data)
        if (message.type === 'joined') {
          peerIdRef.current = message.peer_id
          setPeerId(message.peer_id)
          setParticipants((current) => [...current.filter((item) => item.peer_id !== message.peer_id), message])
          send({ type: 'roster_request' })
          send({ type: 'media_state', ...mediaStateRef.current })
        } else if (
          (message.type === 'participant_joined' || message.type === 'roster_response')
          && message.participant.peer_id !== peerIdRef.current
        ) {
          const remote = message.participant
          setParticipants((current) => [...current.filter((item) => item.peer_id !== remote.peer_id), { ...current.find((item) => item.peer_id === remote.peer_id), ...remote }])
          if (message.type === 'participant_joined') {
            // Existing participants call the newcomer; the newcomer only answers.
            createPeer(remote.peer_id, true)
            setPeerStates((current) => ({ ...current, [remote.peer_id]: 'connecting' }))
            await sendOffer(remote.peer_id)
            send({ type: 'media_state', ...mediaStateRef.current })
          }
        } else if (message.type === 'roster_request' && message.requester !== peerIdRef.current) {
          send({ type: 'roster_response', target: message.requester })
        } else if (message.type === 'participant_left') {
          removePeer(message.peer_id)
          setParticipants((current) => current.filter((item) => item.peer_id !== message.peer_id))
        } else if (message.type === 'signal' && message.target === peerIdRef.current) {
          await handleSignal(message)
        } else if (message.type === 'media_state' && message.peer_id !== peerIdRef.current) {
          setParticipants((current) => current.map((person) => (
            person.peer_id === message.peer_id
              ? { ...person, microphone_enabled: message.microphone, camera_enabled: message.camera, screen: message.screen }
              : person
          )))
        } else if (message.type === 'raise_hand') {
          setParticipants((current) => current.map((item) => (
            item.peer_id === message.peer_id ? { ...item, hand_up: message.up } : item
          )))
        } else if (message.type === 'moderate') {
          if (message.target === peerIdRef.current && message.control === 'microphone') {
            setForcedMicOff(!message.enabled)
            localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = message.enabled })
            setMicEnabled(message.enabled)
          } else if (message.target === peerIdRef.current && message.control === 'camera') {
            setForcedCameraOff(!message.enabled)
            localStreamRef.current?.getVideoTracks().forEach((track) => { track.enabled = message.enabled })
            setCameraEnabled(message.enabled)
          }
        } else if (message.type === 'chat') {
          setChatMessages((current) => [...current.slice(-99), { ...message, id: `${Date.now()}-${Math.random()}` }])
        } else if (message.type === 'whiteboard') {
          if (message.peer_id !== peerIdRef.current) setBoardStrokes((current) => [...current, message.stroke])
        } else if (message.type === 'whiteboard_clear') {
          setBoardStrokes([])
        } else if (message.type === 'poll_started' || message.type === 'poll_results') {
          setPoll(message.poll)
          if (message.type === 'poll_started') setVoted(false)
        } else if (message.type === 'session_ended') {
          setRoomEnded(true)
          setConnectionStatus('Session terminée')
        }
      }

      const connectSocket = () => {
        let socket
        try {
          const socketUrl = new URL(`/ws/live-classrooms/${classroom.id}/`, window.location.origin)
          socketUrl.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
          socketUrl.searchParams.set('token', joinInfo.token)
          socket = new WebSocket(socketUrl.toString())
        } catch (error) {
          console.error('Could not create the live classroom WebSocket:', error)
          setConnectionStatus('Erreur de connexion')
          setMediaError('Impossible de se connecter à la classe en direct. Rechargez la page et réessayez.')
          return
        }
        socketRef.current = socket
        socket.onmessage = handleMessage
        socket.onopen = () => {
          reconnectAttempts = 0
          setConnectionStatus('Connecté')
        }
        socket.onerror = () => setConnectionStatus('Erreur de connexion')
        socket.onclose = (event) => {
          if (disposed || socketRef.current !== socket) return
          if (event.code === 4401) {
            setConnectionStatus('Accès refusé')
            return
          }
          // Mobile networks drop sockets often: rebuild the room with a fresh peer id.
          Array.from(peers.keys()).forEach(removePeer)
          setParticipants([])
          if (reconnectAttempts >= 8) {
            setConnectionStatus('Déconnecté')
            setMediaError('La connexion à la classe est perdue. Vérifiez votre réseau puis rechargez la page.')
            return
          }
          reconnectAttempts += 1
          setConnectionStatus('Reconnexion…')
          reconnectTimer = window.setTimeout(connectSocket, Math.min(1000 * 2 ** reconnectAttempts, 15000))
        }
      }
      connectSocket()

      try {
        const params = role === 'teacher' ? { teacher_id: participantId } : { student_id: participantId }
        const response = await axios.get(`${baseUrl}/live-classrooms/${classroom.id}/polls/`, { params })
        const currentPoll = response.data.find((item) => item.is_active)
        if (currentPoll && !disposed) setPoll(currentPoll)
      } catch (error) {
        console.error('Could not load live polls:', error.response?.data || error)
      }
    }

    startRoom()
    return () => {
      disposed = true
      window.clearTimeout(reconnectTimer)
      socketRef.current?.close()
      Array.from(peers.keys()).forEach(removePeer)
      stopStream(localStreamRef.current)
      stopStream(screenStreamRef.current)
    }
  }, [classroom.id, joinInfo.token, joinInfo.ice_servers, participantId, role])

  const toggleMicrophone = async () => {
    if (forcedMicOff) return
    const audioTrack = localStreamRef.current?.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !micEnabled
      setMicEnabled(!micEnabled)
      return
    }
    try {
      const track = await requestSingleTrack('audio')
      if (!localStreamRef.current) localStreamRef.current = new MediaStream()
      localStreamRef.current.addTrack(track)
      await replaceOutgoingTrack('audio', track)
      setMicAvailable(true)
      setMicEnabled(true)
      setMediaError('')
    } catch (error) {
      setMediaError(getDeviceErrorMessage(error, 'micro'))
    }
  }

  const toggleCamera = async () => {
    if (forcedCameraOff) return
    const cameraTrack = localStreamRef.current?.getVideoTracks()[0]
    if (cameraTrack) {
      cameraTrack.enabled = !cameraEnabled
      setCameraEnabled(!cameraEnabled)
      return
    }
    try {
      const track = await requestSingleTrack('video')
      if (!localStreamRef.current) localStreamRef.current = new MediaStream()
      localStreamRef.current.addTrack(track)
      if (!screenStreamRef.current) await replaceOutgoingTrack('video', track)
      setCameraAvailable(true)
      setCameraEnabled(true)
      setMediaError('')
      refreshLocalPreview()
    } catch (error) {
      setCameraEnabled(false)
      setMediaError(getDeviceErrorMessage(error, 'caméra'))
    }
  }

  const switchDevice = async (kind, deviceId) => {
    try {
      const track = await requestSingleTrack(kind, deviceId)
      if (!localStreamRef.current) localStreamRef.current = new MediaStream()
      const stream = localStreamRef.current
      const previous = kind === 'video' ? stream.getVideoTracks() : stream.getAudioTracks()
      previous.forEach((item) => { stream.removeTrack(item); item.stop() })
      track.enabled = kind === 'video' ? cameraEnabled || !previous.length : micEnabled || !previous.length
      stream.addTrack(track)
      if (kind === 'audio' || !screenStreamRef.current) await replaceOutgoingTrack(kind, track)
      if (kind === 'video') {
        setCameraAvailable(true)
        setCameraEnabled(track.enabled)
        refreshLocalPreview()
      } else {
        setMicAvailable(true)
        setMicEnabled(track.enabled)
      }
      setMediaError('')
    } catch (error) {
      setMediaError(getDeviceErrorMessage(error, kind === 'video' ? 'caméra' : 'micro'))
    }
  }

  const openSettings = async () => {
    setSettingsOpen((value) => !value)
    try {
      setDevices(await listMediaDevices())
    } catch {
      setDevices({ cameras: [], microphones: [] })
    }
  }

  const stopScreenShare = async () => {
    const screenStream = screenStreamRef.current
    if (!screenStream) return
    screenStreamRef.current = null
    await replaceOutgoingTrack('video', localStreamRef.current?.getVideoTracks()[0] || null)
    stopStream(screenStream)
    setSharingScreen(false)
  }

  const toggleScreenShare = async () => {
    if (screenStreamRef.current) {
      await stopScreenShare()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15, max: 30 } }, audio: false })
      const screenTrack = stream.getVideoTracks()[0]
      if (!screenTrack) throw new Error('Aucun écran n’a été sélectionné.')
      screenTrack.contentHint = 'detail'
      screenStreamRef.current = stream
      await replaceOutgoingTrack('video', screenTrack)
      screenTrack.onended = () => { stopScreenShare() }
      setSharingScreen(true)
    } catch (error) {
      if (screenStreamRef.current) await stopScreenShare()
      if (error?.name !== 'NotAllowedError') setMediaError(error.message || 'Le partage d’écran n’a pas pu démarrer.')
    }
  }

  const unlockAudio = () => {
    remoteVideoRefs.current.forEach((element) => {
      element?.play().catch(() => {})
    })
    setAutoplayBlocked(false)
  }

  const toggleVideoFullscreen = async (event) => {
    event.stopPropagation()
    const tile = event.currentTarget.closest('.live-video-tile')
    if (!tile) return
    try {
      if (document.fullscreenElement === tile) await document.exitFullscreen()
      else await tile.requestFullscreen()
    } catch {
      setMediaError('Le plein écran n’est pas disponible dans ce navigateur.')
    }
  }

  const toggleHand = () => {
    const nextValue = !handRaised
    setHandRaised(nextValue)
    sendMessage({ type: 'raise_hand', up: nextValue })
  }

  const moderateParticipant = (target, control, enabled) => {
    sendMessage({ type: 'moderate', target, control, enabled })
  }

  const submitChat = (event) => {
    event.preventDefault()
    if (!draftMessage.trim()) return
    sendMessage({ type: 'chat', text: draftMessage.trim() })
    setDraftMessage('')
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
      setMediaError(error.response?.data?.detail || 'Le sondage n’a pas pu être lancé.')
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
      setMediaError(error.response?.data?.detail || 'Votre réponse n’a pas été enregistrée.')
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

  const toggleVideoSize = (videoId) => {
    setExpandedVideo((current) => (current === videoId ? null : videoId))
  }

  const handleVideoKeyDown = (event, videoId) => {
    if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return
    event.preventDefault()
    toggleVideoSize(videoId)
  }

  const remoteParticipants = participants.filter((person) => person.peer_id !== peerId)
  const canModerate = role === 'teacher'
  const localCameraVisible = sharingScreen || (cameraAvailable && cameraEnabled)

  return (
    <main className="live-room-page">
      <header className="live-room-header">
        <div className="live-room-title-block">
          <span className="live-room-live-mark"><i className="bi bi-broadcast" aria-hidden="true" />{roomEnded ? 'TERMINÉE' : 'EN DIRECT'}</span>
          <h1>{classroom.title}</h1>
          <span className="live-room-course">{classroom.course_title}</span>
        </div>
        <div className="live-room-header-actions">
          <span className="live-room-connection"><span />{connectionStatus}</span>
          <span className="live-room-count" aria-label={`${participants.length} participant${participants.length === 1 ? '' : 's'} dans la classe`} title="Participants dans la classe"><i className="bi bi-people-fill" aria-hidden="true" />{participants.length}</span>
          {canModerate && onEnd ? (
            <button className="btn btn-outline-danger btn-sm" onClick={onEnd} type="button">Terminer la classe</button>
          ) : null}
          <button className="btn btn-dark btn-sm" onClick={onLeave} type="button">Quitter</button>
        </div>
      </header>

      {autoplayBlocked && (
        <button className="live-room-unlock" onClick={unlockAudio} type="button">
          <i className="bi bi-volume-up-fill" aria-hidden="true" /> Cliquez ici pour activer le son et la vidéo des participants
        </button>
      )}

      {(mediaError || roomEnded) && (
        <div className={`live-room-notice ${roomEnded ? 'is-ended' : ''}`} role="status">
          {roomEnded ? 'Le formateur a terminé cette session.' : mediaError}
          {!roomEnded && <button type="button" onClick={() => setMediaError('')} aria-label="Fermer le message">×</button>}
        </div>
      )}

      <div className="live-room-layout">
        <section className="live-room-main-column">
          <div className="live-video-grid">
            <article
              className={`live-video-tile is-local ${sharingScreen ? 'is-sharing-screen' : ''} ${expandedVideo === 'local' ? 'is-expanded' : ''}`}
              data-video-id="local"
              onClick={(event) => {
                if (!event.target.closest('button')) toggleVideoSize('local')
              }}
              onKeyDown={(event) => handleVideoKeyDown(event, 'local')}
              role="button"
              tabIndex={0}
              aria-label={`${expandedVideo === 'local' ? 'Réduire' : 'Agrandir'} votre vidéo`}
            >
              <video autoPlay muted playsInline ref={localVideoRef} />
              {!localCameraVisible && <div className="live-video-placeholder"><i className="bi bi-person-video3" aria-hidden="true" /><span>{cameraAvailable ? 'Caméra désactivée' : 'Caméra indisponible — appuyez sur « Caméra » pour réessayer'}</span></div>}
              {sharingScreen && (
                <button
                  aria-label={fullscreenVideoId === 'local' ? 'Quitter le plein écran' : 'Afficher le partage en plein écran'}
                  aria-pressed={fullscreenVideoId === 'local'}
                  className="live-video-fullscreen"
                  onClick={toggleVideoFullscreen}
                  title={fullscreenVideoId === 'local' ? 'Quitter le plein écran' : 'Plein écran'}
                  type="button"
                >
                  <i className={`bi ${fullscreenVideoId === 'local' ? 'bi-fullscreen-exit' : 'bi-fullscreen'}`} aria-hidden="true" />
                  <span>{fullscreenVideoId === 'local' ? 'Quitter' : 'Plein écran'}</span>
                </button>
              )}
              <div className="live-video-label"><span>{joinInfo.display_name} · Vous</span><i className={`bi ${micAvailable && micEnabled ? 'bi-mic-fill' : 'bi-mic-mute-fill'}`} aria-label={micAvailable && micEnabled ? 'Micro activé' : 'Micro coupé'} /></div>
            </article>
            {remoteParticipants.map((person) => {
              const state = peerStates[person.peer_id]
              const hasStream = Boolean(remoteStreams[person.peer_id])
              const showVideo = hasStream && remoteVideoLive[person.peer_id] !== false && person.camera_enabled !== false
              return (
                <article
                  className={`live-video-tile ${expandedVideo === person.peer_id ? 'is-expanded' : ''}`}
                  data-video-id={person.peer_id}
                  key={person.peer_id}
                  onClick={(event) => {
                    if (!event.target.closest('button')) toggleVideoSize(person.peer_id)
                  }}
                  onKeyDown={(event) => handleVideoKeyDown(event, person.peer_id)}
                  role="button"
                  tabIndex={0}
                  aria-label={`${expandedVideo === person.peer_id ? 'Réduire' : 'Agrandir'} la vidéo de ${person.display_name}`}
                >
                  <video
                    autoPlay
                    playsInline
                    ref={(element) => {
                      if (element) {
                        remoteVideoRefs.current.set(person.peer_id, element)
                        const stream = remoteStreams[person.peer_id] || null
                        if (element.srcObject !== stream) {
                          element.srcObject = stream
                          playRemote(element)
                        }
                      } else {
                        remoteVideoRefs.current.delete(person.peer_id)
                      }
                    }}
                  />
                  {!showVideo && (
                    <div className="live-video-placeholder">
                      <span className="live-video-avatar" aria-hidden="true">{(person.display_name || '?').trim().charAt(0).toUpperCase()}</span>
                      <span>{peerStateLabels[state] || (person.camera_enabled === false ? 'Caméra désactivée' : person.display_name)}</span>
                      {state === 'failed' && <small>Le réseau bloque la connexion. Demandez au participant de recharger la page.</small>}
                    </div>
                  )}
                  <div className="live-video-label">
                    <span>{person.display_name}{person.hand_up ? ' · ✋ Main levée' : ''}</span>
                    <i className={`bi ${person.microphone_enabled === false ? 'bi-mic-mute-fill' : 'bi-mic-fill'}`} aria-label={person.microphone_enabled === false ? 'Micro coupé' : 'Micro ouvert'} />
                    <span className="live-video-role">{person.role === 'teacher' ? 'FORMATEUR' : 'APPRENANT'}</span>
                  </div>
                  <button
                    aria-label={fullscreenVideoId === person.peer_id ? `Quitter le plein écran de ${person.display_name}` : `Afficher ${person.display_name} en plein écran`}
                    aria-pressed={fullscreenVideoId === person.peer_id}
                    className="live-video-fullscreen"
                    onClick={toggleVideoFullscreen}
                    title={fullscreenVideoId === person.peer_id ? 'Quitter le plein écran' : 'Plein écran'}
                    type="button"
                  >
                    <i className={`bi ${fullscreenVideoId === person.peer_id ? 'bi-fullscreen-exit' : 'bi-fullscreen'}`} aria-hidden="true" />
                    <span>{fullscreenVideoId === person.peer_id ? 'Quitter' : 'Plein écran'}</span>
                  </button>
                  {canModerate && (
                    <div className="live-video-moderation">
                      <button aria-label={`${person.microphone_enabled === false ? 'Autoriser' : 'Couper'} le micro de ${person.display_name}`} onClick={() => moderateParticipant(person.peer_id, 'microphone', person.microphone_enabled === false)} title={person.microphone_enabled === false ? 'Autoriser le micro' : 'Couper le micro'} type="button"><i className={`bi ${person.microphone_enabled === false ? 'bi-mic-fill' : 'bi-mic-mute'}`} /></button>
                      <button aria-label={`${person.camera_enabled === false ? 'Autoriser' : 'Désactiver'} la caméra de ${person.display_name}`} onClick={() => moderateParticipant(person.peer_id, 'camera', person.camera_enabled === false)} title={person.camera_enabled === false ? 'Autoriser la caméra' : 'Désactiver la caméra'} type="button"><i className={`bi ${person.camera_enabled === false ? 'bi-camera-video' : 'bi-camera-video-off'}`} /></button>
                    </div>
                  )}
                </article>
              )
            })}
            {remoteParticipants.length === 0 && (
              <div className="live-video-waiting">
                <i className="bi bi-hourglass-split" aria-hidden="true" />
                <span>{canModerate ? 'En attente des apprenants…' : 'En attente du formateur…'}</span>
              </div>
            )}
          </div>

          <div className="live-room-toolbar" aria-label="Commandes de la classe">
            <button className={!(micAvailable && micEnabled) ? 'is-muted' : ''} disabled={forcedMicOff} onClick={toggleMicrophone} title={micEnabled ? 'Couper le micro' : 'Activer le micro'} type="button">
              <i className={`bi ${micAvailable && micEnabled ? 'bi-mic-fill' : 'bi-mic-mute-fill'}`} aria-hidden="true" /><span>{forcedMicOff ? 'Micro bloqué' : 'Micro'}</span>
            </button>
            <button className={!(cameraAvailable && cameraEnabled) ? 'is-muted' : ''} disabled={forcedCameraOff} onClick={toggleCamera} title={cameraEnabled ? 'Désactiver la caméra' : 'Activer la caméra'} type="button">
              <i className={`bi ${cameraAvailable && cameraEnabled ? 'bi-camera-video-fill' : 'bi-camera-video-off-fill'}`} aria-hidden="true" /><span>{forcedCameraOff ? 'Caméra bloquée' : 'Caméra'}</span>
            </button>
            {canShareScreen && (
              <button className={sharingScreen ? 'is-active' : ''} onClick={toggleScreenShare} title={sharingScreen ? 'Arrêter le partage' : 'Partager l’écran'} type="button">
                <i className="bi bi-display" aria-hidden="true" /><span>{sharingScreen ? 'Arrêter le partage' : 'Partager'}</span>
              </button>
            )}
            {role === 'student' && (
              <button className={handRaised ? 'is-active' : ''} onClick={toggleHand} title={handRaised ? 'Baisser la main' : 'Lever la main'} type="button">
                <i className="bi bi-hand-index-thumb" aria-hidden="true" /><span>{handRaised ? 'Baisser la main' : 'Lever la main'}</span>
              </button>
            )}
            <button className={settingsOpen ? 'is-active' : ''} onClick={openSettings} title="Choisir la caméra et le micro" type="button" aria-expanded={settingsOpen}>
              <i className="bi bi-gear-fill" aria-hidden="true" /><span>Réglages</span>
            </button>
          </div>

          {settingsOpen && (
            <section className="live-settings" aria-label="Réglages audio et vidéo">
              <label>
                <span>Caméra</span>
                <select onChange={(event) => switchDevice('video', event.target.value)} value={localStreamRef.current?.getVideoTracks()[0]?.getSettings?.().deviceId || ''}>
                  <option value="" disabled>Choisir une caméra</option>
                  {devices.cameras.map((device) => <option key={device.id || device.label} value={device.id}>{device.label}</option>)}
                </select>
              </label>
              <label>
                <span>Micro</span>
                <select onChange={(event) => switchDevice('audio', event.target.value)} value={localStreamRef.current?.getAudioTracks()[0]?.getSettings?.().deviceId || ''}>
                  <option value="" disabled>Choisir un micro</option>
                  {devices.microphones.map((device) => <option key={device.id || device.label} value={device.id}>{device.label}</option>)}
                </select>
              </label>
              <p>Si un participant ne vous voit pas, vérifiez que la caméra n’est pas utilisée par une autre application.</p>
            </section>
          )}

          <section className="live-whiteboard" aria-labelledby="live-whiteboard-title">
            <div className="live-panel-heading">
              <div><span className="live-class-eyebrow">COLLABORATION</span><h2 id="live-whiteboard-title">Tableau blanc</h2></div>
              <div className="live-board-tools">
                {['#00a99d', '#e55c50', '#29354b', '#e5ad39'].map((color) => (
                  <button
                    aria-label={`Choisir la couleur ${color}`}
                    className={`live-color-swatch ${strokeColor === color ? 'is-selected' : ''}`}
                    key={color}
                    onClick={() => setStrokeColor(color)}
                    style={{ '--swatch-color': color }}
                    type="button"
                  />
                ))}
                {canModerate && <button className="btn btn-outline-secondary btn-sm" onClick={clearBoard} type="button">Effacer</button>}
              </div>
            </div>
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
          </section>
        </section>

        <aside className="live-room-sidebar">
          <section className="live-side-panel live-chat-panel">
            <div className="live-panel-heading"><div><span className="live-class-eyebrow">EN DIRECT</span><h2>Discussion</h2></div><i className="bi bi-chat-left-text" aria-hidden="true" /></div>
            <div className="live-chat-messages" aria-live="polite">
              {chatMessages.length === 0 && <p className="live-panel-empty">Les messages de la classe apparaîtront ici.</p>}
              {chatMessages.map((message) => <p className="live-chat-message" key={message.id}><strong>{message.display_name}</strong><span>{message.text}</span></p>)}
            </div>
            <form className="live-chat-form" onSubmit={submitChat}>
              <input aria-label="Votre message" maxLength="500" onChange={(event) => setDraftMessage(event.target.value)} placeholder="Écrire un message…" value={draftMessage} />
              <button aria-label="Envoyer le message" disabled={!draftMessage.trim()} title="Envoyer" type="submit"><i className="bi bi-send-fill" /></button>
            </form>
          </section>

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
        </aside>
      </div>
    </main>
  )
}

export default LiveRoom
