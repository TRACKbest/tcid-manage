import React from 'react'
import { Link } from 'react-router-dom'
import { useEffect } from 'react'
import { useState } from 'react'
import axios from 'axios'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const CheckQuizStatusStudent = (props) => {
    useEffect(()=>{
        document.title='TCiD Center | Questionnaires'
      })

      const [quizData, setQuizData]=useState([]);

      useEffect(()=>{
        try{
            axios.get(`${baseUrl}/fetch-quiz-attempt-status/${props.quiz}/${props.student}`)
            .then((res)=>{
                setQuizData(res.data)
            });
        }catch(error){
            console.log(error)
        }
    
    },[props.quiz, props.student]);

  return (
    <td>
        {quizData.bool === true && 
            <Link className='btn btn-success btn-sm ms-2' to={`/take-quiz/${props.quiz}`}>Répondre au questionnaire</Link>
        }
    </td>
  )
}

export default CheckQuizStatusStudent
