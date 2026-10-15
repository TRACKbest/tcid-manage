import React from 'react'
import TeacherSidebar from './TeacherSidebar'
import { useEffect } from 'react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import axios from 'axios'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const ShowAssignment = () => {

    useEffect(() => {
        window.scrollTo(0, 0)
      }, [])
      
    useEffect(()=>{
        document.title='TCiD Center | Devoirs attribués'
      })

    const [assignmentData, setAssignmentData]=useState([]);

    const [totalResult, settotalResult]=useState(0);    

    const {teacher_id}=useParams();
    const {student_id}=useParams();

    useEffect(()=>{
      try{
          axios.get(baseUrl+'/student-assignment/'+teacher_id+'/'+student_id)
          .then((res)=>{
            settotalResult(res.data.length)
            setAssignmentData(res.data)
          });
      }catch(error){
          console.log(error);
      }
    },[student_id, teacher_id]);

  return (
    <div className='container mt-4'>
    <div className='row'>
        <aside className='col-md-3'>
            <TeacherSidebar />
        </aside>
        <section className='col-md-9'>
            <div className='card'>
                <h5 className='card-header'> Devoirs ({totalResult}) <Link className='btn btn-success btn-sm float-end ' to={`/add-assignment/${student_id}/${teacher_id}`}>Ajouter un devoir</Link></h5>
                <div className='card-body table-responsive'>
                    <table className='table table-bordered'>
                        <thead>
                            <tr>
                                <th>Titre</th>
                                <th>Statut de l’apprenant</th>
                            </tr>
                        </thead>
                        <tbody>
                            {assignmentData.map((row,index) => 
                                <tr>
                                    <td>{row.title}</td>
                                    <td>
                                        {row.student_status === false &&
                                            <span className='badge rounded-pill bg-warning'>En attente</span>
                                        }
                                        {row.student_status === true &&
                                            <span className='badge rounded-pill bg-success'>Terminé</span>
                                        }
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

export default ShowAssignment
