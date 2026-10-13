import TeacherSidebar from './TeacherSidebar'
import { useEffect } from 'react'
import { useState } from 'react'
import axios from 'axios'
import Swal from 'sweetalert2'
import { useNavigate, useParams } from 'react-router-dom'
import RichTextEditor from '../RichTextEditor'
import DOMPurify from 'dompurify'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const AddAssignment = () => {
    useEffect(()=>{
        document.title='TCiD Center | Ajouter un devoir'
      })

      useEffect(() => {
        window.scrollTo(0, 0)
      }, [])

      const [assignmentData,setAssignmentData]=useState({
        title:'',
        detail:''
      });

      const handleChange=(event)=>{
        setAssignmentData({
            ...assignmentData,
            [event.target.name]:event.target.value
        });
      }

      const {student_id}=useParams();
      const {teacher_id}=useParams();
      const navigate = useNavigate()
      const [targetType, setTargetType] = useState('student')
      const [groups, setGroups] = useState([])
      const [groupId, setGroupId] = useState('')
      const [formError, setFormError] = useState('')

      useEffect(() => {
        axios.get(`${baseUrl}/groups/`, { params: { teacher_id } })
          .then((response) => setGroups(response.data))
          .catch((error) => console.error('Impossible de charger les groupes :', error.response?.data || error))
      }, [teacher_id])

      const formSubmit=async (event)=>{
        event.preventDefault()
        setFormError('')
        if (targetType === 'group') {
          if (!groupId) {
            setFormError('Choisissez un groupe dont vous êtes membre.')
            return
          }
          try {
            const response = await axios.post(`${baseUrl}/groups/${groupId}/assignments/`, {
              teacher_id,
              title: assignmentData.title,
              detail: DOMPurify.sanitize(assignmentData.detail),
            })
            Swal.fire({
              title: `Devoir envoyé à ${response.data.created} étudiant(s) du groupe.`,
              icon: 'success',
              toast: true,
              timer: 3000,
              position: 'top-right',
              timerProgressBar: true,
              showConfirmButton: false,
            })
            navigate('/groups')
          } catch (error) {
            console.error('Impossible d’envoyer le devoir au groupe :', error.response?.data || error)
            setFormError(error.response?.data?.detail || 'Impossible d’envoyer le devoir au groupe.')
          }
          return
        }

        const _formData=new FormData();
        _formData.append('teacher',teacher_id);
        _formData.append('title',assignmentData.title);
        _formData.append('detail',DOMPurify.sanitize(assignmentData.detail));
        _formData.append('student',student_id);

        try{
            await axios.post(baseUrl+'/student-assignment/'+teacher_id+'/'+student_id,_formData,{
                headers: {
                    'content-type':'multipart/form-data'
                }
            })
            .then((res)=>{
                if(res.status === 200 || res.status === 201){
                    Swal.fire({
                        title:'Devoir ajouté avec succès !',
                        icon:'success',
                        toast:true,
                        timer:3000,
                        position:'top-right',
                        timerProgressBar: true,
                        showConfirmButton: false
                    });
                }
            });
        }catch(error){
            console.error('Impossible d’ajouter le devoir :', error.response?.data || error)
            setFormError('Impossible d’ajouter le devoir.')
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
                <h3 className='card-header'>Ajouter un devoir</h3>
                <form className='card-body' onSubmit={formSubmit}>
                     <div className="mb-3">
                        <label htmlFor="assignment-target" className="form-label">Destinataire</label>
                        <select className="form-select" id="assignment-target" value={targetType} onChange={(event) => setTargetType(event.target.value)}>
                            <option value="student">Étudiant sélectionné</option>
                            <option value="group" disabled={!groups.length}>Un de mes groupes</option>
                        </select>
                    </div>
                    {targetType === 'group' && <div className="mb-3">
                        <label htmlFor="assignment-group" className="form-label">Groupe</label>
                        <select className="form-select" id="assignment-group" required value={groupId} onChange={(event) => setGroupId(event.target.value)}>
                            <option value="">— Choisir un groupe —</option>
                            {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                        </select>
                        <small className="form-text text-muted">Le devoir sera envoyé à tous les étudiants membres; les enseignants ne le reçoivent pas comme devoir étudiant.</small>
                    </div>}
                     <div className="mb-3">
                        <label htmlFor="title" className="form-label">Titre</label>
                        <input type="text" id="title" required value={assignmentData.title} onChange={handleChange} name='title' className="form-control"/>
                    </div>
                    <div className="mb-3">
                        <label htmlFor="description" className="form-label">Consignes</label>
                        <div id="description" className="assignment-rich-editor">
                            <RichTextEditor value={assignmentData.detail} onChange={(detail) => setAssignmentData((current) => ({ ...current, detail }))} placeholder="Rédigez les consignes du devoir…" />
                        </div>
                    </div>
                    {formError && <div className="alert alert-danger" role="alert">{formError}</div>}
                    <button type="submit" className="btn btn-primary">Enregistrer</button>
                </form>
            </div>
        </section>
    </div>
    </div>
  )
}

export default AddAssignment
