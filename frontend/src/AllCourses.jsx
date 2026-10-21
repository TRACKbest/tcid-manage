import React from 'react'
import { Link } from 'react-router-dom'
import { useEffect } from 'react'
import { useState } from 'react'
import axios from 'axios'
import PriceTag from './Components/PriceTag'

const baseUrl = `${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'}/course/`

const AllCourses = () => {

  const [courseData, setCourseData]=useState([]);
  const [nextUrl, setNextUrl]=useState();
  const [previousUrl, setPreviousUrl]=useState();

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(()=>{
    document.title='TCiD Center | Toutes les formations'
  })

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

      useEffect(()=>{
        fetchData(baseUrl)
      },[]);

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
    <div className="text-center wow fadeInUp">
                <h6 className="section-title bg-white text-center text-primary px-3">Formations</h6>
                <h1 className="mb-5">Toutes les formations</h1>
    </div>    <div className='row mb-4'>
      {courseData && courseData.map((course,index) =>
      <div className='col-md-3 mb-4' key={course.id}>
        <div className="card">
          <Link to={`/detail/${course.id}`}><img src={course.featured_img} height={200}  className="card-img-top" alt={course.title} /></Link>
          <div className="card-body">
            <h5 className="card-title"><Link to={`/detail/${course.id}`}>{course.title}</Link></h5>
            <PriceTag course={course} />
          </div>
        </div>
      </div>
      )}
    </div>

  <nav aria-label="Page navigation example mt-3">
  <ul className="pagination justify-content-center">
    {previousUrl &&
        <li className='page-item '><button className='page-link ms-2 rounded-pill' onClick={()=>paginationHandler(previousUrl)}><i className='bi bi-arrow-left'></i>Précédent</button></li>
    }
    {nextUrl &&
        <li className='page-item'><button className='page-link ms-2 rounded-pill' onClick={()=>paginationHandler(nextUrl)}>Suivant<i className='bi bi-arrow-right'></i></button></li>
    }
  </ul>
  </nav>
  </div>
  )
}

export default AllCourses
