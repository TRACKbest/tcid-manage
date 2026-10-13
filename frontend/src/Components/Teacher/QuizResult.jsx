import React from 'react'
import { useEffect } from 'react'
import { useState } from 'react'
import axios from 'axios'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const QuizResult = (props) => {
    useEffect(()=>{
        document.title='TCiD Center | Résultat du questionnaire'
      })

      const [resultData, setResultData]=useState([]);

      useEffect(()=>{
        try{
            axios.get(`${baseUrl}/fetch-quiz-result/${props.quiz}/${props.student}`)
            .then((res)=>{
                setResultData(res.data)
            });
        }catch(error){
            console.log(error)
        }
    
    },[props.quiz, props.student]);

  return (
    <>
    <div className="modal-dialog">
        <div className="modal-content">
        <div className="modal-header">
            <h5 className="modal-title" id="exampleModalLabel">Résultat du questionnaire</h5>
            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div className="modal-body">
            <table className='table table-bordered'>
                <tr>
                    <td>Nombre total de questions</td>
                    <td>{resultData.total_questions}</td>
                </tr>
                <tr>
                    <td>Questions traitées</td>
                    <td>{resultData.total_attempted_questions}</td>
                </tr>
                <tr>
                    <td>Bonnes réponses</td>
                    <td>{resultData.total_correct_questions}</td>
                </tr>
            </table>
        </div>
        </div>
    </div>
    </>
  )
}

export default QuizResult

