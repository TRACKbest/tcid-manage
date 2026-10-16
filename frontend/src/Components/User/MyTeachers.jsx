import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useEffect } from 'react'
import { useState } from 'react'
import { useRef } from 'react'
import axios from 'axios'
import MessageStudent from './MessageStudent'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const MyTeachers = () => {

    const studentId=localStorage.getItem('studentId')
    const location = useLocation()
    const handledNotificationRef = useRef('')
    const [teacherData,setteacherData]=useState([])
    const [isLoading,setIsLoading]=useState(true)
    const [loadError,setLoadError]=useState('')

    useEffect(()=>{
        if (!studentId) {
            setteacherData([])
            setLoadError('Connectez-vous comme apprenant pour afficher vos formateurs.')
            setIsLoading(false)
            return
        }
        let cancelled = false
        setIsLoading(true)
        axios.get(`${baseUrl}/fetch-my-teachers/${studentId}`)
            .then((response)=>{
                const teachers = new Map()
                response.data.forEach(course => {
                    const teacher = course.teacher
                    if (!teacher?.id) return
                    if (!teachers.has(teacher.id)) teachers.set(teacher.id, { teacher, courses: [] })
                    teachers.get(teacher.id).courses.push(course)
                })
                if (!cancelled) {
                    setteacherData(Array.from(teachers.values()))
                    setLoadError('')
                }
            })
            .catch((error)=>{
                console.error('Could not load teachers:', error.response?.data || error)
                if (!cancelled) setLoadError('Impossible de charger vos formateurs et formations suivies.')
            })
            .finally(()=>{
                if (!cancelled) setIsLoading(false)
            })
        return () => { cancelled = true }
      },[studentId]);

    useEffect(() => {
        if (!teacherData.length || handledNotificationRef.current === location.search) return
        const teacherId = new URLSearchParams(location.search).get('teacher_id')
        if (!teacherId) return
        const teacher = teacherData.find(row => String(row.teacher.id) === teacherId)?.teacher
        if (!teacher) return
        handledNotificationRef.current = location.search
        document.getElementById(`open-teacher-chat-${teacher.id}`)?.click()
    }, [location.search, teacherData])

      const [successMsg,setsuccessMsg]=useState('')
      const [errorMsg,seterrorMsg]=useState('')

      const [msgData,setMsgData]=useState({
        msg_to:''
      });

      const handleChange=(event)=>{
        setMsgData({
            ...msgData,
            [event.target.name]:event.target.value
        });
      }

      const formSubmit=async (teacher_id)=>{
        if (!msgData.msg_to.trim()) return
        const _formData=new FormData()
        _formData.append('msg_to',msgData.msg_to);
        _formData.append('msg_from','student');

        try{
            const response = await axios.post(`${baseUrl}/send-message/${teacher_id}/${studentId}`,_formData)
            if(response.data.bool === true){
                setMsgData({ msg_to: '' })
                setsuccessMsg(response.data.msg)
                seterrorMsg('')
            }else{
                setsuccessMsg('')
                seterrorMsg(response.data.msg)
            }
        }catch(error){
            console.error('Could not send message:', error.response?.data || error)
            setsuccessMsg('')
            seterrorMsg('Impossible d’envoyer le message.')
        }
      };

    useEffect(()=>{
        document.title='TCiD Center | Mes formateurs'
      })

      const msgList={
        height:'500px',
        overflow:'hidden'
      }

  return (
    <div className='container mt-4'>
        <div className='row'>
            <aside className='col-md-3'>
                <Sidebar />
            </aside>
            <section className='col-md-9'>
                <div className='card'>
                    <h5 className='card-header'><i class="bi bi-person-check-fill"/> Mes formateurs</h5>
                    <div className='card-body  table-responsive'>
                        <table className='table table-striped table-hover'>
                            <thead>
                                    <tr>
                                    <th className='text-center'>Profil</th>
                                    <th className='text-center'>Formateur</th>
                                    <th className='text-center'>Formations suivies</th>
                                    <th className='text-center'>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                            {isLoading && <tr><td colSpan="4" className="text-center" role="status">Chargement de vos formateurs…</td></tr>}
                            {!isLoading && loadError && <tr><td colSpan="4"><div className="alert alert-danger mb-0" role="alert">{loadError}</div></td></tr>}
                            {!isLoading && !loadError && teacherData.length === 0 && <tr><td colSpan="4" className="text-center">Aucun formateur pour le moment. Les formateurs apparaîtront ici après approbation de l’accès à une formation.</td></tr>}
                            {teacherData.map((row) =>
                                <tr key={row.teacher.id}>
                                    <td className='text-center'><Link to={`/teacher-detail/${row.teacher.id}`}><img className='imgmeet' src={row.teacher.profile_img || '/img/default-profile.png'} alt={row.teacher.full_name}/></Link></td>
                                    <td className='text-center'><Link to={`/teacher-detail/${row.teacher.id}`}>{row.teacher.full_name}</Link></td>
                                    <td className='text-center'>
                                        <div className="d-flex flex-column gap-1">
                                            {row.courses.map(course => <Link key={course.id} to={`/detail/${course.id}`}>{course.title}</Link>)}
                                        </div>
                                    </td>
                                    <td className='text-center'>
                                    <button id={`open-teacher-chat-${row.teacher.id}`} type="button" aria-label={`Ouvrir la conversation avec ${row.teacher.full_name}`} title={`Envoyer un message à ${row.teacher.full_name}`} data-bs-toggle="modal" data-bs-target={`#teacher-chat-modal-${row.teacher.id}`} className='btn btn-sm btn-success mb-2'><i className="bi bi-chat-dots" aria-hidden="true"></i></button>

<div className="modal fade" id={`teacher-chat-modal-${row.teacher.id}`} tabIndex="-1" aria-labelledby={`teacher-chat-title-${row.teacher.id}`} aria-hidden="true">
<div className="modal-dialog  modal-fullscreen">
    <div className="modal-content">
    <div className="modal-header">
        <div className="modal-title chat-contact" id={`teacher-chat-title-${row.teacher.id}`}>
            {row.teacher.profile_img ? <img className="chat-contact-avatar" src={row.teacher.profile_img} alt="" /> : <span className="chat-contact-avatar chat-contact-avatar--fallback" aria-hidden="true">{row.teacher.full_name?.charAt(0)}</span>}
            <div><h5 className="mb-0">{row.teacher.full_name}</h5><small className="text-muted">Formateur</small></div>
        </div>
        <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Fermer"></button>
    </div>

    <div className="modal-body">
        <div className='row'>
            <div className='col-md-8 mb-2 col-12 border-end' style={msgList}>
                <MessageStudent teacher_id={row.teacher.id} student_id={studentId}/>
            </div>
            <div className='col-md-4 col-12'>
                {successMsg && <p className='text-success' role="status">{successMsg}</p>}
                {errorMsg && <p className='text-danger' role="alert">{errorMsg}</p>}
            <form className="chat-composer" onSubmit={(event)=>{event.preventDefault(); formSubmit(row.teacher.id)}}>
                <div className="mb-3">
                    <label htmlFor={`message-${row.teacher.id}`} className="form-label">Message</label>
                    <textarea id={`message-${row.teacher.id}`} className='form-control' value={msgData.msg_to} name='msg_to' rows="2" placeholder="Écrire un message..." onChange={handleChange}></textarea>
                </div>
                <button type="submit" disabled={!msgData.msg_to.trim()} className="btn btn-success chat-send-button" aria-label="Envoyer le message" title="Envoyer le message">
                    <i className="bi bi-send-fill" aria-hidden="true"></i><span>Envoyer</span>
                </button>
            </form>
            </div>
        </div>   
    </div>
    </div>
</div>
</div>
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </div>
    </div>
  )
}

export default MyTeachers
