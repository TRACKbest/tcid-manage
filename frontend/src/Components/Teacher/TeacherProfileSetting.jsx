import TeacherSidebar from './TeacherSidebar'
import React from 'react'
import { useEffect } from 'react'
import axios from 'axios'
import { useState } from 'react'
import Swal from 'sweetalert2'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const TeacherProfileSetting = () => {
    useEffect(()=>{
        document.title='TCiD Center | Paramètres du profil'
      })

    const teacherId=localStorage.getItem('teacherId');

    const [teacherData,setTeacherData]=useState({
        'full_name':'',
        'email':'',
        'qualification':'',
        'mobile_no':'',
        'skills':'',
        'profile_img':'',
        'p_img':'',
        'status':'',
        'face_url':'',
        'insta_url':'',
        'twit_url':'',
        'web_url':'',
        'you_url':'',
    });
    const [isSaving, setIsSaving] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')
    const [previewUrl, setPreviewUrl] = useState('')

    useEffect(()=>{
        if (!teacherId) {
            setErrorMsg('Connectez-vous comme enseignant pour modifier votre profil.')
            return
        }
        axios.get(`${baseUrl}/teacher/${teacherId}/`)
            .then((response)=>setTeacherData(currentData => ({
                ...currentData,
                ...response.data,
                face_url: response.data.face_url || '',
                insta_url: response.data.insta_url || '',
                twit_url: response.data.twit_url || '',
                web_url: response.data.web_url || '',
                you_url: response.data.you_url || '',
                p_img: '',
            })))
            .catch((error)=>{
                console.error('Could not load teacher profile:', error.response?.data || error)
                setErrorMsg('Impossible de charger le profil. Vérifiez que le serveur Django est démarré.')
            })
      },[teacherId]);

    const handleChange=(event)=>{
        setTeacherData({
            ...teacherData,
            [event.target.name]:event.target.value
        });
    }

    const handleFileChange=(event)=>{
        const file = event.target.files?.[0]
        if (!file) return
        setTeacherData(currentData => ({ ...currentData, p_img: file }))
        setPreviewUrl(URL.createObjectURL(file))
      }

    const submitForm=async ()=>{
        if (!teacherId) {
            setErrorMsg('Connectez-vous comme enseignant pour modifier votre profil.')
            return
        }
        const teacherFormData=new FormData();
        teacherFormData.append("full_name",teacherData.full_name)
        teacherFormData.append("email",teacherData.email)
        teacherFormData.append("qualification",teacherData.qualification)
        teacherFormData.append("mobile_no",teacherData.mobile_no)
        teacherFormData.append("skills",teacherData.skills)
        for (const field of ['face_url', 'insta_url', 'twit_url', 'web_url', 'you_url']) {
            const value = typeof teacherData[field] === 'string' ? teacherData[field].trim() : ''
            teacherFormData.append(field, value)
        }
        if (teacherData.p_img) {
            teacherFormData.append('profile_img', teacherData.p_img)
        }

        setIsSaving(true)
        setErrorMsg('')
        try {
            const response = await axios.patch(`${baseUrl}/teacher/${teacherId}/`, teacherFormData)
            setTeacherData(currentData => ({ ...currentData, ...response.data, p_img: '' }))
            setPreviewUrl('')
            Swal.fire({
                title:'Profil mis à jour',
                icon:'success',
                toast:true,
                timer:3000,
                position:'top-right',
                timerProgressBar: true,
                showConfirmButton: false
            })
        } catch (error) {
            console.error('Could not update teacher profile:', error.response?.data || error)
            const detail = error.response?.data
            setErrorMsg(detail ? JSON.stringify(detail) : 'La mise à jour a échoué. Vérifiez le serveur et réessayez.')
        } finally {
            setIsSaving(false)
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
                    <i class="bi bi-person-lines-fill"></i> Paramètres du profil
                    </h5>
                    <div className='card-body'>
                    {errorMsg && <div className="alert alert-danger" role="alert">{errorMsg}</div>}
                    <div className="mb-3 row">
                        <label for="staticEmail" className="col-sm-2 col-form-label">Nom complet</label>
                        <div className="col-sm-10">
                        <input  name='full_name' type="text"  value={teacherData.full_name} onChange={handleChange} className="form-control" />
                        </div>
                    </div>
                    <div className="mb-3 row">
                        <label for="staticEmail" className="col-sm-2 col-form-label">Adresse e-mail</label>
                        <div className="col-sm-10">
                        <input name='email' type="text" value={teacherData.email} onChange={handleChange} className="form-control"/>
                        </div>
                    </div>
                    <div className="mb-3 row">
                        <label className="col-sm-2 col-form-label">Photo de profil</label>
                        <div className="col-sm-10">
                        <input type="file" onChange={handleFileChange} name='p_img' className="form-control" accept="image/*"/>
                        {teacherData.profile_img && 
                            <p className='mt-2'><img src={previewUrl || teacherData.profile_img} width={300} alt={teacherData.full_name} /></p>
                        }
                        </div>
                    </div>
                    <div className="mb-3 row">
                        <label for="staticEmail" className="col-sm-2 col-form-label">Téléphone</label>
                        <div className="col-sm-10">
                        <input name='mobile_no' type="number" value={teacherData.mobile_no} onChange={handleChange} className="form-control"/>
                        </div>
                    </div>
                    <div className="mb-3 row">
                        <label for="staticEmail" className="col-sm-2 col-form-label">Compétences</label>
                        <div className="col-sm-10">
                        <textarea name='skills' type="text"  value={teacherData.skills} onChange={handleChange} className="form-control" id="staticEmail" />
                        </div>
                    </div>
                    <div className="mb-3 row">
                        <label for="staticEmail" className="col-sm-2 col-form-label">Qualifications</label>
                        <div className="col-sm-10">
                        <textarea name='qualification' type="text"  value={teacherData.qualification} onChange={handleChange} className="form-control" id="staticEmail" />
                        </div>
                    </div>
                    <hr />
                    <h4 className='my-4'>Réseaux sociaux</h4>
                    <div className="mb-3 row">
                        <label for="staticEmail" className="col-sm-2 col-form-label">Lien Facebook (facultatif)</label>
                        <div className="col-sm-10">
                        <input  name='face_url' type="text"  value={teacherData.face_url} onChange={handleChange} className="form-control" />
                        </div>
                    </div><div className="mb-3 row">
                        <label for="staticEmail" className="col-sm-2 col-form-label">Lien Instagram (facultatif)</label>
                        <div className="col-sm-10">
                        <input  name='insta_url' type="text"  value={teacherData.insta_url} onChange={handleChange} className="form-control" />
                        </div>
                    </div><div className="mb-3 row">
                        <label for="staticEmail" className="col-sm-2 col-form-label">Lien Twitter (facultatif)</label>
                        <div className="col-sm-10">
                        <input  name='twit_url' type="text"  value={teacherData.twit_url} onChange={handleChange} className="form-control" />
                        </div>
                    </div><div className="mb-3 row">
                        <label for="staticEmail" className="col-sm-2 col-form-label">Site web (facultatif)</label>
                        <div className="col-sm-10">
                        <input  name='web_url' type="text"  value={teacherData.web_url} onChange={handleChange} className="form-control" />
                        </div>
                    </div><div className="mb-3 row">
                        <label for="staticEmail" className="col-sm-2 col-form-label">Lien YouTube (facultatif)</label>
                        <div className="col-sm-10">
                        <input  name='you_url' type="text"  value={teacherData.you_url} onChange={handleChange} className="form-control" />
                        </div>
                    </div>
                        <button type="button" onClick={submitForm} className='btn btn-primary' disabled={isSaving}>{isSaving ? 'Enregistrement…' : 'Mettre à jour'}</button>
                    </div>
                </div>
            </section>
        </div>
    </div>
  )
}

export default TeacherProfileSetting
