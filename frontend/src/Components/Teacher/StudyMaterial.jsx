import React from 'react'
import TeacherSidebar from './TeacherSidebar'
import { useEffect } from 'react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import axios from 'axios'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const StudyMaterial = () => {

    const [studyData, setStudyData]=useState([]);
    const [totalResult, settotalResult]=useState([0]);    
    const {course_id}=useParams();
    const teacherId = localStorage.getItem('teacherId')

    useEffect(()=>{
      try{
          axios.get(`${baseUrl}/study-material/${course_id}/${teacherId}`)
          .then((res)=>{
            settotalResult(res.data.length)
            setStudyData(res.data)
          });
      }catch(error){
          console.log(error);
      }
    },[course_id, teacherId]);

    const Swal = require('sweetalert2');

    const handleDeleteClick = (study_id) =>{
        Swal.fire({
            title: 'Confirmer la suppression',
            text: 'Voulez-vous vraiment supprimer cette ressource ?',
            icon: 'info',
            confirmButtonText: 'Supprimer',
            cancelButtonText: 'Annuler',
            showCancelButton:true
          }).then((result)=>{
            if(result.isConfirmed){
                try{
                    axios.delete(`${baseUrl}/study-materials/${study_id}?teacher_id=${teacherId}`)
                    .then((res)=>{
                        Swal.fire('Suppression effectuée', 'La ressource a été supprimée.', 'success')
                        try{
                            axios.get(`${baseUrl}/study-material/${course_id}/${teacherId}`)
                            .then((res)=>{
                              settotalResult(res.data.length)
                              setStudyData(res.data)
                            });
                        }catch(error){
                            console.log(error);
                        }
                    })
            }catch(error){
                Swal.fire('Erreur', 'La ressource n’a pas pu être supprimée.', 'error');
            }
            }
            else{
                Swal.fire('Suppression annulée', 'Aucune modification n’a été effectuée.', 'info');
            }
          })
    }

    const downloadFile = (file_url)=>{
        window.location.href=file_url;
    }

  return (
    <div className='container mt-4'>
    <div className='row'>
        <aside className='col-md-3'>
            <TeacherSidebar />
        </aside>
        <section className='col-md-9'>
            <div className='card'>
                <h5 className='card-header'> Ressources pédagogiques ({totalResult}) <Link className='btn btn-success btn-sm float-end ' to={'/add-study/'+course_id}>Ajouter une ressource</Link></h5>
                <div className='card-body table-responsive'>
                    <table className='table table-bordered'>
                        <thead>
                            <tr>
                                <th>Titre</th>
                                <th>Fichier</th>
                                <th>Remarques</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {studyData.map((row,index) => 
                            <tr>
                                <td>{row.title}</td>
                                <td><button className='btn btn-outline-success' onClick={()=>downloadFile(row.upload)}>Télécharger</button></td>
                                <td>{row.remarks}</td>
                                <td>
                                    <button onClick={()=>handleDeleteClick(row.id)} className='btn btn-danger  ms-2 btn-sm'><i className='bi bi-trash'></i></button>
                                </td>
                            </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    </div>
</div>
  )
}

export default StudyMaterial
