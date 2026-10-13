import React from 'react'
import { Link, useParams } from 'react-router-dom'
import TeacherSidebar from './TeacherSidebar'
import { useEffect } from 'react'
import { useState } from 'react'
import axios from 'axios'
import CheckQuizCourse from './CheckQuizCourse'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const AssignQuiz = () => {
    useEffect(()=>{
        document.title='TCiD Center | Associer un questionnaire'
      })

      const [quizData, setQuizData]=useState([]);
      const [courseData, setCoursezData]=useState([]);
      const teacherId=localStorage.getItem('teacherId');
      const {course_id}=useParams() 

      useEffect(()=>{
        try{
            axios.get(baseUrl+'/teacher-quiz/'+teacherId)
            .then((res)=>{
                setQuizData(res.data)
            });
        }catch(error){
            console.log(error)
        }

        try{
            axios.get(baseUrl+'/course/'+course_id)
            .then((res)=>{
                setCoursezData(res.data)
            });
        }catch(error){
            console.log(error)
        }
        
    },[course_id, teacherId]);

  return (
    <div className='container mt-4'>
        <div className='row'>
            <aside className='col-md-3'>
                <TeacherSidebar />
            </aside>
            <section className='col-md-9'>
                <div className='card'>
                    <h5 className='card-header'> Associer un questionnaire au cours : {courseData.title}</h5>
                    <div className='card-body'>
                        <table className='table table-bordered'>
                            <thead>
                                <tr>
                                    <th>Nom</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {quizData.map((row,index) => 
                                    <tr>
                                    <td>
                                        <Link to={`/all-questions/` +row.id}>{row.title}</Link>
                                    </td>
                                        <CheckQuizCourse quiz={row.id} course={course_id} />
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

export default AssignQuiz
