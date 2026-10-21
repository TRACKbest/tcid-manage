export const DEFAULT_ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
]

export const getDeviceErrorMessage = (error, device) => {
  const name = error?.name
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return `L’accès au ${device} est bloqué. Cliquez sur le cadenas 🔒 à gauche de l’adresse du site, autorisez le ${device}, puis réessayez.`
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
    return `Aucun ${device} utilisable n’a été détecté sur cet appareil.`
  }
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
    return `Le ${device} est déjà utilisé par une autre application (Zoom, Teams, WhatsApp, autre onglet…). Fermez-la puis réessayez.`
  }
  if (name === 'SecurityError' || name === 'TypeError') {
    return `L’accès au ${device} nécessite une connexion sécurisée (https://).`
  }
  return `Impossible d’activer le ${device}. Vérifiez les autorisations et réessayez.`
}

export const videoConstraints = (deviceId) => (deviceId
  ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } }
  : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } })

export const audioConstraints = (deviceId) => ({
  ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
})

const requestTrack = async (kind, deviceId) => {
  const constraints = kind === 'video'
    ? { video: videoConstraints(deviceId), audio: false }
    : { audio: audioConstraints(deviceId), video: false }
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    return stream.getTracks()[0]
  } catch (error) {
    // Some laptops/phones reject resolution or device constraints: retry with the plainest request.
    if (['OverconstrainedError', 'NotReadableError', 'AbortError', 'NotFoundError'].includes(error?.name)) {
      const stream = await navigator.mediaDevices.getUserMedia(kind === 'video' ? { video: true } : { audio: true })
      return stream.getTracks()[0]
    }
    throw error
  }
}

/**
 * Acquire camera + microphone in a single request (required on iOS Safari and
 * several Android browsers, where two parallel requests stop each other), then
 * fall back to one device at a time so that a missing camera never blocks the mic.
 */
export const acquireMedia = async ({ videoDeviceId = '', audioDeviceId = '', video = true, audio = true } = {}) => {
  const result = { stream: new MediaStream(), videoError: null, audioError: null }
  if (!navigator.mediaDevices?.getUserMedia) {
    const error = { name: 'SecurityError' }
    return { ...result, videoError: video ? error : null, audioError: audio ? error : null }
  }
  if (video && audio) {
    try {
      const combined = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints(videoDeviceId),
        audio: audioConstraints(audioDeviceId),
      })
      combined.getTracks().forEach((track) => result.stream.addTrack(track))
      return result
    } catch {
      // Fall through to sequential requests to find out which device fails.
    }
  }
  if (video) {
    try {
      result.stream.addTrack(await requestTrack('video', videoDeviceId))
    } catch (error) {
      result.videoError = error
    }
  }
  if (audio) {
    try {
      result.stream.addTrack(await requestTrack('audio', audioDeviceId))
    } catch (error) {
      result.audioError = error
    }
  }
  return result
}

export const requestSingleTrack = requestTrack

export const listMediaDevices = async () => {
  if (!navigator.mediaDevices?.enumerateDevices) return { cameras: [], microphones: [] }
  const devices = await navigator.mediaDevices.enumerateDevices()
  const label = (device, index, fallback) => device.label || `${fallback} ${index + 1}`
  const cameras = devices.filter((device) => device.kind === 'videoinput')
  const microphones = devices.filter((device) => device.kind === 'audioinput')
  return {
    cameras: cameras.map((device, index) => ({ id: device.deviceId, label: label(device, index, 'Caméra') })),
    microphones: microphones.map((device, index) => ({ id: device.deviceId, label: label(device, index, 'Micro') })),
  }
}

export const stopStream = (stream) => {
  stream?.getTracks().forEach((track) => track.stop())
}

/** Calls ``onLevel`` with the microphone level (0–100) until the returned cleanup runs. */
export const watchAudioLevel = (stream, onLevel) => {
  const track = stream?.getAudioTracks()[0]
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!track || !AudioContextClass) return () => {}
  const context = new AudioContextClass()
  const analyser = context.createAnalyser()
  analyser.fftSize = 256
  const source = context.createMediaStreamSource(new MediaStream([track]))
  source.connect(analyser)
  const samples = new Uint8Array(analyser.frequencyBinCount)
  let frame = 0
  const tick = () => {
    analyser.getByteFrequencyData(samples)
    const average = samples.reduce((sum, value) => sum + value, 0) / samples.length
    onLevel(Math.min(100, Math.round(average * 1.6)))
    frame = window.requestAnimationFrame(tick)
  }
  tick()
  return () => {
    window.cancelAnimationFrame(frame)
    source.disconnect()
    context.close().catch(() => {})
  }
}
