import React from 'react'
import { useEffect } from 'react'
import axios from 'axios'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Swal from 'sweetalert2'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const Register = () => {
    useEffect(()=>{
        document.title='TCiD Center | Inscription étudiant'
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
          console.error('Student registration failed:', error.response?.data || error)
          setStudentData(currentData => ({ ...currentData, status: 'error' }))
        }
    }

  return (
    <>
    <div class="container">
    <div class="row">
      <div class="col-sm-9 col-md-7 col-lg-5 mx-auto">
        <div class="card border-0 shadow rounded-3 my-5">
          <div class="card-body p-4 p-sm-5">
          <div class="text-center wow fadeInUp">
          <h5 class="card-title text-center mb-3 fw-light fs-5 text-dark ">INSCRIPTION ÉTUDIANT</h5>
          </div>            
            {studentData.status === 'success' && <h3 className='text-center text-success mb-3'>Demande envoyée. Votre compte sera activé après validation par l’administrateur.</h3>}
            {studentData.status === 'error' && <h3 className='text-center text-danger mb-3'>Une erreur est survenue. Vérifiez les informations et réessayez.</h3>}
              <div class="form-floating mb-3">
                <input type="text" onChange={handleChange} name='fullname' class="form-control" id="floatingInput" placeholder="Nom complet" />
                <label for="floatingInput">Nom complet</label>
              </div>
              <div class="form-floating mb-3">
                <input type="email" onChange={handleChange} name='email' class="form-control" id="floatingInput" placeholder="name@example.com"/>
                <label for="floatingInput">Adresse e-mail</label>
              </div>
              <div class="form-floating mb-3">
                <input type="text" onChange={handleChange} name='username' class="form-control" id="floatingInput" placeholder="Nom d’utilisateur"/>
                <label for="floatingInput">Nom d’utilisateur</label>
              </div>
              <div class="form-floating mb-3">
                <input name='password' type="password" onChange={handleChange} class="form-control" id="floatingPassword" placeholder="Mot de passe"/>
                <label for="floatingPassword">Mot de passe</label>
              </div>
              <div class="form-floating mb-3">
                <textarea type="text" onChange={handleChange} name='interseted_categories' class="form-control" id="floatingInput" placeholder="Vos centres d’intérêt"></textarea>
                <label for="floatingInput">Centres d’intérêt</label>
                <div id="emailHelp" className="form-text">Ex. : programmation, développement web, mathématiques…</div>
              </div>
              <div className="mb-3">
                <label htmlFor="student-profile-image" className="form-label">Photo de profil (facultative)</label>
                <input id="student-profile-image" type="file" accept="image/*" onChange={handleFileChange} className="form-control" />
              </div>
              <div class="d-grid my-4">
                <button onClick={submitForm} class="btn btn-success rounded-pill btn-login text-uppercase fw-bold" type="submit" >Créer mon compte</button>
                <hr className=''/>
                <Link to='/user-login' class="btn btn-danger rounded-pill btn-login text-uppercase fw-bold">Déjà inscrit·e ? Connexion</Link>
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
