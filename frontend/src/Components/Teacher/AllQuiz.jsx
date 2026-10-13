import React from 'react'
import { Link } from 'react-router-dom'
import TeacherSidebar from './TeacherSidebar'
import { useEffect } from 'react'
import { useState } from 'react'
import axios from 'axios'
import Swal from 'sweetalert2'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const AllQuiz = () => {
    useEffect(()=>{
        document.title='TCiD Center | Questionnaires'
      })

      const [quizData, setQuizData]=useState([]);
      const teacherId=localStorage.getItem('teacherId');

      useEffect(()=>{
        try{
            axios.get(baseUrl+'/teacher-quiz/'+teacherId)
            .then((res)=>{
                setQuizData(res.data)
            });
        }catch(error){
            console.log(error)
        }
    },[teacherId]);

      const handleDeleteClick = (quiz_id) =>{
        Swal.fire({
            title: 'Confirmer la suppression',
            text: 'Voulez-vous vraiment supprimer ce questionnaire ?',
            icon: 'info',
            confirmButtonText: 'Supprimer',
            cancelButtonText: 'Annuler',
            showCancelButton:true
          }).then((result)=>{
            if(result.isConfirmed){
                try{
                    axios.delete(baseUrl+'/quiz/'+quiz_id)
                    .then((res)=>{
                        Swal.fire('Suppression effectuée', 'Le questionnaire a été supprimé.', 'success')
                        try{
                            axios.get(baseUrl+'/teacher-quiz/'+teacherId)
                            .then((res)=>{
                              setQuizData(res.data)
                            });
                        }catch(error){
                            console.log(error);
                        }
                    })
            }catch(error){
                Swal.fire('Erreur', 'Le questionnaire n’a pas pu être supprimé.', 'error');
            }
            }
            else{
                Swal.fire('Suppression annulée', 'Aucune modification n’a été effectuée.', 'info');
            }
          })
    }
      

  return (
    <div className='container mt-4'>
        <div className='row'>
            <aside className='col-md-3'>
                <TeacherSidebar />
            </aside>
            <section className='col-md-9'>
                <div className='card'>
                    <h5 className='card-header'> Questionnaires</h5>
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
                                    <td>
                                        <Link to={`/edit-quiz/` +row.id} className='btn btn-info btn-sm ms-4 mb-2'>Modifier</Link>
                                        <Link to={`/add-question/` +row.id} className='btn btn-success btn-sm ms-2 mb-2'>Ajouter des questions</Link>
                                        <button onClick={()=>handleDeleteClick(row.id)} className='btn btn-danger btn-sm ms-2 mb-2'>Supprimer</button>
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

export default AllQuiz
