import React from 'react'
import { useEffect } from 'react'
import { useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const TeacherLogin = () => {

    const teacherLoginStatus=localStorage.getItem('teacherLoginStatus');

      const [teacherLoginData,setTeacherLoginData]=useState({
        email:'',
        password:''
      });

      useEffect(() => {
        window.scrollTo(0, 0)
      }, [])
      
      const [errorMsg, setErrorMsg]=useState('')

      const handleChange=(event)=>{
        setTeacherLoginData({
            ...teacherLoginData,
            [event.target.name]:event.target.value
        });
    }

    const submitForm=async ()=>{
      const teacherFormData = new FormData()
        teacherFormData.append('email',teacherLoginData.email)
        teacherFormData.append('password',teacherLoginData.password)
      setErrorMsg('')
      try {
        const response = await axios.post(`${baseUrl}/teacher-login`, teacherFormData)
        if (response.data.bool === true) {
          localStorage.removeItem('studentLoginStatus')
          localStorage.removeItem('studentId')
          localStorage.setItem('activeAccountType', 'teacher')
          localStorage.setItem('teacherLoginStatus', 'true')
          localStorage.setItem('teacherId', response.data.teacher_id)
          window.location.assign('/teacher-dashboard')
        } else {
          setErrorMsg(response.data.status === 'pending_approval'
            ? 'Votre compte est en attente de validation par l’administrateur.'
            : 'Adresse e-mail ou mot de passe incorrect.')
        }
      } catch (error) {
        console.error('Teacher login failed:', error.response?.data || error)
        setErrorMsg('Connexion au serveur impossible. Vérifiez que Django est démarré.')
        }
    }

    if(teacherLoginStatus === 'true'){
        localStorage.removeItem('studentLoginStatus')
        localStorage.removeItem('studentId')
        localStorage.setItem('activeAccountType', 'teacher')
        window.location.href='/teacher-dashboard';
    }

    useEffect(()=>{
        document.title='TCiD Center | Connexion formateur'
      })


  return (
    <>
  <div className="container">
    <div className="row">
      <div className="col-sm-9 col-md-7 col-lg-5 mx-auto">
        <div className="card border-0 shadow rounded-3 my-5">
          <div className="card-body p-4 p-sm-5">
          <div className="text-center wow fadeInUp">
          <h5 className="card-title text-center mb-3 fw-light fs-5 text-dark">CONNEXION FORMATEUR</h5>
          </div>            
            {errorMsg && <p className='text-danger'>{errorMsg}</p>}
              <div className="form-floating mb-3">
                <input type="email" value={teacherLoginData.email} onChange={handleChange} name='email' className="form-control" id="floatingInput" placeholder="name@example.com"/>
                <label htmlFor="floatingInput">Adresse e-mail</label>
              </div>
              <div className="form-floating mb-3">
                <input value={teacherLoginData.password} name='password' type="password" onChange={handleChange} className="form-control" id="floatingPassword" placeholder="Mot de passe"/>
                <label htmlFor="floatingPassword">Mot de passe</label>
              </div>
              <div className="d-grid my-4">
                <button onClick={submitForm} className="btn btn-success rounded-pill btn-login text-uppercase fw-bold" type="submit" >Se connecter</button>
                <hr className=''/>
                <Link to='/teacher-register' type="submit"  className="btn btn-danger rounded-pill btn-login text-uppercase fw-bold " >Créer un compte formateur</Link>
              </div>
          </div>
        </div>
      </div>
    </div>
    </div>
    </>
  )
}

export default TeacherLogin
