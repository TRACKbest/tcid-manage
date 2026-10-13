import React from 'react'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import axios from 'axios'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const CheckQuizCourse = (props) => {
    const [quizData, setQuizData] = useState([])
    const teacherId = localStorage.getItem('teacherId')

    useEffect(() => {
        document.title = 'TCiD Center | Association des questionnaires'
    }, [])

    useEffect(() => {
        axios.get(`${baseUrl}/fetch-quiz-assign-status/${props.quiz}/${props.course}`)
            .then((res) => setQuizData(res.data))
            .catch((error) => console.error(error))
    }, [props.course, props.quiz])

    const assignQuiz = (quizId) => {
        const formData = new FormData()
        formData.append('teacher', teacherId)
        formData.append('course', props.course)
        formData.append('quiz', quizId)

        axios.post(baseUrl + '/quiz-assign-course/', formData, {
            headers: { 'content-type': 'multipart/form-data' }
        })
            .then((res) => {
                if (res.status === 200 || res.status === 201) {
                    window.location.reload()
                }
            })
            .catch((error) => console.error(error))
    }

  return (
    <td>
        {quizData.bool === false &&
            <button onClick={()=>assignQuiz(props.quiz)} className='btn btn-success btn-sm ms-2'>Associer</button>
        }
        {quizData.bool === true &&
        <>
            <span className='text-success'>Associé</span>
            &nbsp;
            <Link className='btn btn-sm btn-info' to={`/attempted-students/`+props.quiz}>Étudiants ayant répondu</Link>
        </>
        }
    </td>
  )
}

export default CheckQuizCourse

