import React from 'react'
import TeacherSidebar from './TeacherSidebar'
import { useEffect } from 'react'
import { useState } from 'react'
import axios from 'axios'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const AddCourses = () => {
    useEffect(()=>{
        document.title='TCiD Center | Ajouter un cours'
      })

      const [cats,setCats]=useState([])
    const [errorMsg,setErrorMsg]=useState('')
    const [successMsg,setSuccessMsg]=useState('')
    const [isSubmitting,setIsSubmitting]=useState(false)
      
      const [courseData,setCourseData]=useState({
        category:'',
        title:'',
        description:'',
        f_img:'',
        techs:''
      });

      useEffect(()=>{
        const fetchCategories = async () => {
            try {
                const response = await axios.get(`${baseUrl}/category/`)
                setCats(response.data)
                if (response.data.length > 0) {
                    setCourseData(currentData => ({
                        ...currentData,
                        category: String(response.data[0].id)
                    }))
                }
            } catch (error) {
                console.error('Could not load course categories:', error.response?.data || error)
                setErrorMsg('Impossible de charger les catégories. Vérifiez que le serveur Django est démarré.')
            }
        }

        fetchCategories()
      },[]);

      const handleChange=(event)=>{
        setCourseData({
            ...courseData,
            [event.target.name]:event.target.value
        });
      }

      const handleFileChange=(event)=>{
        setCourseData({
            ...courseData,
            [event.target.name]:event.target.files[0]
        })
      }

      const formSubmit=async ()=>{
        const teacherId=localStorage.getItem('teacherId')
        if (!teacherId) {
            setErrorMsg('Connectez-vous avec un compte enseignant avant de créer un cours.')
            return
        }
        if (!courseData.category) {
            setErrorMsg('Ajoutez une catégorie dans l’administration Django, puis rechargez cette page.')
            return
        }
        if (!courseData.title.trim() || !courseData.description.trim() || !courseData.f_img) {
            setErrorMsg('Renseignez le titre, la description et une image du cours.')
            return
        }

        const _formData=new FormData();
        _formData.append('category',courseData.category);
        _formData.append('teacher',teacherId);
        _formData.append('title',courseData.title);
        _formData.append('description',courseData.description);
        _formData.append('featured_img',courseData.f_img);
        _formData.append('techs',courseData.techs);

        setIsSubmitting(true)
        setErrorMsg('')
        setSuccessMsg('')
        try {
            await axios.post(`${baseUrl}/course/`,_formData,{
                headers: {
                    'content-type':'multipart/form-data'
                }
            });
            setSuccessMsg('Cours ajouté. Il est maintenant visible dans sa catégorie.')
            setCourseData(currentData => ({
                ...currentData,
                title: '',
                description: '',
                f_img: '',
                techs: ''
            }))
        } catch (error) {
            console.error('Could not create course:', error.response?.data || error)
            setErrorMsg(error.response?.data
                ? JSON.stringify(error.response.data)
                : 'Impossible d’ajouter le cours. Vérifiez la connexion au serveur Django.')
        } finally {
            setIsSubmitting(false)
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
                <h3 className='card-header'><i class="bi bi-plus-square"></i> Ajouter un cours</h3>
                <div className='card-body'>
                {errorMsg && <div className="alert alert-danger" role="alert">{errorMsg}</div>}
                {successMsg && <div className="alert alert-success" role="status">{successMsg}</div>}
                <div className="mb-3">
                        <label for="title" className="form-label">Catégorie</label>
                        <select name='category' value={courseData.category} onChange={handleChange} className="form-control">
                            {cats.length === 0 && <option value="">Aucune catégorie disponible</option>}
                            {cats.map((category,index)=>{return <option key={index} value={category.id}>{category.title}</option>})}
                        </select>
                        {cats.length === 0 && <a href="http://127.0.0.1:8000/admin/main/coursecategory/add/" target="_blank" rel="noreferrer">Ajouter une catégorie dans l’administration</a>}
                    </div>
                    <div className="mb-3">
                        <label for="exampleInputPassword1" className="form-label">Titre</label>
                        <input type="text" onChange={handleChange} name='title' value={courseData.title} className="form-control"/>
                    </div>
                    <div className="mb-3">
                        <label for="exampleInputPassword1" className="form-label">Description</label>
                        <textarea onChange={handleChange} name='description' value={courseData.description} className='form-control' id='description'></textarea>
                    </div>
                    <div className="mb-3">
                        <label for="exampleInputPassword1" className="form-label">Image de couverture</label>
                        <input type="file" onChange={handleFileChange} name='f_img' className="form-control" accept="image/*"/>
                    </div>
                    <div className="mb-3">
                        <label for="exampleInputPassword1" className="form-label">Mots-clés</label>
                        <textarea onChange={handleChange} name='techs' value={courseData.techs} className='form-control' placeholder='Programmation, développement web…'></textarea>
                    </div>
                    <button type="button" onClick={formSubmit} className="btn btn-primary" disabled={isSubmitting || cats.length === 0}>{isSubmitting ? 'Enregistrement…' : 'Enregistrer'}</button>
                </div>
            </div>
        </section>
    </div>
  </div>
  )
}

export default  AddCourses
