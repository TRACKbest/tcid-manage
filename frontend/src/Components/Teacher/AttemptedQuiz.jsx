import React from 'react'
import { useParams } from 'react-router-dom'
import TeacherSidebar from './TeacherSidebar'
import { useEffect } from 'react'
import { useState } from 'react'
import axios from 'axios'
import QuizResult from './QuizResult'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const AttemptedQuiz = () => {
    useEffect(()=>{
        document.title='TCiD Center | Résultats des questionnaires'
      })

      const [studentData, setStudentData]=useState([]);
      const {quiz_id}=useParams() 

      useEffect(()=>{
        try{
            axios.get(baseUrl+'/attempted-quiz/'+quiz_id)
            .then((res)=>{
                setStudentData(res.data)
            });
        }catch(error){
            console.log(error)
        }
        
    },[quiz_id]);

  return (
    <div className='container mt-4'>
        <div className='row'>
            <aside className='col-md-3'>
                <TeacherSidebar />
            </aside>
            <section className='col-md-9'>
                <div className='card'>
                    <h5 className='card-header'>Liste des étudiants</h5>
                    <div className='card-body'>
                        <table className='table table-bordered'>
                            <thead>
                                <tr>
                                    <th>Nom</th>
                                    <th>E-mail</th>
                                    <th>Identifiant</th>
                                    <th>Résultats</th>
                                </tr>
                            </thead>
                            <tbody>
                                {studentData.map((row,index) => 
                                <tr>
                                    <td>
                                        {row.student.fullname}
                                    </td>
                                    <td>
                                        {row.student.email}
                                    </td>
                                    <td>
                                        {row.student.username}
                                    </td>
                                    <td>
                                    <button type="button" className="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target={`#resultModal${row.id}`}>
                                        Résultat du questionnaire
                                    </button>
                                    <div className="modal fade" id={`resultModal${row.id}`} tabindex="-1" aria-labelledby="exampleModalLabel" aria-hidden="true">
                                        <QuizResult quiz={row.quiz.id} student={row.student.id} />
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

export default AttemptedQuiz
