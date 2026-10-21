import React from 'react'
import { useEffect } from 'react'
import { useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const Login = () => {

    const studentLoginStatus=localStorage.getItem('studentLoginStatus');

    useEffect(() => {
      window.scrollTo(0, 0)
    }, [])
    
    const [studentLoginData,setStudentLoginData]=useState({
        email:'',
        password:''
      });

      const [errorMsg, setErrorMsg]=useState('')

      const handleChange=(event)=>{
        setStudentLoginData({
            ...studentLoginData,
            [event.target.name]:event.target.value
        });
    }

    const submitForm=async ()=>{
      const studentFormData = new FormData()
        studentFormData.append('email',studentLoginData.email)
        studentFormData.append('password',studentLoginData.password)
      setErrorMsg('')
      try {
        const response = await axios.post(`${baseUrl}/student-login`, studentFormData)
        if (response.data.bool === true) {
          localStorage.removeItem('teacherLoginStatus')
          localStorage.removeItem('teacherId')
          localStorage.setItem('activeAccountType', 'student')
          localStorage.setItem('studentLoginStatus', 'true')
          localStorage.setItem('studentId', response.data.student_id)
          window.location.assign('/user-dashboard')
        } else {
          setErrorMsg(response.data.status === 'pending_approval'
            ? 'Votre compte est en attente de validation par l’administrateur.'
            : 'Adresse e-mail ou mot de passe incorrect.')
        }
      } catch (error) {
        console.error('Student login failed:', error.response?.data || error)
        setErrorMsg('Connexion au serveur impossible. Vérifiez que Django est démarré.')
        }
    }

    if(studentLoginStatus === 'true'){
        localStorage.removeItem('teacherLoginStatus')
        localStorage.removeItem('teacherId')
        localStorage.setItem('activeAccountType', 'student')
        window.location.href='/user-dashboard';
    }

    useEffect(()=>{
        document.title='TCiD Center | Connexion apprenant'
      })

  return (
  <>
    <div className="container">
    <div className="row">
      <div className="col-sm-9 col-md-7 col-lg-5 mx-auto">
        <div className="card border-0 shadow rounded-3 my-5">
          <div className="card-body p-4 p-sm-5">
          <div className="text-center wow fadeInUp">
          <h5 className="card-title text-center mb-3 fw-light fs-5 text-dark">CONNEXION APPRENANT</h5>
          </div>            
            {errorMsg && <p className='text-danger'>{errorMsg}</p>}
              <div className="form-floating mb-3">
                <input type="email" value={studentLoginData.email} onChange={handleChange} name='email' className="form-control" id="floatingInput" placeholder="name@example.com"/>
                <label htmlFor="floatingInput">Adresse e-mail</label>
              </div>
              <div className="form-floating mb-3">
                <input value={studentLoginData.password} name='password' type="password" onChange={handleChange} className="form-control" id="floatingPassword" placeholder="Mot de passe"/>
                <label htmlFor="floatingPassword">Mot de passe</label>
              </div>
              <div className="d-grid my-4">
                <button onClick={submitForm} className="btn btn-success rounded-pill btn-login text-uppercase fw-bold" type="submit" >Se connecter</button>
                <hr className=''/>
                <Link to='/user-register' className="btn btn-danger rounded-pill btn-login text-uppercase fw-bold" type="submit" >Créer un compte</Link>
              </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  </>
  )
}

export default Login
