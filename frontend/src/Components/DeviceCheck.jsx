import React, { useCallback, useEffect, useRef, useState } from 'react'
import { acquireMedia, getDeviceErrorMessage, listMediaDevices, stopStream, watchAudioLevel } from './liveMedia'

/** Pre-join screen: preview the camera, test the microphone and pick devices. */
const DeviceCheck = ({ classroom, busy, onCancel, onJoin }) => {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const handedOverRef = useRef(false)
  const [devices, setDevices] = useState({ cameras: [], microphones: [] })
  const [cameraId, setCameraId] = useState('')
  const [microphoneId, setMicrophoneId] = useState('')
  const [cameraOn, setCameraOn] = useState(true)
  const [microphoneOn, setMicrophoneOn] = useState(true)
  const [level, setLevel] = useState(0)
  const [errors, setErrors] = useState({ video: '', audio: '' })
  const [loading, setLoading] = useState(true)
  const [hasVideo, setHasVideo] = useState(false)
  const [hasAudio, setHasAudio] = useState(false)

  const start = useCallback(async (videoDeviceId, audioDeviceId) => {
    setLoading(true)
    stopStream(streamRef.current)
    const result = await acquireMedia({ videoDeviceId, audioDeviceId })
    streamRef.current = result.stream
    setHasVideo(result.stream.getVideoTracks().length > 0)
    setHasAudio(result.stream.getAudioTracks().length > 0)
    setErrors({
      video: result.videoError ? getDeviceErrorMessage(result.videoError, 'caméra') : '',
      audio: result.audioError ? getDeviceErrorMessage(result.audioError, 'micro') : '',
    })
    if (videoRef.current) {
      videoRef.current.srcObject = result.stream
      videoRef.current.play().catch(() => {})
    }
    try {
      const found = await listMediaDevices()
      setDevices(found)
      const videoTrack = result.stream.getVideoTracks()[0]
      const audioTrack = result.stream.getAudioTracks()[0]
      if (videoTrack?.getSettings) setCameraId(videoTrack.getSettings().deviceId || '')
      if (audioTrack?.getSettings) setMicrophoneId(audioTrack.getSettings().deviceId || '')
    } catch {
      setDevices({ cameras: [], microphones: [] })
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    start('', '')
    return () => {
      if (!handedOverRef.current) stopStream(streamRef.current)
    }
  }, [start])

  useEffect(() => {
    if (!hasAudio) return undefined
    return watchAudioLevel(streamRef.current, setLevel)
  }, [hasAudio, microphoneId])

  useEffect(() => {
    streamRef.current?.getVideoTracks().forEach((track) => { track.enabled = cameraOn })
  }, [cameraOn, hasVideo])

  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = microphoneOn })
  }, [microphoneOn, hasAudio])

  const join = () => {
    handedOverRef.current = true
    onJoin(streamRef.current)
  }

  return (
    <div className="live-check-backdrop" role="presentation">
      <section className="live-check" role="dialog" aria-modal="true" aria-labelledby="live-check-title">
        <header>
          <div>
            <p className="live-class-eyebrow">AVANT D’ENTRER</p>
            <h2 id="live-check-title">Testez votre caméra et votre micro</h2>
            <p>{classroom.title}</p>
          </div>
          <button className="btn-close" type="button" onClick={onCancel} aria-label="Fermer" disabled={busy} />
        </header>
        <div className="live-check-body">
          <div className="live-check-preview">
            <video autoPlay muted playsInline ref={videoRef} />
            {(!hasVideo || !cameraOn) && (
              <div className="live-video-placeholder">
                <i className="bi bi-camera-video-off" aria-hidden="true" />
                <span>{loading ? 'Activation de la caméra…' : hasVideo ? 'Caméra désactivée' : 'Caméra indisponible'}</span>
              </div>
            )}
          </div>
          <div className="live-check-controls">
            <div className="live-check-toggles">
              <button className={cameraOn && hasVideo ? 'is-on' : ''} disabled={!hasVideo} onClick={() => setCameraOn((value) => !value)} type="button" aria-pressed={cameraOn}>
                <i className={`bi ${cameraOn && hasVideo ? 'bi-camera-video-fill' : 'bi-camera-video-off-fill'}`} aria-hidden="true" />{cameraOn && hasVideo ? 'Caméra activée' : 'Caméra coupée'}
              </button>
              <button className={microphoneOn && hasAudio ? 'is-on' : ''} disabled={!hasAudio} onClick={() => setMicrophoneOn((value) => !value)} type="button" aria-pressed={microphoneOn}>
                <i className={`bi ${microphoneOn && hasAudio ? 'bi-mic-fill' : 'bi-mic-mute-fill'}`} aria-hidden="true" />{microphoneOn && hasAudio ? 'Micro activé' : 'Micro coupé'}
              </button>
            </div>
            <label>
              <span>Caméra</span>
              <select value={cameraId} disabled={loading || !devices.cameras.length} onChange={(event) => { setCameraId(event.target.value); start(event.target.value, microphoneId) }}>
                {!devices.cameras.length && <option value="">Aucune caméra détectée</option>}
                {devices.cameras.map((device) => <option key={device.id || device.label} value={device.id}>{device.label}</option>)}
              </select>
            </label>
            <label>
              <span>Micro</span>
              <select value={microphoneId} disabled={loading || !devices.microphones.length} onChange={(event) => { setMicrophoneId(event.target.value); start(cameraId, event.target.value) }}>
                {!devices.microphones.length && <option value="">Aucun micro détecté</option>}
                {devices.microphones.map((device) => <option key={device.id || device.label} value={device.id}>{device.label}</option>)}
              </select>
            </label>
            <div className="live-check-meter" aria-label={`Niveau du micro : ${level} %`}>
              <span>Parlez pour tester le micro</span>
              <div><i style={{ width: `${hasAudio && microphoneOn ? level : 0}%` }} /></div>
            </div>
            {errors.video && <p className="live-check-error" role="alert"><i className="bi bi-camera-video-off" aria-hidden="true" /> {errors.video}</p>}
            {errors.audio && <p className="live-check-error" role="alert"><i className="bi bi-mic-mute" aria-hidden="true" /> {errors.audio}</p>}
            {(errors.video || errors.audio) && (
              <button className="btn btn-outline-secondary btn-sm" type="button" disabled={loading} onClick={() => start(cameraId, microphoneId)}>
                <i className="bi bi-arrow-clockwise me-1" aria-hidden="true" />Réessayer
              </button>
            )}
          </div>
        </div>
        <footer>
          <span className="live-check-tip"><i className="bi bi-lightbulb" aria-hidden="true" /> Astuce : utilisez des écouteurs pour éviter l’écho.</span>
          <div>
            <button className="btn btn-outline-secondary" type="button" onClick={onCancel} disabled={busy}>Annuler</button>
            <button className="btn btn-success" type="button" onClick={join} disabled={busy || loading}>
              <i className="bi bi-box-arrow-in-right me-1" aria-hidden="true" />{busy ? 'Connexion…' : 'Entrer dans la classe'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}

export default DeviceCheck
