import React from 'react'
import { Link } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useEffect } from 'react'
import { useState } from 'react'
import axios from 'axios'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const FavoriteCourses = () => {

    const studentId=localStorage.getItem('studentId')
    const [courseData,setCourseData]=useState([])

    useEffect(()=>{
        try{
            axios.get(baseUrl+'/fetch-favorite-coourses/'+studentId)
            .then((res)=>{
                setCourseData(res.data)
            });
        }catch(error){
            console.log(error)
        }
    },[studentId]);

    useEffect(()=>{
        document.title='TCiD Center | Formations favorites'
      })
  return (
    <div className='container mt-4'>
        <div className='row'>
            <aside className='col-md-3'>
                <Sidebar />
            </aside>
            <section className='col-md-9'>
                <div className='card'>
                    <h5 className='card-header'><i className="bi bi-heart-fill text-danger"></i> Formations favorites</h5>
                    <div className='card-body table-responsive'>
                        <table className='table table-striped table-hover'>
                            <thead>
                                <tr>
                                    <th className='text-center'>Illustration</th>
                                    <th className='text-center'>Formation</th>
                                    <th className='text-center'>Formateur</th>
                                </tr>
                            </thead>
                            <tbody>
                            {courseData.map((row,index) =>
                                <tr>
                                <td className='text-center'><Link to={`/detail/`+row.course.id}><img className='round' width="80 " src={row.course.featured_img} alt={row.course.title}/></Link></td>
                                <td className='text-center'><Link to={`/detail/`+row.course.id}>{row.course.title}</Link></td>
                                <td className='text-center'><Link to={`/teacher-detail/`+row.course.id}>{row.course.teacher.full_name}</Link></td>
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

export default FavoriteCourses
