import TeacherSidebar from './TeacherSidebar'
import React from 'react'
import { useEffect } from 'react'
import axios from 'axios'
import { useState } from 'react'
import Swal from 'sweetalert2'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const TeacherChangePassword = () => {
    useEffect(()=>{
        document.title='TCiD Center | Modifier le mot de passe'
      })

      
    const teacherId=localStorage.getItem('teacherId');

    const [teacherData,setTeacherData]=useState({
        'password':''
    });

    const handleChange=(event)=>{
        setTeacherData({
            ...teacherData,
            [event.target.name]:event.target.value
        });
    }

    const submitForm=()=>{
        const teacherFormData=new FormData();
        teacherFormData.append("password",teacherData.password)

        try{
                axios.post(baseUrl+'/teacher/change-password/'+teacherId+'/',teacherFormData)
                .then((response)=>{
                    if(response.status === 200){
                        Swal.fire({
                            title:'Mot de passe modifié avec succès',
                            icon:'success',
                            toast:true,
                            timer:3000,
                            position:'top-right',
                            timerProgressBar: true,
                            showConfirmButton: false
                        
                        });
                        if (window.confirm('Mot de passe modifié. Voulez-vous vous déconnecter maintenant ?')) {
                            window.location.href='/teacher-logout';
                        }
                    }else{
                        Swal.fire({
                            title:'Erreur : veuillez réessayer.',
                            icon:'error',
                            toast:true,
                            timer:3000,
                            position:'top-right',
                            timerProgressBar: true,
                            showConfirmButton: false
                        
                        });
                    }
                    })
        }catch(error){
            console.log(error);
            setTeacherData({'status':'error'})
        }
    }

    const teacherLoginStatus=localStorage.getItem('teacherLoginStatus')
    if(teacherLoginStatus !== 'true'){
        window.location.href='/teacher-login';
    }

  return (
    <div className='container mt-4'>
        <div className='row'>
            <aside className='col-md-3'>
                <TeacherSidebar />
            </aside>
            <section className='col-md-9'>
                <div className='card'>
                    <h5 className='card-header'>
                    <i class="bi bi-person-bounding-box"></i> Modifier le mot de passe
                    </h5>
                    <div className='card-body'>
                        <div className="mb-3 row">
                        <label for="inputPassword" className="col-sm-2 col-form-label">Nouveau mot de passe</label>
                        <div className="col-sm-10">
                        <input type="text" name='password' value={teacherData.password} onChange={handleChange} className="form-control" id="inputPassword" />
                        </div>    
                    </div>
                    <hr/>
                        <button onClick={submitForm} className='btn btn-primary'>Mettre à jour</button>
                    </div>
                </div>
            </section>
        </div>
    </div>
  )
}

export default TeacherChangePassword 
