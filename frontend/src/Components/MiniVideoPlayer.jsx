import React from 'react'
import { useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import axios from 'axios'
import "./Me.css"

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const MiniVideoPlayer = () => {

    let {course_id}=useParams();

    const [chapterData, setChapterData]=useState([]);

    useEffect(() => {
      axios.get(`${baseUrl}/course/${course_id}`)
        .then((res) => setChapterData(res.data.course_chapters))
        .catch((error) => console.error(error))
      axios.get(`${baseUrl}/update-view/${course_id}`)
        .catch((error) => console.error(error))
    }, [course_id]);

    useEffect(() => {
      window.scrollTo(0, 0)
    }, [])

    useEffect(()=>{
      document.title='TCiD Center | Contenu du cours'
    }, [])


  return (
<>
<meet>
<div class="you">
  {chapterData.map((chapter,index) => (  
<>
<div class="videos">
    <video src={chapter.video} controls></video>
    <div className='head'>{chapter.title}</div>
  </div>
</>
  ))}
  </div>
   </meet>

</>
  )
}

export default MiniVideoPlayer
