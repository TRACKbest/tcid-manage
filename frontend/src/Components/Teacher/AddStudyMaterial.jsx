import React from 'react'
import TeacherSidebar from './TeacherSidebar'
import { useEffect } from 'react'
import { useState } from 'react'
import axios from 'axios'
import Swal from 'sweetalert2'
import { useParams } from 'react-router-dom'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const AddStudyMaterial = () => {
    useEffect(()=>{
        document.title='TCiD Center | Ajouter une ressource'
      })

      const [studyData,setStudyData]=useState({
        title:'',
        description:'',
        upload:'',
        remarks:''
      });

      const handleChange=(event)=>{
        setStudyData({
            ...studyData,
            [event.target.name]:event.target.value
        });
      }

      const handleFileChange=(event)=>{
        setStudyData({
            ...studyData,
            [event.target.name]:event.target.files[0]
        })
      }

      const {course_id}=useParams();

            const formSubmit=async ()=>{
                const teacherId = localStorage.getItem('teacherId')
                if (!teacherId || !studyData.upload) return
        const _formData=new FormData();
        _formData.append('course',course_id);
        _formData.append('title',studyData.title);
        _formData.append('description',studyData.description);
        _formData.append('upload',studyData.upload);
        _formData.append('remarks',studyData.remarks);

        try {
            await axios.post(`${baseUrl}/study-material/${course_id}/${teacherId}`,_formData,{
                headers: {
                    'content-type':'multipart/form-data'
                }
            })
            Swal.fire({
                title:'Fichier envoyé avec succès !',
                icon:'success',
                toast:true,
                timer:3000,
                position:'top-right',
                timerProgressBar: true,
                showConfirmButton: false
            });
        } catch (error) {
            console.error('Could not upload course document:', error.response?.data || error)
            Swal.fire('Échec de l’envoi', error.response?.data?.upload?.[0] || 'Les fichiers vidéo ne sont pas acceptés.', 'error')
        }
      };
  return (
    <div className='container mt-4'>
    <div className='row'>
        <aside className='col-md-3'>
            <TeacherSidebar />
        </aside>
        <section className='col-md-9'>
            <div className='card'>
                <h3 className='card-header'>Ajouter une ressource pédagogique</h3>
                <div className='card-body'>
                     <div className="mb-3">
                        <label htmlFor="title" className="form-label">Titre</label>
                        <input type="text" onChange={handleChange} name='title' className="form-control"/>
                    </div>
                    <div className="mb-3">
                        <label htmlFor="description" className="form-label">Description</label>
                        <textarea onChange={handleChange} name='description' className='form-control'></textarea>
                    </div>
                    <div className="mb-3">
                        <label htmlFor="upload" className="form-label">Document (PDF, Word, Excel, etc. ; vidéos interdites)</label>
                        <input type="file" onChange={handleFileChange} name='upload' className="form-control" id="inputGroupFile02" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.rtf,.odt,.ods,.zip" />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="techs" className="form-label">Remarques</label>
                        <textarea className='form-control' onChange={handleChange} name='remarks'></textarea>
                    </div>
                    <button type="button" onClick={formSubmit} className="btn btn-primary">Enregistrer</button>
                </div>
            </div>
        </section>
    </div>
    </div>
  )
}

export default AddStudyMaterial
