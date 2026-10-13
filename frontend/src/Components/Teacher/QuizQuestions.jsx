import React from 'react'
import { Link, useParams } from 'react-router-dom'
import { useEffect } from 'react'
import { useState } from 'react'
import axios from 'axios'
import Swal from 'sweetalert2'
import TeacherSidebar from './TeacherSidebar'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const QuizQuestions = () => {

    const [,setTotalResult]=useState(0)
    const [questionData,setQuestionData]=useState([])
    const [isGenerating,setIsGenerating]=useState(false)
    const [aiError,setAiError]=useState('')
    const [aiNotice,setAiNotice]=useState('')
    const {quiz_id}=useParams();
    const teacherId=localStorage.getItem('teacherId')

    useEffect(()=>{
        try{
            axios.get(baseUrl+'/quiz-questions/'+quiz_id)
            .then((res)=>{
                setTotalResult(res.data.length)
                setQuestionData(res.data)
            });
        }catch(error){
            console.log(error)
        }
        document.title='TCiD Center | Questions du questionnaire'
    },[quiz_id]);

      const handleDeleteClick = (question_id) =>{
        Swal.fire({
            title: 'Confirmer la suppression',
            text: 'Voulez-vous vraiment supprimer cette question ?',
            icon: 'info',
            confirmButtonText: 'Supprimer',
            cancelButtonText: 'Annuler',
            showCancelButton:true
          }).then((result)=>{
            if(result.isConfirmed){
                try{
                    axios.delete(baseUrl+'/question/'+question_id)
                    .then((res)=>{
                        Swal.fire('Suppression effectuée', 'La question a été supprimée.', 'success')
                        try{
                            axios.get(baseUrl+'/quiz-questions/'+quiz_id)
                            .then((res)=>{
                                setTotalResult(res.data.length)
                                setQuestionData(res.data)
                            });
                        }catch(error){
                            console.log(error);
                        }
                    })
            }catch(error){
                Swal.fire('Erreur', 'La question n’a pas pu être supprimée.', 'error');
            }
            }
            else{
                Swal.fire('Suppression annulée', 'Aucune modification n’a été effectuée.', 'info');
            }
          })
    }

    const generateWithAI = async () => {
        if (!teacherId || questionData.length || isGenerating) return
        setIsGenerating(true)
        setAiError('')
        setAiNotice('')
        try {
            const response = await axios.post(`${baseUrl}/ai/quizzes/${quiz_id}/generate/`, {
                teacher_id: teacherId,
            })
            const questionsResponse = await axios.get(`${baseUrl}/quiz-questions/${quiz_id}`)
            setQuestionData(questionsResponse.data)
            setTotalResult(questionsResponse.data.length)
            setAiNotice(`${response.data.generated} questions générées et enregistrées.`)
        } catch (error) {
            setAiError(error.response?.data?.detail || 'La génération des questions a échoué.')
        } finally {
            setIsGenerating(false)
        }
    }

  return (
    <div className='container mt-4'>
        <div className='row'>
            <aside className='col-md-3'>
                <TeacherSidebar />
            </aside>
            <section className='col-md-9'>
                <div className='card'>
                    <h5 className='card-header d-flex align-items-center justify-content-between gap-2 flex-wrap'>
                        <span>Liste des questions</span>
                        <button className='btn btn-dark btn-sm' disabled={isGenerating || questionData.length > 0} onClick={generateWithAI} type='button'>
                            <i className="bi bi-stars" aria-hidden="true" />
                            {isGenerating ? 'Génération…' : questionData.length ? 'Questions déjà créées' : 'Générer 10 questions avec l’IA'}
                        </button>
                    </h5>
                    <div className='card-body'>
                        {aiError && <div className="alert alert-danger" role="alert">{aiError}</div>}
                        {aiNotice && <div className="alert alert-success" role="status">{aiNotice}</div>}
                        <table className='table table-bordered'>
                            <thead>
                                <tr>
                                    <th>Question</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {questionData.map((row,index) =>
                                <tr>
                                    <td><Link to={`/edit-question/`+row.id}>{row.questions}</Link></td>
                                    <td>
                                        <Link className='btn btn-sm text-white btn-info' to={`/edit-question/`+row.id}><i className="bi bi-pencil-square"></i></Link>
                                        <button className='btn btn-sm btn-danger ms-1' onClick={()=>handleDeleteClick(row.id)}><i className='bi bi-trash'></i></button>
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

export default QuizQuestions
