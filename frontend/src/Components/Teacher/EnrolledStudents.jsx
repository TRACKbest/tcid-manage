import React from 'react'
import { useParams } from 'react-router-dom'
import TeacherSidebar from './TeacherSidebar'
import { useEffect } from 'react'
import { useState } from 'react'
import axios from 'axios'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const EnrolledStudents = () => {

    useEffect(()=>{
        document.title='TCiD Center | Apprenants inscrits'
      })

      const [studentData, setStudentData]=useState([]);
      let {course_id}=useParams();

      useEffect(()=>{
        try{
            axios.get(baseUrl+'/fetch-enrolled-students/'+course_id)
            .then((res)=>{
                setStudentData(res.data)
            });
        }catch(error){
            console.log(error)
        }
    },[course_id]);

  return (
        <div className='container mt-4'>
        <div className='row'>
            <aside className='col-md-3'>
                <TeacherSidebar />
            </aside>
            <section className='col-md-9'>
                <div className='card'>
                    <h5 className='card-header'><i class="bi bi-people-fill"></i> Liste des apprenants inscrits</h5>
                    <div className='card-body' class="table-responsive">
                        <table className='table table-striped table-hover'>
                            <thead>
                                <tr>
                                    <th className='text-center'>Profil</th>
                                    <th className='text-center'>Nom</th>
                                    <th className='text-center'>E-mail</th>
                                    <th className='text-center'>Centres d’intérêt</th>
                                </tr>
                            </thead>
                            <tbody>
                                {studentData.map((row,index) => 
                                    <tr>
                                    <td className='text-center'><img className='imgmeet' src={row.student.profile_img} alt="" /></td>
                                    <th className='text-center' scope="row">{row.student.fullname}</th>
                                    <td className='text-center w-auto'>{row.student.email}</td>
                                    <td className='text-center'>{row.student.interseted_categories}</td>
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

export default EnrolledStudents
