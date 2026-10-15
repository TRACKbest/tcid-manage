import React from 'react'
import { Link } from 'react-router-dom'
import TeacherSidebar from './TeacherSidebar'
import { useEffect } from 'react'
import { useState } from 'react'
import axios from 'axios'
import Swal from 'sweetalert2'
import './course.css'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const TeacherMyCourses = () => {
    useEffect(()=>{
        document.title='TCiD Center | Mes formations'
      })

      const [courseData, setCourseData]=useState([]);
      const teacherId=localStorage.getItem('teacherId');
      const [errorMsg, setErrorMsg]=useState('')
      const [isLoading, setIsLoading]=useState(true)

      useEffect(()=>{
        if (!teacherId) {
            setErrorMsg('Connectez-vous comme formateur pour afficher vos formations.')
            setIsLoading(false)
            return
        }
        axios.get(`${baseUrl}/teacher-course/${teacherId}`)
            .then((response)=>setCourseData(response.data))
            .catch((error)=>{
                console.error('Could not load teacher courses:', error.response?.data || error)
                setErrorMsg('Impossible de charger vos formations. Vérifiez que le serveur Django est démarré.')
            })
            .finally(()=>setIsLoading(false))
      },[teacherId]);

      const handleDeleteClick = async (course_id) =>{
        const result = await Swal.fire({
            title: 'Confirmer la suppression',
            text: 'Voulez-vous vraiment supprimer cette formation ?',
            icon: 'info',
            confirmButtonText: 'Supprimer',
            cancelButtonText: 'Annuler',
            showCancelButton:true
        })
        if (!result.isConfirmed) return

        try {
            await axios.delete(`${baseUrl}/teacher-course-detail/${course_id}`)
            setCourseData(currentCourses => currentCourses.filter(course => course.id !== course_id))
            Swal.fire('Formation supprimée', 'La formation a été supprimée avec succès.', 'success')
        } catch (error) {
            console.error('Could not delete course:', error.response?.data || error)
            Swal.fire('Échec de la suppression', 'La formation n’a pas pu être supprimée.', 'error')
        }
    }
    useEffect(() => {
        window.scrollTo(0, 0)
      }, [])
  return (
    <div className='container mt-4'>
        <div className='row'>
            <aside className='col-md-3'>
                <TeacherSidebar />
            </aside>
            <section className='col-md-9'>
                <div className='card'>
                    <h5 className='card-header'><i class="bi bi-journals"></i> Mes formations</h5>
                    <div className='card-body' class="table-responsive">
                        {errorMsg && <div className="alert alert-danger" role="alert">{errorMsg}</div>}
                        {isLoading && <p role="status">Chargement des formations…</p>}
                        <table className='table table-striped table-hover'>
                            <thead>
                                <tr>
                                    <th className='text-center'>Nom</th>
                                    <th className='text-center'>Image</th>
                                    <th className='text-center'>Inscriptions</th>
                                    <th className='text-center'>Évaluations et actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!isLoading && !errorMsg && courseData.length === 0 && <tr><td colSpan="4" className="text-center">Vous n’avez pas encore créé de formation.</td></tr>}
                                {courseData.map((course,index) => 
                                    <tr key={course.id}>
                                    <td className='text-center'>
                                        <Link to={`/all-chapters/` +course.id}>{course.title}</Link>
                                        <hr />
                                        <i class="bi bi-star-fill text-warning"></i>&nbsp;
                                        {course.course_rating && 
                                            <span>Note : {course.course_rating}/5</span>
                                        }
                                        {!course.course_rating && 
                                            <span>Note : 0/5</span>
                                        }
                                    </td>
                                    <td className='text-center'><img className='round' src={course.featured_img} width="80 " alt={course.title}/></td>
                                    <td className='text-center'><Link to={`/enrolled-students/`+course.id} >&nbsp;{course.total_enrolled_students}  <i class="bi bi-people-fill"></i></Link></td> 
                                    <td className='text-center'>
                                        <Link to={`/edit-course/` +course.id} className='btn btn-secondary btn-sm ms-2  mb-2'><i class="bi bi-pencil-square"></i></Link>
                                        <Link to={`/live-classroom/` +course.id} className='btn btn-danger btn-sm ms-2 mb-2'><i className="bi bi-camera-video me-1" aria-hidden="true"></i>Classe en direct</Link>
                                        <Link to={`/teacher-course-ai-analytics/` +course.id} className='btn btn-dark btn-sm ms-2 mb-2'><i className="bi bi-bar-chart-line me-1" aria-hidden="true"></i>Statistiques IA</Link>
                                        <Link to={`/study-material/` +course.id} className='btn btn-primary btn-sm ms-2 mb-2'>Ressources pédagogiques</Link>
                                        <Link to={`/add-chapter/` +course.id} className='btn btn-success btn-sm ms-2 mb-2'>Ajouter un chapitre</Link>
                                        <button onClick={()=>handleDeleteClick(course.id)} className='btn btn-danger btn-sm ms-2 mb-2'><i class="bi bi-trash"></i></button>
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

export default TeacherMyCourses
