import React from 'react'
import { useEffect } from 'react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import Sidebar from './Sidebar'
import AiLearningTools from '../AiLearningTools'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const StudyStudentMaterial = () => {

        const [studyData, setStudyData]=useState([]);
        const [totalResult, setTotalResult]=useState(0)
        const [errorMsg, setErrorMsg]=useState('')
        const [isLoading, setIsLoading]=useState(true)
        const [summaryLoading, setSummaryLoading]=useState(null)
        const [summaryOverrides, setSummaryOverrides]=useState({})
    const {course_id}=useParams();
        const studentId = localStorage.getItem('studentId')

    useEffect(()=>{
            if (!studentId) {
                    setErrorMsg('Connectez-vous comme apprenant pour consulter les documents.')
                    setIsLoading(false)
                    return
      }
            axios.get(`${baseUrl}/user/study-material/${course_id}/${studentId}`)
                    .then((response)=>{
                        setTotalResult(response.data.length)
                        setStudyData(response.data)
                    })
                    .catch((error)=>{
                        console.error('Could not load course documents:', error.response?.data || error)
                        setErrorMsg(error.response?.status === 403
                                ? 'Votre demande doit être approuvée par le formateur avant de consulter les documents.'
                                : 'Impossible de charger les documents de la formation.')
                    })
                    .finally(()=>setIsLoading(false))
        },[course_id, studentId]);

    const downloadFile = (file_url)=>{
        window.location.href=file_url;
    }

    const generateSummary = async (materialId) => {
        setSummaryLoading(materialId)
        setErrorMsg('')
        try {
            const response = await axios.post(`${baseUrl}/ai/study-materials/${materialId}/summary/`, {
                student_id: studentId,
            })
            setSummaryOverrides((current) => ({ ...current, [materialId]: response.data.summary }))
        } catch (error) {
            setErrorMsg(error.response?.data?.detail || 'Le résumé IA est momentanément indisponible.')
        } finally {
            setSummaryLoading(null)
        }
    }

  return (
    <div className='container mt-4'>
    <div className='row'>
        <aside className='col-md-3'>
            <Sidebar />
        </aside>
        <section className='col-md-9'>
            <div className='card'>
                <h5 className='card-header'>Documents de la formation ({totalResult})</h5>
                <div className='card-body table-responsive'>
                    {errorMsg && <div className="alert alert-danger" role="alert">{errorMsg}</div>}
                    {isLoading && <p role="status">Chargement des documents...</p>}
                    <table className='table table-bordered'>
                        <thead>
                            <tr>
                                <th>Titre</th>
                                <th>Détails</th>
                                <th>Document</th>
                                <th>Remarques</th>
                                <th>Résumé IA</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && !errorMsg && studyData.length === 0 && <tr><td colSpan="5">Aucun document disponible pour cette formation.</td></tr>}
                            {studyData.map((row,index) => 
                            <tr key={row.id}>
                                <td>{row.title}</td>
                                <td>{row.description}</td>
                                <td>
                                    <button className='btn btn-success btn-sm' type="button" onClick={()=>downloadFile(row.upload)}>Télécharger</button>
                                </td>
                                <td>{row.remarks}</td>
                                <td>
                                    {(summaryOverrides[row.id] || row.ai_summary) ? (
                                        <details>
                                            <summary className="text-success fw-bold">Afficher</summary>
                                            <p className="mt-2 mb-0" style={{ minWidth: '220px', whiteSpace: 'pre-wrap' }}>{summaryOverrides[row.id] || row.ai_summary}</p>
                                        </details>
                                    ) : (
                                        <button className="btn btn-outline-success btn-sm" disabled={summaryLoading === row.id} onClick={() => generateSummary(row.id)} type="button">
                                            <i className="bi bi-stars me-1" aria-hidden="true" />
                                            {summaryLoading === row.id ? 'Résumé…' : 'Résumer'}
                                        </button>
                                    )}
                                </td>
                            </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <AiLearningTools courseId={course_id} studentId={studentId} />
        </section>
    </div>
</div>
  )
}

export default StudyStudentMaterial

