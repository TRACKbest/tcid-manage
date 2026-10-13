import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import TeacherSidebar from './TeacherSidebar'
import { useEffect } from 'react'
import { useState } from 'react'
import { useRef } from 'react'
import axios from 'axios'
import Message from '../Message'
import './img.css'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const MyUsers = () => {

    const teacherId=localStorage.getItem('teacherId')
    const location = useLocation()
    const handledNotificationRef = useRef('')

    useEffect(()=>{
        document.title='TCiD Center | Étudiants inscrits'
      })

      const [studentData, setStudentData]=useState([]);
    const [pageErrorMsg, setPageErrorMsg]=useState('')
      const [isLoading, setIsLoading]=useState(true)
            const [approvalMessage, setApprovalMessage]=useState('')
            const pendingCount = studentData.filter(row => row.status === 'pending').length

      useEffect(()=>{
        if (!teacherId) {
        setPageErrorMsg('Connectez-vous comme enseignant pour afficher vos étudiants.')
            setIsLoading(false)
            return
        }
        axios.get(`${baseUrl}/fetch-all-enrolled-students/${teacherId}`)
            .then((response)=>setStudentData(response.data))
            .catch((error)=>{
                console.error('Could not load enrolled students:', error.response?.data || error)
                setPageErrorMsg('Impossible de charger les étudiants inscrits. Vérifiez que le serveur Django est démarré.')
            })
            .finally(()=>setIsLoading(false))
      },[teacherId]);

      useEffect(() => {
        if (!studentData.length || handledNotificationRef.current === location.search) return
        const params = new URLSearchParams(location.search)
        const requestId = params.get('request_id')
        const messageStudentId = params.get('student_id')
        const targetRow = studentData.find(row =>
            (requestId && String(row.id) === requestId) ||
            (!requestId && messageStudentId && String(row.student.id) === messageStudentId)
        )
        if (!targetRow) return

        handledNotificationRef.current = location.search
        document.getElementById(`enrollment-row-${targetRow.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        if (requestId) {
            document.getElementById(`approve-enrollment-${targetRow.id}`)?.focus()
        } else {
            document.getElementById(`open-chat-${targetRow.student.id}`)?.click()
        }
      }, [location.search, studentData])

      const [msgData,setMsgData]=useState({
        msg_to:''
      });

      const [successMsg,setsuccessMsg]=useState('')
      const [errorMsg,seterrorMsg]=useState('')

      const handleChange=(event)=>{
        setMsgData({
            ...msgData,
            [event.target.name]:event.target.value
        });
      }

    const formSubmit=async (student_id)=>{
        const _formData=new FormData()
        _formData.append('msg_to',msgData.msg_to);
        _formData.append('msg_from','teacher');

        try {
            const response = await axios.post(`${baseUrl}/send-message/${teacherId}/${student_id}`,_formData)
            if (response.data.bool === true) {
                    setMsgData({
                        'msg_to':''
                    })
                    setsuccessMsg(response.data.msg)
                    seterrorMsg('')
                } else {
                    setsuccessMsg('')
                    seterrorMsg(response.data.msg)
                }
        } catch (error) {
            console.error('Could not send message:', error.response?.data || error)
            seterrorMsg('Impossible d’envoyer le message.')
        }
      };

      const approveStudent = async (enrollmentId) => {
        try {
            await axios.post(`${baseUrl}/teacher/${teacherId}/enrollment/${enrollmentId}/approve/`)
            setStudentData(currentRows => currentRows.map(row =>
                row.id === enrollmentId ? { ...row, status: 'approved' } : row
            ))
            setPageErrorMsg('')
            setApprovalMessage('Demande approuvée. L’étudiant peut maintenant accéder aux documents du cours.')
        } catch (error) {
            console.error('Could not approve enrollment:', error.response?.data || error)
            setPageErrorMsg('Impossible d’approuver cette demande.')
        }
      }

      const approveAllStudents = async () => {
        try {
            const response = await axios.post(`${baseUrl}/teacher/${teacherId}/enrollment/approve-all/`)
            setStudentData(currentRows => currentRows.map(row =>
                row.status === 'pending' ? { ...row, status: 'approved' } : row
            ))
            setPageErrorMsg('')
            setApprovalMessage(`${response.data.approved_count} demande(s) approuvée(s).`)
        } catch (error) {
            console.error('Could not approve enrollments:', error.response?.data || error)
            setPageErrorMsg('Impossible d’approuver les demandes.')
        }
      }

      const msgList={
        height:'500px',
        overflow:'hidden'
      }

      

  return (
    <>
    
    <div className='container mt-4'>
        <div className='row'>
            <aside className='col-md-3'>
                <TeacherSidebar />
            </aside>
            <section className='col-md-9'>
                <div className='card'>
                    <h5 className='card-header'><i class="bi bi-people-fill"> </i>Demandes et étudiants inscrits
                    {pendingCount > 0 && <button type="button" className="btn btn-success btn-sm float-end" onClick={approveAllStudents}><i className="bi bi-check2-all" aria-hidden="true"></i> Approuver tout ({pendingCount})</button>}
                    <Link to="/groups" className="btn btn-primary btn-sm float-end">
                        <i className="bi bi-chat-square-text" aria-hidden="true"></i> Mes groupes
                    </Link>
                    </h5>
                    <div className='card-body' class="table-responsive">
                        {pageErrorMsg && <div className="alert alert-danger" role="alert">{pageErrorMsg}</div>}
                        {approvalMessage && <div className="alert alert-success" role="status">{approvalMessage}</div>}
                        {isLoading && <p role="status">Chargement des étudiants…</p>}
                        <table className='table table-striped table-hover'>
                            <thead>
                                <tr>
                                    <th className='text-center'>Profil</th>
                                    <th className='text-center'>Étudiant</th>
                                    <th className='text-center'>Cours suivi</th>
                                    <th className='text-center'>Statut</th>
                                    <th className='text-center'>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!isLoading && !pageErrorMsg && studentData.length === 0 && <tr><td colSpan="5" className="text-center">Aucune demande ni inscription pour le moment.</td></tr>}
                                {studentData.map((row,index) => 
                                    <tr id={`enrollment-row-${row.id}`} key={`${row.course.id}-${row.student.id}`}>
                                    <td className='text-center'>
                                        <img className='imgmeet' src={row.student.profile_img || '/img/default-profile.png'} alt={row.student.fullname || 'Profil étudiant'} />
                                    </td>
                                    <td className='text-center'>{row.student.username}</td>
                                    <td className='text-center'>{row.course.title}</td>
                                    <td className='text-center'>
                                        {row.status === 'pending' && <span className="badge bg-warning text-dark">En attente</span>}
                                        {row.status === 'approved' && <span className="badge bg-success">Approuvé</span>}
                                    </td>
                                    <td className='text-center'>
                                        {row.status === 'pending' ? <button id={`approve-enrollment-${row.id}`} type="button" className="btn btn-sm btn-success mb-2 me-2" onClick={() => approveStudent(row.id)}><i className="bi bi-check-lg" aria-hidden="true"></i> Approuver</button> : <>
                                        <Link to={`/show-assignment/${row.student.id}/${teacherId}`} className='btn btn-sm btn-warning mb-2 me-2 text-white'>Voir les devoirs</Link>
                                        <Link to={`/add-assignment/${row.student.id}/${teacherId}`} className='btn btn-sm btn-info mb-2 me-2 text-dark'>Ajouter un devoir</Link>
                                        <button id={`open-chat-${row.student.id}`} type="button" aria-label={`Discuter avec ${row.student.fullname}`} title="Ouvrir la conversation" data-bs-toggle="modal" data-bs-target={`#msgModal${index}`} className='btn btn-sm btn-success mb-2'><i className="bi bi-chat-dots" aria-hidden="true"></i></button>

                                                <div className="modal fade" id={`msgModal${index}`} tabindex="-1" aria-labelledby="exampleModalLabel" aria-hidden="true">
                                                <div className="modal-dialog  modal-fullscreen">
                                                    <div className="modal-content">
                                                    <div className="modal-header">
                                                        <div className="modal-title chat-contact" id="exampleModalLabel">
                                                            {row.student.profile_img ? <img className="chat-contact-avatar" src={row.student.profile_img} alt="" /> : <span className="chat-contact-avatar chat-contact-avatar--fallback" aria-hidden="true">{row.student.fullname?.charAt(0)}</span>}
                                                            <div><h5 className="mb-0">{row.student.fullname}</h5><small className="text-muted">Étudiant</small></div>
                                                        </div>
                                                        <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                                                    </div>

                                                    <div className="modal-body">
                                                        <div className='row'>
                                                            <div className='col-md-8 mb-2 col-12 border-end' style={msgList}>
                                                                <Message teacher_id={teacherId} student_id={row.student.id}/>
                                                            </div>
                                                            <div className='col-md-4 col-12'>
                                                                {successMsg && <p className='text-success'>{successMsg}</p>}
                                                                {errorMsg && <p className='text-danger'>{errorMsg}</p>}
                                                            <form className="chat-composer" onSubmit={(event)=>{event.preventDefault(); formSubmit(row.student.id)}}>
                                                                <div className="mb-3">
                                                                    <label for={`message-${row.student.id}`} className="form-label">Message</label>
                                                                    <textarea id={`message-${row.student.id}`} className='form-control' value={msgData.msg_to} name='msg_to' rows="2" placeholder="Écrire un message..." onChange={handleChange}></textarea>
                                                                </div>
                                                                <button type="submit" className="btn btn-success chat-send-button" aria-label="Envoyer le message" title="Envoyer le message"><i className="bi bi-send-fill" aria-hidden="true"></i><span>Envoyer</span></button>
                                                            </form>
                                                            </div>
                                                        </div>   
                                                    </div>
                                                    </div>
                                                </div>
                                                </div>
                                            </>}
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
    </>
  )
}

export default MyUsers
