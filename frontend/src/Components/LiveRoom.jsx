import React, { useEffect, useRef, useState } from 'react'
import axios from 'axios'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'
const rtcConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

const getDeviceErrorMessage = (error, device) => {
  if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
    return `L’accès au ${device} est refusé par le navigateur. Vérifiez les autorisations du site puis réessayez.`
  }
  if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
    return `Aucun ${device} n’a été détecté sur cet appareil.`
  }
  if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') {
    return `Le ${device} est déjà utilisé par une autre application. Fermez-la puis réessayez.`
  }
  if (error?.name === 'SecurityError' || error?.name === 'TypeError') {
    return `L’accès au ${device} nécessite une connexion HTTPS sécurisée.`
  }
  return `Impossible d’activer le ${device}. Vérifiez les autorisations et réessayez.`
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

const WHITEBOARD_CHUNK_SIZE = 100

const LiveRoom = ({ classroom, joinInfo, role, participantId, onLeave, onEnd }) => {
  const socketRef = useRef(null)
  const localStreamRef = useRef(null)
  const screenStreamRef = useRef(null)
  const screenShareTrackRef = useRef(null)
  const screenCompositeStreamRef = useRef(null)
  const screenCompositeFrameRef = useRef(null)
  const screenSourceVideoRef = useRef(null)
  const cameraSourceVideoRef = useRef(null)
  const peerConnectionsRef = useRef(new Map())
  const pendingCandidatesRef = useRef(new Map())
  const canvasRef = useRef(null)
  const drawingRef = useRef(null)
  const peerIdRef = useRef('')
  const localVideoRef = useRef(null)
  const localVideoTileRef = useRef(null)
  const remoteVideoRefs = useRef(new Map())
  const cameraPictureInPictureRef = useRef(null)
  const [peerId, setPeerId] = useState('')
  const [participants, setParticipants] = useState([])
  const [remoteStreams, setRemoteStreams] = useState({})
  const [boardStrokes, setBoardStrokes] = useState([])
  const [chatMessages, setChatMessages] = useState([])
  const [draftMessage, setDraftMessage] = useState('')
  const [poll, setPoll] = useState(null)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState('Oui\nNon')
  const [voted, setVoted] = useState(false)
  const [handRaised, setHandRaised] = useState(false)
  const [micEnabled, setMicEnabled] = useState(true)
  const [cameraEnabled, setCameraEnabled] = useState(true)
  const [cameraAvailable, setCameraAvailable] = useState(false)
  const [forcedMicOff, setForcedMicOff] = useState(false)
  const [forcedCameraOff, setForcedCameraOff] = useState(false)
  const [sharingScreen, setSharingScreen] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('Connexion…')
  const [mediaError, setMediaError] = useState('')
  const [roomEnded, setRoomEnded] = useState(false)
  const [strokeColor, setStrokeColor] = useState('#00a99d')
  const [expandedVideo, setExpandedVideo] = useState(null)
  const [presentationFullscreen, setPresentationFullscreen] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    context.clearRect(0, 0, canvas.width, canvas.height)
    boardStrokes.forEach((stroke) => drawStroke(canvas, stroke))
  }, [boardStrokes])

  useEffect(() => {
    const video = localVideoRef.current
    if (!video) return
    const stream = screenStreamRef.current || localStreamRef.current
    video.srcObject = stream
    if (stream) {
      video.play().catch((error) => {
        console.error('Could not play the local camera preview:', error)
        setMediaError('La caméra est activée, mais son aperçu ne peut pas démarrer. Rechargez la classe ou vérifiez les autorisations du navigateur.')
      })
    }
  }, [cameraAvailable, sharingScreen, peerId])

  useEffect(() => {
    remoteVideoRefs.current.forEach((element, remotePeerId) => {
      if (element) element.srcObject = remoteStreams[remotePeerId] || null
    })
  }, [remoteStreams, participants])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setPresentationFullscreen(document.fullscreenElement === localVideoTileRef.current)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    let disposed = false
    const peerConnections = peerConnectionsRef.current
    const startRoom = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraEnabled(false)
        setMediaError('La caméra et le micro nécessitent une connexion sécurisée (HTTPS) et un navigateur compatible.')
      } else {
        localStreamRef.current = new MediaStream()
        const [videoResult, audioResult] = await Promise.allSettled([
          navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }),
          navigator.mediaDevices.getUserMedia({ audio: true, video: false }),
        ])

        if (disposed) {
          for (const result of [videoResult, audioResult]) {
            if (result.status === 'fulfilled') result.value.getTracks().forEach((track) => track.stop())
          }
          return
        }

        if (videoResult.status === 'fulfilled') {
          videoResult.value.getVideoTracks().forEach((track) => localStreamRef.current.addTrack(track))
          if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current
          setCameraAvailable(true)
          setCameraEnabled(true)
        } else {
          setCameraEnabled(false)
          setMediaError(getDeviceErrorMessage(videoResult.reason, 'caméra'))
        }

        if (audioResult.status === 'fulfilled') {
          audioResult.value.getAudioTracks().forEach((track) => localStreamRef.current.addTrack(track))
          setMicEnabled(true)
        } else {
          setMicEnabled(false)
          if (videoResult.status === 'fulfilled') {
            setMediaError(getDeviceErrorMessage(audioResult.reason, 'micro'))
          }
        }
      }

      if (disposed) return
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
      socket.onopen = () => setConnectionStatus('Connecté')
      socket.onclose = (event) => {
        setConnectionStatus(event.code === 4401 ? 'Accès refusé' : 'Déconnecté')
      }
      socket.onerror = () => setConnectionStatus('Erreur de connexion')

      const send = (message) => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
      }

      const createPeerConnection = (remotePeerId) => {
        if (peerConnectionsRef.current.has(remotePeerId)) {
          return peerConnectionsRef.current.get(remotePeerId)
        }
        const connection = new RTCPeerConnection(rtcConfiguration)
        const audioTracks = localStreamRef.current?.getAudioTracks() || []
        const videoTrack = screenShareTrackRef.current || screenStreamRef.current?.getVideoTracks()[0]
          || localStreamRef.current?.getVideoTracks()[0]
        const mediaStream = localStreamRef.current || new MediaStream()
        audioTracks.forEach((track) => connection.addTrack(track, mediaStream))
        if (videoTrack) connection.addTrack(videoTrack, mediaStream)
        else connection.addTransceiver('video', { direction: 'sendrecv' })
        connection.onicecandidate = (event) => {
          if (event.candidate) send({ type: 'signal', target: remotePeerId, signal: { candidate: event.candidate } })
        }
        connection.ontrack = (event) => {
          const stream = event.streams[0] || new MediaStream([event.track])
          if (stream) setRemoteStreams((current) => ({ ...current, [remotePeerId]: stream }))
        }
        connection.onconnectionstatechange = () => {
          if (['failed', 'closed', 'disconnected'].includes(connection.connectionState)) {
            setRemoteStreams((current) => {
              const next = { ...current }
              delete next[remotePeerId]
              return next
            })
          }
        }
        peerConnectionsRef.current.set(remotePeerId, connection)
        pendingCandidatesRef.current.set(remotePeerId, [])
        return connection
      }

      const handleSignal = async (message) => {
        const connection = createPeerConnection(message.from)
        const signal = message.signal
        try {
          if (signal.type === 'offer') {
            await connection.setRemoteDescription(new RTCSessionDescription(signal))
            const pending = pendingCandidatesRef.current.get(message.from) || []
            for (const candidate of pending) await connection.addIceCandidate(candidate)
            pendingCandidatesRef.current.set(message.from, [])
            const answer = await connection.createAnswer()
            await connection.setLocalDescription(answer)
            send({ type: 'signal', target: message.from, signal: connection.localDescription })
          } else if (signal.type === 'answer') {
            await connection.setRemoteDescription(new RTCSessionDescription(signal))
            const pending = pendingCandidatesRef.current.get(message.from) || []
            for (const candidate of pending) await connection.addIceCandidate(candidate)
            pendingCandidatesRef.current.set(message.from, [])
          } else if (signal.candidate) {
            const candidate = new RTCIceCandidate(signal.candidate)
            if (connection.remoteDescription) await connection.addIceCandidate(candidate)
            else pendingCandidatesRef.current.get(message.from)?.push(candidate)
          }
        } catch (error) {
          console.error('WebRTC signaling failed:', error)
        }
      }

      socket.onmessage = async (event) => {
        const message = JSON.parse(event.data)
        if (message.type === 'joined') {
          peerIdRef.current = message.peer_id
          setPeerId(message.peer_id)
          setParticipants((current) => [...current.filter((item) => item.peer_id !== message.peer_id), message])
          send({ type: 'roster_request' })
        } else if (
          (message.type === 'participant_joined' || message.type === 'roster_response')
          && message.participant.peer_id !== peerIdRef.current
        ) {
          const remote = message.participant
          setParticipants((current) => [...current.filter((item) => item.peer_id !== remote.peer_id), remote])
          if (message.type === 'participant_joined') {
            const connection = createPeerConnection(remote.peer_id)
            try {
              const offer = await connection.createOffer()
              await connection.setLocalDescription(offer)
              send({ type: 'signal', target: remote.peer_id, signal: connection.localDescription })
            } catch (error) {
              console.error('Could not offer a peer connection:', error)
            }
          }
        } else if (message.type === 'roster_request' && message.requester !== peerIdRef.current) {
          send({ type: 'roster_response', target: message.requester })
        } else if (message.type === 'participant_left') {
          peerConnectionsRef.current.get(message.peer_id)?.close()
          peerConnectionsRef.current.delete(message.peer_id)
          pendingCandidatesRef.current.delete(message.peer_id)
          setParticipants((current) => current.filter((item) => item.peer_id !== message.peer_id))
          setRemoteStreams((current) => {
            const next = { ...current }
            delete next[message.peer_id]
            return next
          })
        } else if (message.type === 'signal' && message.target === peerIdRef.current) {
          await handleSignal(message)
        } else if (message.type === 'raise_hand') {
          setParticipants((current) => current.map((item) => (
            item.peer_id === message.peer_id ? { ...item, hand_up: message.up } : item
          )))
        } else if (message.type === 'moderate') {
          setParticipants((current) => current.map((person) => (
            person.peer_id === message.target
              ? { ...person, [message.control === 'microphone' ? 'microphone_enabled' : 'camera_enabled']: message.enabled }
              : person
          )))
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
          setVoted(false)
        } else if (message.type === 'session_ended') {
          setRoomEnded(true)
          setConnectionStatus('Session terminée')
        }
      }

      try {
        const params = role === 'teacher' ? { teacher_id: participantId } : { student_id: participantId }
        const response = await axios.get(`${baseUrl}/live-classrooms/${classroom.id}/polls/`, { params })
        const currentPoll = response.data.find((item) => item.is_active)
        if (currentPoll) setPoll(currentPoll)
      } catch (error) {
        console.error('Could not load live polls:', error.response?.data || error)
      }
    }

    startRoom()
    return () => {
      disposed = true
      socketRef.current?.close()
      peerConnections.forEach((connection) => connection.close())
      peerConnections.clear()
      localStreamRef.current?.getTracks().forEach((track) => track.stop())
      screenStreamRef.current?.getTracks().forEach((track) => track.stop())
      screenCompositeStreamRef.current?.getTracks().forEach((track) => track.stop())
      if (screenCompositeFrameRef.current) cancelAnimationFrame(screenCompositeFrameRef.current)
      if (screenSourceVideoRef.current) screenSourceVideoRef.current.srcObject = null
      if (cameraSourceVideoRef.current) cameraSourceVideoRef.current.srcObject = null
    }
  }, [classroom.id, joinInfo.token, participantId, role])

  const sendMessage = (message) => {
    const socket = socketRef.current
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
  }

  const toggleMicrophone = () => {
    if (forcedMicOff) return
    const nextValue = !micEnabled
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = nextValue })
    setMicEnabled(nextValue)
  }

  const toggleCamera = () => {
    if (forcedCameraOff || !navigator.mediaDevices?.getUserMedia) return
    const cameraTrack = localStreamRef.current?.getVideoTracks()[0]
    if (cameraTrack) {
      const nextValue = !cameraEnabled
      cameraTrack.enabled = nextValue
      setCameraEnabled(nextValue)
      return
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then(async (stream) => {
        const newCameraTrack = stream.getVideoTracks()[0]
        if (!newCameraTrack) {
          stream.getTracks().forEach((track) => track.stop())
          setMediaError('Aucune caméra vidéo n’a été détectée sur cet appareil.')
          return
        }
        if (!localStreamRef.current) localStreamRef.current = new MediaStream()
        localStreamRef.current.addTrack(newCameraTrack)
        if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current
        for (const connection of peerConnectionsRef.current.values()) {
          const videoSender = connection.getSenders().find((sender) => sender.track?.kind === 'video')
            || connection.getTransceivers().find((transceiver) => transceiver.receiver.track.kind === 'video')?.sender
          if (videoSender) await videoSender.replaceTrack(newCameraTrack)
        }
        setCameraAvailable(true)
        setCameraEnabled(true)
        setMediaError('')
      })
      .catch((error) => {
        setCameraEnabled(false)
        setMediaError(getDeviceErrorMessage(error, 'caméra'))
      })
  }

  const stopScreenShare = async () => {
    const screenStream = screenStreamRef.current
    if (!screenStream) return
    screenStreamRef.current = null
    screenShareTrackRef.current = null
    const cameraTrack = localStreamRef.current?.getVideoTracks()[0] || null
    for (const connection of peerConnectionsRef.current.values()) {
      const sender = connection.getSenders().find((item) => item.track?.kind === 'video')
      if (sender) await sender.replaceTrack(cameraTrack)
    }
    if (screenCompositeFrameRef.current) cancelAnimationFrame(screenCompositeFrameRef.current)
    screenCompositeFrameRef.current = null
    screenCompositeStreamRef.current?.getTracks().forEach((track) => track.stop())
    screenCompositeStreamRef.current = null
    if (screenSourceVideoRef.current) {
      screenSourceVideoRef.current.pause()
      screenSourceVideoRef.current.srcObject = null
      screenSourceVideoRef.current = null
    }
    if (cameraSourceVideoRef.current) {
      cameraSourceVideoRef.current.pause()
      cameraSourceVideoRef.current.srcObject = null
      cameraSourceVideoRef.current = null
    }
    screenStream.getTracks().forEach((track) => track.stop())
    if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current
    setSharingScreen(false)
  }

  const toggleScreenShare = async () => {
    if (screenStreamRef.current) {
      await stopScreenShare()
      return
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      const screenTrack = stream.getVideoTracks()[0]
      if (!screenTrack) throw new Error('Aucun écran n’a été sélectionné.')
      screenStreamRef.current = stream

      const screenVideo = document.createElement('video')
      screenVideo.muted = true
      screenVideo.playsInline = true
      screenSourceVideoRef.current = screenVideo
      const metadataReady = new Promise((resolve) => screenVideo.addEventListener('loadedmetadata', resolve, { once: true }))
      screenVideo.srcObject = stream
      await screenVideo.play()
      await metadataReady

      const cameraTrack = localStreamRef.current?.getVideoTracks()[0]
      const cameraVideo = document.createElement('video')
      cameraVideo.muted = true
      cameraVideo.playsInline = true
      cameraSourceVideoRef.current = cameraVideo
      if (cameraTrack) {
        cameraVideo.srcObject = new MediaStream([cameraTrack])
        await cameraVideo.play().catch(() => {})
      }

      const canvas = document.createElement('canvas')
      canvas.width = screenVideo.videoWidth || 1280
      canvas.height = screenVideo.videoHeight || 720
      const context = canvas.getContext('2d')
      if (!context || !canvas.captureStream) throw new Error('La composition vidéo n’est pas disponible dans ce navigateur.')

      const drawCompositeFrame = () => {
        const width = screenVideo.videoWidth || canvas.width
        const height = screenVideo.videoHeight || canvas.height
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width
          canvas.height = height
        }
        if (screenVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          context.drawImage(screenVideo, 0, 0, canvas.width, canvas.height)
          if (cameraTrack?.enabled && cameraVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            const diameter = Math.min(canvas.width * 0.2, canvas.height * 0.34)
            const margin = Math.max(20, canvas.width * 0.035)
            const x = canvas.width - diameter - margin
            const y = canvas.height - diameter - margin
            context.save()
            context.beginPath()
            context.arc(x + diameter / 2, y + diameter / 2, diameter / 2, 0, Math.PI * 2)
            context.clip()
            context.drawImage(cameraVideo, x, y, diameter, diameter)
            context.restore()
            context.beginPath()
            context.arc(x + diameter / 2, y + diameter / 2, diameter / 2, 0, Math.PI * 2)
            context.lineWidth = Math.max(4, canvas.width * 0.004)
            context.strokeStyle = '#ffffff'
            context.stroke()
          }
        }
        screenCompositeFrameRef.current = requestAnimationFrame(drawCompositeFrame)
      }

      const compositeStream = canvas.captureStream(30)
      const compositeTrack = compositeStream.getVideoTracks()[0]
      screenShareTrackRef.current = compositeTrack
      screenCompositeStreamRef.current = compositeStream
      drawCompositeFrame()

      for (const connection of peerConnectionsRef.current.values()) {
        const sender = connection.getSenders().find((item) => item.track?.kind === 'video')
        if (sender) await sender.replaceTrack(compositeTrack)
      }
      screenTrack.onended = () => { stopScreenShare() }
      setSharingScreen(true)
    } catch (error) {
      if (screenStreamRef.current) await stopScreenShare()
      setMediaError(error.message || 'Le partage d’écran n’a pas pu démarrer.')
      console.error('Screen sharing was not started:', error)
    }
  }

  const togglePresentationFullscreen = async (event) => {
    event.stopPropagation()
    const tile = localVideoTileRef.current
    if (!tile) return
    try {
      if (document.fullscreenElement === tile) await document.exitFullscreen()
      else await tile.requestFullscreen()
    } catch (error) {
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
    setParticipants((current) => current.map((person) => (
      person.peer_id === target
        ? { ...person, [control === 'microphone' ? 'microphone_enabled' : 'camera_enabled']: enabled }
        : person
    )))
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
    setExpandedVideo((current) => current === videoId ? null : videoId)
  }

  const handleVideoKeyDown = (event, videoId) => {
    if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return
    event.preventDefault()
    toggleVideoSize(videoId)
  }

  const remoteParticipants = participants.filter((person) => person.peer_id !== peerId)
  const canModerate = role === 'teacher'

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

      {(mediaError || roomEnded) && (
        <div className={`live-room-notice ${roomEnded ? 'is-ended' : ''}`} role="status">
          {roomEnded ? 'Le formateur a terminé cette session.' : mediaError}
        </div>
      )}

      <div className="live-room-layout">
        <section className="live-room-main-column">
          <div className="live-video-grid">
            <article
              className={`live-video-tile is-local ${sharingScreen ? 'is-sharing-screen' : ''} ${expandedVideo === 'local' ? 'is-expanded' : ''}`}
              ref={localVideoTileRef}
              onClick={(event) => {
                if (!event.target.closest('button')) toggleVideoSize('local')
              }}
              onKeyDown={(event) => handleVideoKeyDown(event, 'local')}
              role="button"
              tabIndex={0}
              aria-label={`${expandedVideo === 'local' ? 'Réduire' : 'Agrandir'} votre vidéo`}
            >
              <video autoPlay muted playsInline ref={localVideoRef} />
              {!sharingScreen && (!cameraAvailable || !cameraEnabled) && <div className="live-video-placeholder"><i className="bi bi-person-video3" aria-hidden="true" /><span>{cameraAvailable ? 'Caméra désactivée' : 'Caméra indisponible — appuyez sur Caméra pour réessayer'}</span></div>}
              {sharingScreen && cameraAvailable && cameraEnabled && (
                <video
                  autoPlay
                  className="live-camera-picture-in-picture"
                  muted
                  playsInline
                  ref={(element) => {
                    cameraPictureInPictureRef.current = element
                    if (element && localStreamRef.current && element.srcObject !== localStreamRef.current) {
                      element.srcObject = localStreamRef.current
                      element.play().catch(() => {})
                    }
                  }}
                />
              )}
              {sharingScreen && (
                <button
                  aria-label={presentationFullscreen ? 'Quitter le plein écran' : 'Afficher le partage en plein écran'}
                  aria-pressed={presentationFullscreen}
                  className="live-video-fullscreen"
                  onClick={togglePresentationFullscreen}
                  title={presentationFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
                  type="button"
                >
                  <i className={`bi ${presentationFullscreen ? 'bi-fullscreen-exit' : 'bi-fullscreen'}`} aria-hidden="true" />
                  <span>{presentationFullscreen ? 'Quitter' : 'Plein écran'}</span>
                </button>
              )}
              <div className="live-video-label"><span>{joinInfo.display_name} · Vous</span><i className={`bi ${micEnabled ? 'bi-mic-fill' : 'bi-mic-mute-fill'}`} aria-label={micEnabled ? 'Micro activé' : 'Micro coupé'} /></div>
            </article>
            {remoteParticipants.map((person) => (
              <article
                className={`live-video-tile ${expandedVideo === person.peer_id ? 'is-expanded' : ''}`}
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
                      element.srcObject = remoteStreams[person.peer_id] || null
                    } else {
                      remoteVideoRefs.current.delete(person.peer_id)
                    }
                  }}
                />
                {!remoteStreams[person.peer_id] && <div className="live-video-placeholder"><i className="bi bi-person-circle" aria-hidden="true" /><span>{person.display_name}</span></div>}
                <div className="live-video-label">
                  <span>{person.display_name}{person.hand_up ? ' · Main levée' : ''}</span>
                  <i className={`bi ${person.microphone_enabled === false ? 'bi-mic-mute-fill' : 'bi-mic-fill'}`} aria-label={person.microphone_enabled === false ? 'Micro coupé' : 'Micro ouvert'} />
                  <span className="live-video-role">{person.role === 'teacher' ? 'ENSEIGNANT' : 'ÉTUDIANT'}</span>
                </div>
                {canModerate && (
                  <div className="live-video-moderation">
                    <button aria-label={`${person.microphone_enabled === false ? 'Activer' : 'Couper'} le micro de ${person.display_name}`} onClick={() => moderateParticipant(person.peer_id, 'microphone', person.microphone_enabled === false)} title={person.microphone_enabled === false ? 'Activer le micro' : 'Couper le micro'} type="button"><i className={`bi ${person.microphone_enabled === false ? 'bi-mic-fill' : 'bi-mic-mute'}`} /></button>
                    <button aria-label={`${person.camera_enabled === false ? 'Activer' : 'Désactiver'} la caméra de ${person.display_name}`} onClick={() => moderateParticipant(person.peer_id, 'camera', person.camera_enabled === false)} title={person.camera_enabled === false ? 'Activer la caméra' : 'Désactiver la caméra'} type="button"><i className={`bi ${person.camera_enabled === false ? 'bi-camera-video' : 'bi-camera-video-off'}`} /></button>
                  </div>
                )}
              </article>
            ))}
          </div>

          <div className="live-room-toolbar" aria-label="Commandes de la classe">
            <button className={!micEnabled ? 'is-muted' : ''} disabled={forcedMicOff} onClick={toggleMicrophone} title={micEnabled ? 'Couper le micro' : 'Activer le micro'} type="button">
              <i className={`bi ${micEnabled ? 'bi-mic-fill' : 'bi-mic-mute-fill'}`} aria-hidden="true" /><span>Micro</span>
            </button>
            <button className={!cameraEnabled ? 'is-muted' : ''} disabled={forcedCameraOff} onClick={toggleCamera} title={cameraEnabled ? 'Désactiver la caméra' : 'Activer la caméra'} type="button">
              <i className={`bi ${cameraEnabled ? 'bi-camera-video-fill' : 'bi-camera-video-off-fill'}`} aria-hidden="true" /><span>Caméra</span>
            </button>
            <button className={sharingScreen ? 'is-active' : ''} onClick={toggleScreenShare} title={sharingScreen ? 'Arrêter le partage' : 'Partager l’écran'} type="button">
              <i className="bi bi-display" aria-hidden="true" /><span>{sharingScreen ? 'Arrêter le partage' : 'Partager'}</span>
            </button>
            {role === 'student' && (
              <button className={handRaised ? 'is-active' : ''} onClick={toggleHand} title={handRaised ? 'Baisser la main' : 'Lever la main'} type="button">
                <i className="bi bi-hand-index-thumb" aria-hidden="true" /><span>{handRaised ? 'Baisser la main' : 'Lever la main'}</span>
              </button>
            )}
          </div>

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