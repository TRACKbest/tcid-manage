import React from 'react'
import { useEffect } from 'react'
import axios from 'axios'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Swal from 'sweetalert2'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const Register = () => {
    useEffect(()=>{
        document.title='TCiD Center | Inscription apprenant'
      })

      useEffect(() => {
        window.scrollTo(0, 0)
      }, [])

    const [studentData,setStudentData]=useState({
        'fullname':'',
        'email':'',
        'password':'',
        'username':'',
        'interseted_categories':'',
        'status':''
    });
      const [profileImage, setProfileImage] = useState(null)
      const [registrationError, setRegistrationError] = useState('')
      const [submitting, setSubmitting] = useState(false)

    const handleChange=(event)=>{
        setStudentData({
            ...studentData,
            [event.target.name]:event.target.value
        });
    }

    const handleFileChange = (event) => {
      setProfileImage(event.target.files[0] || null)
    }

    const submitForm=async ()=>{
        if (submitting) return
        setSubmitting(true)
        setRegistrationError('')
        const studentFormData=new FormData();
        studentFormData.append("fullname",studentData.fullname)
        studentFormData.append("email",studentData.email)
        studentFormData.append("password",studentData.password)
        studentFormData.append("username",studentData.username)
        studentFormData.append("interseted_categories",studentData.interseted_categories)
        if (profileImage) {
          studentFormData.append('profile_img', profileImage, profileImage.name)
        }

        try {
          await axios.post(`${baseUrl}/student/`, studentFormData)
          setStudentData({
            fullname: '',
            email: '',
            password: '',
            username: '',
            interseted_categories: '',
            status: 'success'
          })
          setRegistrationError('')
          setProfileImage(null)
          Swal.fire({
            title: 'Demande envoyée',
            text: 'Votre compte sera accessible après validation par l’administrateur.',
            icon: 'success',
            toast: true,
            timer: 2000,
            position: 'top-right',
            timerProgressBar: true,
            showConfirmButton: false
          })
          window.setTimeout(() => window.location.assign('/user-login'), 2500)
        } catch (error) {
          const responseData = error.response?.data
          const fieldLabels = {
            fullname: 'Nom complet',
            email: 'Adresse e-mail',
            password: 'Mot de passe',
            username: 'Nom d’utilisateur',
            interseted_categories: 'Centres d’intérêt',
            profile_img: 'Photo de profil',
            non_field_errors: 'Inscription',
          }
          const fieldErrors = Object.entries(responseData || {}).flatMap(([field, messages]) => {
            const values = Array.isArray(messages) ? messages : [messages]
            return values
              .filter(message => typeof message === 'string')
              .map(message => `${fieldLabels[field] || field}: ${message}`)
          })
          const message = typeof responseData?.detail === 'string'
            ? responseData.detail
            : fieldErrors.join(' ')
          console.error('Student registration failed:', responseData || error)
          setRegistrationError(message || 'Impossible de créer le compte. Vérifiez votre connexion et réessayez.')
          setStudentData(currentData => ({ ...currentData, status: 'error' }))
        } finally {
          setSubmitting(false)
        }
    }

  return (
    <>
    <div className="container">
    <div className="row">
      <div className="col-sm-9 col-md-7 col-lg-5 mx-auto">
        <div className="card border-0 shadow rounded-3 my-5">
          <div className="card-body p-4 p-sm-5">
          <div className="text-center wow fadeInUp">
          <h5 className="card-title text-center mb-3 fw-light fs-5 text-dark ">INSCRIPTION APPRENANT</h5>
          </div>            
            {studentData.status === 'success' && <h3 className='text-center text-success mb-3'>Demande envoyée. Votre compte sera activé après validation par l’administrateur.</h3>}
            {studentData.status === 'error' && <p className='text-center text-danger mb-3' role="alert">{registrationError}</p>}
              <div className="form-floating mb-3">
                <input type="text" onChange={handleChange} name='fullname' className="form-control" id="floatingInput" placeholder="Nom complet" />
                <label htmlFor="floatingInput">Nom complet</label>
              </div>
              <div className="form-floating mb-3">
                <input type="email" onChange={handleChange} name='email' className="form-control" id="floatingInput" placeholder="name@example.com"/>
                <label htmlFor="floatingInput">Adresse e-mail</label>
              </div>
              <div className="form-floating mb-3">
                <input type="text" onChange={handleChange} name='username' className="form-control" id="floatingInput" placeholder="Nom d’utilisateur"/>
                <label htmlFor="floatingInput">Nom d’utilisateur</label>
              </div>
              <div className="form-floating mb-3">
                <input name='password' type="password" onChange={handleChange} className="form-control" id="floatingPassword" placeholder="Mot de passe"/>
                <label htmlFor="floatingPassword">Mot de passe</label>
              </div>
              <div className="form-floating mb-3">
                <textarea type="text" onChange={handleChange} name='interseted_categories' className="form-control" id="floatingInput" placeholder="Vos centres d’intérêt"></textarea>
                <label htmlFor="floatingInput">Centres d’intérêt</label>
                <div id="emailHelp" className="form-text">Ex. : programmation, développement web, mathématiques…</div>
              </div>
              <div className="mb-3">
                <label htmlFor="student-profile-image" className="form-label">Photo de profil (facultative)</label>
                <input id="student-profile-image" type="file" accept="image/*" onChange={handleFileChange} className="form-control" />
              </div>
              <div className="d-grid my-4">
                <button onClick={submitForm} className="btn btn-success rounded-pill btn-login text-uppercase fw-bold" type="button" disabled={submitting}>{submitting ? 'Envoi en cours…' : 'Créer mon compte'}</button>
                <hr className=''/>
                <Link to='/user-login' className="btn btn-danger rounded-pill btn-login text-uppercase fw-bold">Déjà inscrit·e ? Connexion</Link>
              </div>
          </div>
        </div>
      </div>
    </div>
    </div>
    </>
  )
}

export default Register
