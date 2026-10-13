import React from 'react'
import TeacherSidebar from './TeacherSidebar'
import { useEffect } from 'react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import axios from 'axios'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const CourseChapters = () => {

    const [chapterData, setChapterData]=useState([]);

    const [totalResult, settotalResult]=useState([0]);    

    const {course_id}=useParams();

    useEffect(()=>{
      try{
          axios.get(baseUrl+'/course-chapters/'+course_id)
          .then((res)=>{
            settotalResult(res.data.length)
            setChapterData(res.data)
          });
      }catch(error){
          console.log(error);
      }
    },[course_id]);

    const Swal = require('sweetalert2');

    const handleDeleteClick = (chapter_id) =>{
        Swal.fire({
            title: 'Confirmer la suppression',
            text: 'Voulez-vous vraiment supprimer ce chapitre ?',
            icon: 'info',
            confirmButtonText: 'Supprimer',
            cancelButtonText: 'Annuler',
            showCancelButton:true
          }).then((result)=>{
            if(result.isConfirmed){
                try{
                    axios.delete(baseUrl+'/chapter/'+chapter_id)
                    .then((res)=>{
                        Swal.fire('Suppression effectuée', 'Le chapitre a été supprimé.', 'success')
                        try{
                            axios.get(baseUrl+'/course-chapters/'+course_id)
                            .then((res)=>{
                              settotalResult(res.data.length)
                              setChapterData(res.data)
                            });
                        }catch(error){
                            console.log(error);
                        }
                    })
            }catch(error){
                Swal.fire('Erreur', 'Le chapitre n’a pas pu être supprimé.', 'error');
            }
            }
            else{
                Swal.fire('Suppression annulée', 'Aucune modification n’a été effectuée.', 'info');
            }
          })
    }

  return (
    <div className='container mt-4'>
    <div className='row'>
        <aside className='col-md-3'>
            <TeacherSidebar />
        </aside>
        <section className='col-md-9'>
            <div className='card'>
                <h5 className='card-header'> Chapitres ({totalResult}) <Link className='btn btn-success btn-sm float-end ' to={'/add-chapter/'+course_id}>Ajouter un chapitre</Link></h5>
                <div className='card-body table-responsive'>
                    <table className='table table-bordered'>
                        <thead className='text-center'>
                            <tr>
                                <th>Titre</th>
                                <th>Vidéo</th>
                                <th>Remarques</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody className='text-center'>
                            {chapterData.map((chapter,index) => 
                                <tr>
                                <td><Link to={`/edit-chapter/` +chapter.id}>{chapter.title}</Link></td>
                                <td>
                                    <video controls width={200}>
                                        <source src={chapter.video} type='video/webcam' />
                                        <source src={chapter.video} type='video/mp4' />
                                    </video>
                                </td>
                                <td>{chapter.remarks}</td>
                                <td className='text-center'>
                                    <Link to={`/edit-chapter/`+chapter.id} className='btn btn-info text-white btn-sm mb-2 me-2 text-center'><i className='bi bi-pencil-square'></i></Link>
                                    <button onClick={()=>handleDeleteClick(chapter.id)} to={`/delete-chapter/`+chapter.id} className='btn btn-danger  ms-2 btn-sm mb-2 me-2 text-center '><i className='bi bi-trash'></i></button>
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

export default CourseChapters
