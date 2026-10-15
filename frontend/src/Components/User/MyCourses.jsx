import React from 'react'
import { Link } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useEffect } from 'react'
import { useState } from 'react'
import axios from 'axios'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const MyCourses = () => {

    const studentId=localStorage.getItem('studentId')
    const [courseData,setCourseData]=useState([])

    useEffect(()=>{
        try{
            axios.get(baseUrl+'/fetch-enrolled-courses/'+studentId)
            .then((res)=>{
                setCourseData(res.data)
            });
        }catch(error){
            console.log(error)
        }
    },[studentId]);

    useEffect(()=>{
        document.title='TCiD Center | Mes formations'
      })
  return (
    <div className='container mt-4'>
        <div className='row'>
            <aside className='col-md-3'>
                <Sidebar />
            </aside>
            <section className='col-md-9'>
                <div className='card'>
                    <h5 className='card-header'><i class="bi bi-journals"/> Mes formations</h5>
                    <div className='card-body table-responsive'>
                        <table className='table table-striped table-hover'>
                            <thead>
                                <tr>
                                    <th  className='text-center'>Créé par</th>
                                    <th className='text-center'>Nom de la formation</th>
                                    <th  className='text-center'>Formateur</th>
                                    <th  className='text-center'>Ressources</th>
                                </tr>
                            </thead>
                            <tbody>
                            {courseData.map((row,index) =>
                                <tr>
                                    <td  className='text-center'><Link to={`/teacher-detail/`+row.course.teacher.id}><img className='imgmeet' src={row.course.teacher.profile_img} alt={row.course.teacher.full_name}/></Link></td>
                                    <td  className='text-center'><Link to={`/detail/`+row.course.id}>{row.course.title}</Link></td>
                                    <td className='text-center'>{row.course.teacher.full_name}</td>
                                    <td  className='text-center'>
                                        <Link to={`/user/study-material/` +row.course.id} className='btn text-white btn-sm btn-info mb-2 me-2'>Ressources de la formation</Link>
                                        <Link to={`/live-classroom/` +row.course.id} className='btn btn-dark btn-sm mb-2'><i className="bi bi-camera-video me-1" aria-hidden="true"></i>Classe virtuelle</Link>
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

export default MyCourses
