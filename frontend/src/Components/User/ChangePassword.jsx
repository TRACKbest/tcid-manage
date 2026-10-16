import Sidebar from './Sidebar'
import React from 'react'
import { useEffect } from 'react'
import axios from 'axios'
import { useState } from 'react'
import Swal from 'sweetalert2'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const ChangePassword = () => {
    useEffect(()=>{
        document.title='TCiD Center | Modifier le mot de passe'
      })

      
    const studentId=localStorage.getItem('studentId');

    const [studentData,setstudentData]=useState({
        'password':''
    });

    const handleChange=(event)=>{
        setstudentData({
            ...studentData,
            [event.target.name]:event.target.value
        });
    }

    const submitForm=()=>{
        const studentFormData=new FormData();
        studentFormData.append("password",studentData.password)

        try{
                axios.post(baseUrl+'/student/change-password/'+studentId+'/',studentFormData)
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
                            window.location.href='/user-logout';
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
            setstudentData({'status':'error'})
        }
    }

    const studentLoginStatus=localStorage.getItem('studentLoginStatus')
    if(studentLoginStatus !== 'true'){
        window.location.href='/user-login';
    }

  return (
    <div className='container mt-4'>
        <div className='row'>
            <aside className='col-md-3'>
                <Sidebar />
            </aside>
            <section className='col-md-9'>
                <div className='card'>
                    <h5 className='card-header'>
                    <i class="bi bi-person-bounding-box"/> Modifier le mot de passe
                    </h5>
                    <div className='card-body'>
                        <div className="mb-3 row">
                        <label for="inputPassword" className="col-sm-2 col-form-label">Nouveau mot de passe</label>
                        <div className="col-sm-10">
                        <input type="text" name='password' value={studentData.password} onChange={handleChange} className="form-control" id="inputPassword" />
                        </div>    
                    </div>
                    <hr/>
                        <button onClick={submitForm} className='btn btn-primary'>Modifier le mot de passe</button>
                    </div>
                </div>
            </section>
        </div>
    </div>
  )
}

export default ChangePassword 
