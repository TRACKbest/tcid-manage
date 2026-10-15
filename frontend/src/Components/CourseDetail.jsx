import React from 'react'
import DOMPurify from 'dompurify'
import { useParams } from 'react-router-dom'
import { Link } from 'react-router-dom';
import { useEffect } from 'react'
import { useState } from 'react'
import Swal from 'sweetalert2'
import axios from 'axios'
import './main.css'
import './style.css'
import './bootstrap.min.css'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'
const siteUrl = process.env.REACT_APP_SITE_URL || 'http://127.0.0.1:8000/'

const CourseDetail = () => {

    let {course_id}=useParams();

    const [courseData, setCourseData]=useState([]);
    const [chapterData, setChapterData]=useState([]);
    const [teacherData, setTeacherData]=useState([]);
    const [relatedCourseData, setRelatedCourseData]=useState([]);
    const [userLoginStatus,setUserLoginStatus]=useState([])
    const [enrolledStatus,setEnrolledStatus]=useState([])
    const [ratingStatus,setRatingStatus]=useState([])
    const [favoriteStatus,setFavoriteStatus]=useState([])
    const [courseViews,setCourseViews]=useState(0)
    const [avgRating,setAvgRating]=useState(0)
    const [ratingModalOpen,setRatingModalOpen]=useState(false)
    const [ratingSubmitting,setRatingSubmitting]=useState(false)
    const [ratingError,setRatingError]=useState('')
    const studentId=localStorage.getItem('studentId')

    useEffect(() => {
      window.scrollTo(0, 0)
    }, [])
    
    useEffect(() => {
      axios.get(`${baseUrl}/course/${course_id}`)
        .then((res) => {
          setChapterData(res.data.course_chapters)
          setTeacherData(res.data.teacher)
          setCourseData(res.data)
          setRelatedCourseData(JSON.parse(res.data.related_videos))
          if (res.data.course_rating !== '' && res.data.course_rating !== null) {
            setAvgRating(res.data.course_rating)
          }
        })
        .catch((error) => console.error(error))

      if (studentId) {
        axios.get(`${baseUrl}/update-view/${course_id}`, {
          params: { student_id: studentId }
        })
          .then((res) => setCourseViews(res.data.views))
          .catch((error) => console.error(error))
      }

      axios.get(`${baseUrl}/fetch-enroll-status/${studentId}/${course_id}`)
        .then((res) => setEnrolledStatus(res.data.status || ''))
        .catch((error) => console.error(error))

      axios.get(`${baseUrl}/fetch-rating-status/${studentId}/${course_id}`)
        .then((res) => {
          if (res.data.bool === true) {
            setRatingStatus('success')
          }
        })
        .catch((error) => console.error(error))

      if (studentId) {
        axios.get(`${baseUrl}/fetch-favorite-status/${studentId}/${course_id}`)
          .then((res) => setFavoriteStatus(res.data.bool === true ? 'success' : ''))
          .catch((error) => console.error(error))
      }

      if (localStorage.getItem('studentLoginStatus') === 'true') {
        setUserLoginStatus('success')
      }
    }, [course_id, studentId]);

    const enrollCourse = async () =>{
        const _formData=new FormData();
        _formData.append('course',course_id);
        _formData.append('student',studentId);

        try {
          const response = await axios.post(baseUrl+'/student-enroll-course/',_formData,{
                headers: {
                    'content-type':'multipart/form-data'
                }
            })
          setEnrolledStatus(response.data.status || 'pending')
          Swal.fire({
            title: 'Demande envoyée',
            text: 'Votre formateur doit approuver votre accès à la formation.',
            icon: 'success',
            toast: true,
            timer: 3000,
            position: 'top-right',
            timerProgressBar: true,
            showConfirmButton: false
            });
        } catch (error) {
          console.error('Could not request course enrollment:', error.response?.data || error)
          Swal.fire('Demande impossible', 'Vérifiez votre connexion puis réessayez.', 'error')
        }
    }

    const [ratingData,setRatingData]=useState({
      rating:'',
      reviews:''
    });

    const handleChange = (event) => {
      setRatingData({
        ...ratingData,
        [event.target.name]: event.target.value
      })
    }

    const formSubmit = async (event) => {
      event.preventDefault()
      if (!studentId || ratingSubmitting) return
      const rating = Number(ratingData.rating)
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        setRatingError('Choisissez une note entre 1 et 5.')
        return
      }

      setRatingSubmitting(true)
      setRatingError('')
      const formData = new FormData()
      formData.append('course', course_id)
      formData.append('student', studentId)
      formData.append('rating', String(rating))
      formData.append('reviews', ratingData.reviews)

      try {
        await axios.post(`${baseUrl}/course-rating/`, formData)
        setRatingStatus('success')
        setRatingModalOpen(false)
        axios.get(`${baseUrl}/course/${course_id}`)
          .then((response) => setAvgRating(response.data.course_rating ?? 0))
          .catch((error) => console.error('Could not refresh the course rating:', error.response?.data || error))
        Swal.fire({
          title: 'Votre évaluation a été enregistrée.',
          icon: 'success',
          toast: true,
          timer: 3000,
          position: 'top-right',
          timerProgressBar: true,
          showConfirmButton: false
        })
      } catch (error) {
        console.error('Course rating submission failed:', error.response?.data || error)
        setRatingError(error.response?.data?.detail || 'Votre évaluation n’a pas pu être envoyée. Vérifiez votre connexion puis réessayez.')
      } finally {
        setRatingSubmitting(false)
      }
    }

    const markAsFav = () => {
      const formData = new FormData()
      formData.append('course', course_id)
      formData.append('student', studentId)
      formData.append('status', true)

      axios.post(baseUrl + '/student-add-favorte-course/', formData, {
        headers: { 'content-type': 'multipart/form-data' }
      })
        .then((res) => {
          if (res.status === 200 || res.status === 201) {
            Swal.fire({
              title: 'Cours ajouté à vos favoris.',
              icon: 'success',
              toast: true,
              timer: 3000,
              position: 'top-right',
              timerProgressBar: true,
              showConfirmButton: false
            })
            setFavoriteStatus('success')
          }
        })
        .catch((error) => console.error(error))
    }

    const removeFav = () => {
      axios.get(`${baseUrl}/student-remove-favorite-course/${course_id}/${studentId}`)
        .then((res) => {
          if (res.status === 200 || res.status === 201) {
            Swal.fire({
              title: 'Cours retiré de vos favoris.',
              icon: 'success',
              toast: true,
              timer: 3000,
              position: 'top-right',
              timerProgressBar: true,
              showConfirmButton: false
            })
            setFavoriteStatus('')
          }
        })
        .catch((error) => console.error(error))
    }

    useEffect(() => {
      document.title = 'TCiD Center | Détails de la formation'
    }, []);
    const safeDescription = DOMPurify.sanitize(courseData.description || '')
    return (
      <div className='conatiner mt-4 px-4 hod'>
        <div className='row'>
          <div className="col-lg-3 col-md-6 mt-3">
            <div className="team-item bg-light">
              <div className="overflow-hidden">
                <img src={courseData.featured_img} className="card-img-top img-fluid img-thumbnail" alt={courseData.title} />
              </div>
            </div>
          </div>
            <div className='col-8 pd-2 mt-3'>
                <h3>{courseData.title}</h3>
                <div className="course-description-content" dangerouslySetInnerHTML={{ __html: safeDescription }} />
                <p className='fw-bold'>Formateur : <Link to={`/teacher-detail/${teacherData.id}`}>{teacherData.full_name}</Link></p>
                <p className='fw-bold'>Mots-clés :&nbsp;
                  <span className='text-warning'>{courseData.techs}</span>
                </p>
                <p className='fw-bold'>Apprenants inscrits &nbsp;<i class="bi bi-person-plus-fill text-info"></i> :&nbsp;{courseData.total_enrolled_students}</p> 
                <p className='fw-bold'>
                Note : {avgRating} / 5
                {enrolledStatus === 'approved' && userLoginStatus === 'success' &&
                <>
                {ratingStatus !== 'success' && 
                  <button className='btn btn-success btn-sm ms-2' onClick={() => { setRatingError(''); setRatingModalOpen(true) }} type="button">Évaluer</button>
                }
                {ratingStatus === 'success' && 
                  <span className='btn btn-success btn-sm ms-2 rounded-pill mt-2' >Vous avez déjà noté cette formation</span>   
                }
                  </>
                }  
                </p>
                {ratingModalOpen && (
                  <div className="modal d-block" role="presentation" onMouseDown={(event) => {
                    if (event.target === event.currentTarget && !ratingSubmitting) setRatingModalOpen(false)
                  }} style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
                    <div className="modal-dialog modal-lg" role="dialog" aria-modal="true" aria-labelledby="rating-modal-title">
                      <form className="modal-content" onSubmit={formSubmit}>
                        <div className="modal-header">
                          <h5 className="modal-title" id="rating-modal-title">Évaluer : {courseData.title}</h5>
                          <button type="button" className="btn-close" onClick={() => setRatingModalOpen(false)} aria-label="Fermer" disabled={ratingSubmitting}></button>
                        </div>
                        <div className="modal-body">
                          <div className="mb-3">
                            <label htmlFor="course-rating-value" className="form-label">Note</label>
                            <select id="course-rating-value" onChange={handleChange} value={ratingData.rating} className="form-control" name="rating" required>
                              <option value="">Choisir une note</option>
                              <option value="1">1 / 5</option>
                              <option value="2">2 / 5</option>
                              <option value="3">3 / 5</option>
                              <option value="4">4 / 5</option>
                              <option value="5">5 / 5</option>
                            </select>
                          </div>
                          <div className="mb-3">
                            <label htmlFor="course-rating-review" className="form-label">Votre avis (facultatif)</label>
                            <textarea id="course-rating-review" onChange={handleChange} value={ratingData.reviews} name="reviews" className="form-control" rows="6" />
                          </div>
                          {ratingError && <p className="text-danger" role="alert">{ratingError}</p>}
                        </div>
                        <div className="modal-footer">
                          <button type="button" className="btn btn-secondary" onClick={() => setRatingModalOpen(false)} disabled={ratingSubmitting}>Annuler</button>
                          <button type="submit" className="btn btn-primary" disabled={ratingSubmitting}>{ratingSubmitting ? 'Envoi…' : 'Envoyer l’évaluation'}</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
                <p className='fw-bold'>
                    Consultations : {courseViews}
                </p>
                {userLoginStatus === 'success' && enrolledStatus !== 'approved' && enrolledStatus !== 'pending' &&
                  <p><button type='button' className='btn btn-success rounded-pill ' onClick={enrollCourse}>Demander l’accès à la formation</button></p>
                }
                {enrolledStatus === 'pending' && userLoginStatus === 'success' &&
                  <p><span className='btn btn-warning rounded-pill btn-sm'>Demande en attente d’approbation</span></p>
                }
                {enrolledStatus === 'approved' && userLoginStatus === 'success' &&
                  <p><span className='btn btn-info rounded-pill btn-sm'>Accès à la formation approuvé</span></p>
                }
                {userLoginStatus === 'success' && favoriteStatus !== 'success' &&
                  <p><button type='button' onClick={markAsFav} title="Ajouter aux favoris" aria-label="Ajouter aux favoris" className='btn btn-outline-danger btn-sm'><i className='bi bi-heart'></i></button></p>
                }
                {userLoginStatus === 'success' && favoriteStatus === 'success' &&
                  <p><button type='button' onClick={removeFav} title="Retirer des favoris" aria-label="Retirer des favoris" className='btn btn-danger btn-sm'><i className='bi bi-heart-fill'></i></button></p>
                }
                {userLoginStatus !== 'success' && 
                    <p><Link to='/user-login' className='btn btn-danger rounded-pill'>Connectez-vous pour accéder à cette formation</Link></p>
                }
            </div>
        </div>
        {/* Course Videos*/}
      {userLoginStatus === 'success' && enrolledStatus === 'approved' &&
      <>
        <div className="card mt-4">
            <h5 className="card-header">
                Contenu de la formation
            </h5>
            <ul className="list-group list-group-flush">
            {chapterData.map((chapter,index) => (
              <li className="list-group-item" key={chapter.id}>{chapter.title}
              </li>
            ))}
            </ul>
        </div>
        <Link to={`/mini/${courseData.id}`} className='btn btn-sm bg-success mt-2 text-white'>Commencer</Link>
        <Link to={`/user/study-material/${courseData.id}`} className='btn btn-sm btn-primary mt-2 ms-2'>Documents de la formation</Link>
      </>
      }
        <h3 className=' pb-1 mb-4 mt-5'>Formations similaires</h3>
      <div className='row mb-4'>
      {relatedCourseData.map((rcourse,index) =>
        <div className='col-md-3 mb-4'>
          <div className="card">
            <Link target='_blank' to={`/detail/${rcourse.pk}`}><img src={`${siteUrl}media/${rcourse.fields.featured_img}`} className="card-img-top fadeInUp" height={200} alt={rcourse.fields.title}/></Link>
              <div className="card-body">
                <h5 className="card-title"><Link to={`/detail/${rcourse.pk}`}>{rcourse.fields.title}</Link></h5>
              </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

export default CourseDetail
