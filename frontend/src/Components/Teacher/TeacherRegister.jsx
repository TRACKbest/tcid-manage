import React from 'react'
import { useEffect } from 'react'
import axios from 'axios'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Swal from 'sweetalert2'
import GoogleSignInButton from '../User/GoogleSignInButton'
import '../User/LearnerAuth.css'


const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const TeacherRegister = () => {
    useEffect(()=>{
        document.title='TCiD Center | Inscription formateur';
    });

    useEffect(() => {
        window.scrollTo(0, 0)
      }, [])

    const [teacherData,setTeacherData]=useState({
            'full_name':'',
            'email':'',
            'password':'',
            'qualification':'',
            'mobile_no':'',
            'skills':'',
            'status':''
    })
              const [profileImage, setProfileImage] = useState(null)
              const [registrationError, setRegistrationError] = useState('')
              const [submitting, setSubmitting] = useState(false)

    const handleChange=(event)=>{
        setTeacherData({
            ...teacherData,
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
        const teacherFormData=new FormData();
        teacherFormData.append("full_name",teacherData.full_name)
        teacherFormData.append("email",teacherData.email)
        teacherFormData.append("password",teacherData.password)
        teacherFormData.append("qualification",teacherData.qualification)
        teacherFormData.append("mobile_no",teacherData.mobile_no)
        teacherFormData.append("skills",teacherData.skills)
        if (profileImage) {
          teacherFormData.append('profile_img', profileImage, profileImage.name)
        }

        try {
          await axios.post(`${baseUrl}/teacher/`, teacherFormData)
          setTeacherData({
            full_name: '',
            email: '',
            password: '',
            qualification: '',
            mobile_no: '',
            skills: '',
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
          window.setTimeout(() => window.location.assign('/teacher-login'), 2500)
        } catch (error) {
          const responseData = error.response?.data
          const fieldLabels = {
            full_name: 'Nom complet',
            email: 'Adresse e-mail',
            password: 'Mot de passe',
            qualification: 'Diplômes et qualifications',
            mobile_no: 'Téléphone',
            skills: 'Compétences',
            profile_img: 'Photo de profil',
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
          console.error('Teacher registration failed:', responseData || error)
          setRegistrationError(message || 'Impossible de créer le compte. Vérifiez votre connexion et réessayez.')
          setTeacherData(currentData => ({ ...currentData, status: 'error' }))
        } finally {
          setSubmitting(false)
        }
    }

    const teacherLoginStatus=localStorage.getItem('teacherLoginStatus')
    if(teacherLoginStatus === 'true'){
        window.location.href='/teacher-dashboard';
    }
    
 return (
    <div className="container">
    <div className="row">
      <div className="col-sm-9 col-md-7 col-lg-5 mx-auto">
        <div className="card border-0 shadow rounded-3 my-5">
          <div className="card-body p-4 p-sm-5">
          <div className="text-center wow fadeInUp">
          <h5 className="card-title text-center mb-3 fw-light fs-5 text-dark ">INSCRIPTION FORMATEUR</h5>
          </div>            
            {teacherData.status === 'success' && <h3 className='text-center text-success mb-3'>Demande envoyée. Votre compte sera activé après validation par l’administrateur.</h3>}
            {teacherData.status === 'error' && <p className='text-center text-danger mb-3' role="alert">{registrationError}</p>}
            <GoogleSignInButton role="teacher" mode="register" />
            <p className="learner-auth-hint mt-2">Votre nom et votre e-mail Google sont repris automatiquement ; l’administrateur valide ensuite votre compte.</p>
            <div className="learner-auth-divider my-3"><span>ou remplissez le formulaire</span></div>
              <div className="form-floating mb-3">
                <input type="text" onChange={handleChange} name='full_name' className="form-control" id="floatingInput" placeholder="Nom complet" />
                <label htmlFor="floatingInput">Nom complet</label>
              </div>
              <div className="form-floating mb-3">
                <input type="email" onChange={handleChange} name='email' className="form-control" id="floatingInput" placeholder="name@example.com"/>
                <label htmlFor="floatingInput">Adresse e-mail</label>
              </div>
              <div className="form-floating mb-3">
                <input name='password' type="password" onChange={handleChange} className="form-control" id="floatingPassword" placeholder="Mot de passe"/>
                <label htmlFor="floatingPassword">Mot de passe</label>
              </div>
              <div className="form-floating mb-3">
                <input type="text" onChange={handleChange} name='qualification' className="form-control" id="floatingInput" placeholder="Diplômes et qualifications"/>
                <label htmlFor="floatingInput">Diplômes et qualifications</label>
              </div>
              <div className="form-floating mb-3">
                <input type="tel" onChange={handleChange} name='mobile_no' className="form-control" id="floatingInput" placeholder="Téléphone"/>
                <label htmlFor="floatingInput">Téléphone</label>
              </div>
              <div className="form-floating mb-3">
                <textarea type="text" onChange={handleChange} name='skills' className="form-control" id="floatingInput" placeholder="Vos domaines d’expertise"></textarea>
                <label htmlFor="floatingInput">Compétences</label>
                <div id="emailHelp" className="form-text">Ex. : programmation, développement web, mathématiques…</div>
              </div>
              <div className="mb-3">
                <label htmlFor="teacher-profile-image" className="form-label">Photo de profil (facultative)</label>
                <input id="teacher-profile-image" type="file" accept="image/*" onChange={handleFileChange} className="form-control" />
              </div>
              <div className="d-grid my-4">
                <button onClick={submitForm} className="btn btn-success rounded-pill btn-login text-uppercase fw-bold" type="button" disabled={submitting}>{submitting ? 'Envoi en cours…' : 'Créer mon compte'}</button>
                <hr className=''/>
                <Link to='/teacher-login' className="btn btn-danger rounded-pill btn-login text-uppercase fw-bold">Déjà inscrit·e ? Connexion</Link>
              </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  )
}

export default TeacherRegister
