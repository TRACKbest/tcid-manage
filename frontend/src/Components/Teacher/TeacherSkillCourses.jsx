import React from 'react'
import { useParams } from 'react-router-dom'
import { Link } from 'react-router-dom';
import { useEffect } from 'react'
import { useState } from 'react'
import axios from 'axios'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const TeacherSkillCourses = () => {
    useEffect(()=>{
        document.title='TCiD Center | Compétences'
      })
    
      const [courseData, setCourseData]=useState([]);
      const {skill_name,teacher_id}=useParams()

      const [nextUrl, setNextUrl]=useState();
      const [previousUrl, setPreviousUrl]=useState();
    
      useEffect(()=>{
        fetchData(baseUrl+'/course/?skill_name='+skill_name+'&teacher='+teacher_id)
      },[skill_name, teacher_id]);
    
      const paginationHandler = (url) =>{
        fetchData(url)
      }
    
      function fetchData(url){
        try{
          axios.get(url)
          .then((res)=>{
              setNextUrl(res.data.next)
              setPreviousUrl(res.data.previous)
              setCourseData(res.data.results)
          });
        }catch(error){
          console.log(error)
        }
      }
        
  return (
    <div className='container mt-4'>
    <h3 className=' pb-1 mb-4 mt-5'>{skill_name}</h3>
    <div className='row mb-4'>
      {courseData && courseData.map((course,index) =>
      <div className='col-md-3'>
        <div className="card">
          <Link to={`/detail/${course.id}`}><img src={course.featured_img} height={200}  className="card-img-top" alt={course.title} /></Link>
          <div className="card-body">
            <h5 className="card-title"><Link to={`/detail/${course.id}`}>{course.title}</Link></h5>
          </div>
        </div>
      </div>
      )}
    </div>
    <nav aria-label="Page navigation example mt-3">
      <ul className="pagination justify-content-center" aria-label="Pagination des cours">
        {previousUrl &&
          <li className='page-item'><button className='page-link' onClick={()=>paginationHandler(previousUrl)}><i className='bi bi-arrow-left'></i>Précédent</button></li>
        }
        {nextUrl &&
          <li className='page-item'><button className='page-link' onClick={()=>paginationHandler(nextUrl)}><i className='bi bi-arrow-right'></i>Suivant</button></li>
        }
      </ul>
    </nav>
  </div>
  )
}

export default TeacherSkillCourses
