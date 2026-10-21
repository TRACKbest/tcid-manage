import React from 'react'
import { Link } from 'react-router-dom'
import Sidebar from './/Sidebar'
import { useEffect } from 'react'
import { useState } from 'react'
import axios from 'axios'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const Dashboard = () => {
  useEffect(()=>{
    document.title='TCiD Center | Tableau de bord apprenant'
  })

  const [dashbarData,setDashbarData]=useState([])
  const studentId=localStorage.getItem('studentId')

  useEffect(()=>{
    try{
      axios.get(baseUrl+'/student/dashboard/'+studentId)
      .then((res)=>{
        setDashbarData(res.data)
      })
    }catch(error){
      console.log(error)
    }
  },[studentId]);

  return (
    <div className='container mt-4'>
        <div className='row'>
            <aside className='col-md-3'>
                <Sidebar />
            </aside>
            <section className='col-md-9'>
                <div className='row mt-3'>
                  <h4>Tableau de bord</h4>
                  <div className='col-md-4 pt-3'>
                    <div className='card border-primary'>
                      <h5 className='card-header bg-warning text-white'>Formations suivies</h5>
                      <div className='card-body'>
                        <h3><Link to="/my-courses" className='text-warning'>{dashbarData.enrolled_courses} <i className="bi bi-cart-check-fill"></i></Link></h3>
                      </div>
                    </div>
                  </div>
                  <div className='col-md-4 pt-3'>
                    <div className='card border-primary'>
                      <h5 className='card-header bg-success text-white'>Formations favorites</h5>
                      <div className='card-body'>
                        <h3><Link to="/favorite-courses" className='text-success'>{dashbarData.favorite_courses} <i className="bi bi-heart-fill text-success"></i></Link></h3>
                      </div>
                    </div>
                  </div>
                  <div className='col-md-4 pt-3'>
                    <div className='card border-primary'>
                      <h5 className='card-header bg-info text-white'>Devoirs terminés</h5>
                      <div className='card-body'>
                        <h3><Link to="/my-assignments">{dashbarData.complete_assignments} <i className="bi bi-journal-check"></i></Link></h3>
                      </div>
                    </div>
                  </div>
                  <div className='col-md-4 pt-3'>
                    <div className='card border-primary'>
                      <h5 className='card-header bg-danger text-white'>Devoirs à terminer</h5>
                      <div className='card-body'>
                        <h3><Link to="/my-assignments" className='text-danger'>{dashbarData.pending_assignments} <i className="bi bi-journal-x"></i></Link></h3>
                      </div>
                    </div>
                  </div>
                </div>
            </section>
        </div>


    </div>
  )
}

export default Dashboard
