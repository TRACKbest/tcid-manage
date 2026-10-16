import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useState } from 'react'
import axios from 'axios'
import Stars from './Stars'
import "react-responsive-carousel/lib/styles/carousel.min.css";
import { Carousel } from "react-responsive-carousel";
import './Header.css'
import wave from './darkside.mp4'
import './main.css'
import './search.css'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const Home = () => {
  const navigate = useNavigate()

  useEffect(()=>{
    document.title='TCiD Center'
  })

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const [courseData, setCourseData]=useState([]);
  const [popularcourseData,setPopularcourseData]=useState([]);
  const [popularteacherData,setPopularteacherData]=useState([]);
  const [testData,setTestData]=useState([]);

  useEffect(()=>{
    try{
        axios.get(baseUrl+'/course/?result=3')
        .then((res)=>{
            setCourseData(res.data.results)
        });
    }catch(error){
        console.log(error)
    }

    try{
      axios.get(baseUrl+'/popular-teachers/?popular=1')
      .then((res)=>{
        setPopularteacherData(res.data)
      });
  }catch(error){
      console.log(error)
  }

  try{
    axios.get(baseUrl+'/popular-courses/?popular=1')
    .then((res)=>{
      setPopularcourseData(res.data.results)
    });
}catch(error){
    console.log(error)
}

try{
  axios.get(baseUrl+'/student-test/')
  .then((res)=>{
    setTestData(res.data.results)
  });
}catch(error){
  console.log(error)
}
    
  },[]);

  const [searchString,setSearchString]=useState({
    'search':'',
  })

  const handleChange=(event)=>{
    setSearchString({
      ...searchString,
      [event.target.name]:event.target.value
    });
  }

  const handleSearchSubmit = (event) => {
    event.preventDefault()
    const query = searchString.search.trim()
    if (query) navigate(`/search/${encodeURIComponent(query)}`)
  }
  
  return (
    <>
      {/* Start Background video player*/}
    <section class="showcase">
    <video src={wave} autoPlay muted loop />
    <div class="overlay"></div>
    <div class="text">
      <h1 className='head'>Apprenez sans cesse.<br/>Progressez chaque jour.</h1>
      <h1 className='headss'>Apprenez avec nous !</h1>
      <p className='para'>Apprenez auprès des meilleurs formateurs. Maîtrisez les dernières tendances technologiques.</p>
    </div>
    </section>
      {/*  End Background video player*/}
      {/*  Start Features of meetLearning*/}
    <div class="container-xxl py-5" className='space'>
        <div class="container">
            <div class="row g-4">
                <div class="col-lg-3 col-sm-6 wow fadeInUp" data-wow-delay="0.1s">
                    <div class="service-item text-center pt-3">
                        <div class="p-4">
                            <i class="fa fa-3x fa-graduation-cap text-primary mb-4"></i>
                            <h5 class="mb-3">Formateurs qualifiés</h5>
                            <p>Un proverbe dit : <br/>« Si vous prévoyez pour un an, semez du riz ; pour dix ans, plantez des arbres ; pour toute une vie, instruisez les personnes. »</p>
                        </div>
                    </div>
                </div>
                <div class="col-lg-3 col-sm-6 wow fadeInUp" data-wow-delay="0.3s">
                    <div class="service-item text-center pt-3">
                        <div class="p-4">
                            <i class="fa fa-3x fa-globe text-primary mb-4"></i>
                            <h5 class="mb-3">Formations en ligne</h5>
                            <p>Pour apprendre efficacement, il faut rester engagé : lire, écouter, écrire, observer des démonstrations et mettre ses connaissances en pratique.</p>
                        </div>
                    </div>
                </div>
                <div class="col-lg-3 col-sm-6 wow fadeInUp" data-wow-delay="0.5s">
                    <div class="service-item text-center pt-3">
                        <div class="p-4">
                            <i class="fa fa-3x fa-home text-primary mb-4"></i>
                            <h5 class="mb-3">Des exercices pratiques</h5>
                            <p>Préparez votre avenir grâce à des exercices de qualité, conçus par les formateurs et couvrant les notions essentielles de chaque formation.</p>
                        </div>
                    </div>
                </div>
                <div class="col-lg-3 col-sm-6 wow fadeInUp" data-wow-delay="0.7s">
                    <div class="service-item text-center pt-3">
                        <div class="p-4">
                            <i class="fa fa-3x fa-book-open text-primary mb-4"></i>
                            <h5 class="mb-3">Des ressources pédagogiques</h5>
                            <p>Appuyez-vous sur des ressources de qualité et les conseils de vos formateurs pour atteindre vos objectifs et préparer vos examens.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
      {/*  End Features of meetLearning*/}
      {/*  About Us card */}
    <div class="container-xxl py-5">
        <div class="container">
            <div class="row g-5">
                <div class="col-lg-6 wow fadeInUp" data-wow-delay="0.1s" >
                    <div class="d-flex align-items-center h-100">
                        <img
                            className="img-fluid rounded-3 w-100"
                            src="/Etudiant.png"
                            alt="Étudiant du TCiD Center"
                            style={{ aspectRatio: '4 / 3', objectFit: 'cover' }}
                        />
                    </div>
                </div>
                <div class="col-lg-6 wow fadeInUp" data-wow-delay="0.3s">
                    <h6 class="section-title bg-white text-start text-primary pe-3">À propos de nous</h6>
                    <h1 class="mb-4">Bienvenue à TCiD Center</h1>
                    <p class="mb-4">Les apprenants apprennent mieux lorsqu’ils échangent, réfléchissent à ce qu’ils découvrent, font le lien avec leurs expériences et mettent leurs connaissances en pratique. L’apprentissage prend tout son sens lorsqu’il s’intègre à leur quotidien.</p>
                    <p class="mb-4">Au TCiD Center, nous créons des formations en ligne stimulantes qui donnent envie d’apprendre, de développer de nouvelles compétences et de progresser.</p>
                    <div class="row gy-2 gx-4 mb-4"> 
                        <div class="col-sm-6">
                            <p class="mb-0"><i class="fa fa-arrow-right text-primary me-2"></i>Formateurs qualifiés</p>
                        </div>
                        <div class="col-sm-6">
                            <p class="mb-0"><i class="fa fa-arrow-right text-primary me-2"></i>Formations en ligne</p>
                        </div>
                        <div class="col-sm-6">
                            <p class="mb-0"><i class="fa fa-arrow-right text-primary me-2"></i>Échanger avec les formateurs</p>
                        </div>
                        <div class="col-sm-6">
                            <p class="mb-0"><i class="fa fa-arrow-right text-primary me-2"></i>Ressources pédagogiques</p>
                        </div>
                        <div class="col-sm-6">
                            <p class="mb-0"><i class="fa fa-arrow-right text-primary me-2"></i>Exercices réguliers</p>
                        </div>
                        <div class="col-sm-6">
                            <p class="mb-0"><i class="fa fa-arrow-right text-primary me-2"></i>Apprentissage autonome</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
      {/*  About Us card */}
        <form class="input-box container" onSubmit={handleSearchSubmit}>
          <i class="bi bi-search text-info"></i>
          <input name='search' type="search" onChange={handleChange} placeholder="Rechercher…" aria-label="Rechercher" value={searchString.search} />
          <button className='button' type="submit">Rechercher</button>
        </form>

    <div className='container mt-4'>
      {/* Start Latest Courses*/}
    <div class="container-xxl py-5">
        <div class="container">
            <div class="text-center wow fadeInUp">
                <h6 class="section-title bg-white text-center text-primary px-3">Formations</h6>
                <h1 class="mb-5">Dernières formations</h1>
            </div>
            <div class="row g-4 justify-content-center">
            {courseData && courseData.map((course,index) =>
                <div class="col-lg-4 col-md-6 wow fadeInUp">
                    <div class="course-item bg-light">
                        <div class="position-relative overflow-hidden">
                        <Link to={`/detail/${course.id}`}><img src={course.featured_img} height={250}  className="card-img-top" alt={course.title} /></Link>                        </div>
                        <div class="text-center p-4 pb-0">
                            <h5 className="mb-4"><Link to={`/detail/${course.id}`}>{course.title}</Link></h5>
                        </div>
                        <div class="d-flex border-top">
                            <small class="flex-fill text-center border-end py-2"><i class="fa fa-user-tie text-primary me-2"></i>{course.teacher.full_name}</small>                            <small class="flex-fill text-center py-2"><i class="fa fa-user text-primary me-2"></i>{course.total_enrolled_students}</small>
                        </div>
                    </div>
                </div>
                )}
            </div>
        </div>
    </div>
    <div class="text-center">
    <button type="button" class="btn btn-primary border border-primary"><Link to='/all-courses'className='text-white' >Voir toutes les formations</Link></button>
    </div>
      {/* ENd Latest Courses*/}
      {/* popular Courses*/}
    <div class="container-xxl py-5">
        <div class="container">
            <div class="text-center wow fadeInUp">
                <h6 class="section-title bg-white text-center text-primary px-3">Formations</h6>
                <h1 class="mb-5">Formations populaires</h1>
            </div>
            <div class="row g-4 justify-content-center">
            {popularcourseData && popularcourseData.map((row,index)=>
                <div class="col-lg-4 col-md-6 wow fadeInUp">
                    <div class="course-item bg-light">
                        <div class="position-relative overflow-hidden">
                    <Link to={`/detail/${row.id}`}><img src={row.featured_img} height={250}  className="card-img-top" alt={row.title}/></Link>
                        </div>
                        <div class="text-center p-4 pb-0">
                    <h5 className="mb-4"><Link to={`/detail/${row.id}`}>{row.title}</Link></h5>
                        </div>
                        <div class="d-flex border-top">
                    <small class="flex-fill text-center border-end py-2"><i class="fa fa-user-tie text-primary me-2"></i>{row.teacher.full_name}</small>
                    <small class="flex-fill text-center border-end py-2"><Stars stars={row.course_rating}/></small>
                    <small class="flex-fill text-center py-2"><i class="fa fa-user text-primary me-2"></i>{row.total_enrolled_students}</small>
                        </div>
                    </div>
                </div>
                )}
            </div>
        </div>
    </div>
    <div class="text-center">
    <button type="button" class="btn btn-primary border border-primary"><Link to='/popular-courses' className='text-white'>Voir les formations populaires</Link></button>
    </div>
      {/* ENd Popular Courses*/}
      {/* Popular Teacher */}
    <div class="container-xxl py-5">
        <div class="container">
            <div class="text-center wow fadeInUp">
                <h6 class="section-title bg-white text-center text-primary px-3">Formateurs</h6>
                <h1 class="mb-5">Formateurs populaires</h1>
            </div>
            <div class="row g-4">
            {popularteacherData && popularteacherData.map((teacher,index)=>
                <div class="col-lg-3 col-md-6 wow fadeInUp" data-wow-delay="0.1s">
                    <div class="team-item bg-light">
                        <div class="overflow-hidden">
                          <Link className='front' to={`/teacher-detail/${teacher.id}`}><img src={teacher.profile_img} height={330} className="card-img-top" alt={teacher.full_name}/></Link>
                        </div>
                        <div class="position-relative d-flex justify-content-center">
                            <div class="bg-light d-flex justify-content-center pt-2 px-1 mt-1">
                            {teacher.insta_url &&
                              <a class="btn btn-sm-square btn-primary mx-1" href={teacher.insta_url}><i class="fab fa-instagram"></i></a>
                            }
                            {teacher.twit_url &&
                              <a class="btn btn-sm-square btn-primary mx-1" href={teacher.twit_url}><i class="fab fa-twitter"></i></a>
                            }
                            {teacher.face_url &&
                              <a class="btn btn-sm-square btn-primary mx-1" href={teacher.face_url}><i class="fab fa-facebook"></i></a>
                            }
                        </div>
                        </div>
                        <div class="text-center p-4">
                        <h4 className="card-title mb-0 "><Link to={`/teacher-detail/${teacher.id}`}>{teacher.full_name}</Link></h4>                            
                        <p className='mb-0'>{teacher.qualification}</p>
                        </div>
                    </div>
                </div>
            )}
            </div>
        </div>
    </div>
      {/* ENd Popular Teacher Courses*/}
      {/* Student Testimonial */}
    <div class="text-center wow fadeInUp">
                <h6 class="section-title bg-white text-center text-primary px-3">Leurs avis</h6>
                <h1 class="mb-5">Témoignages d’apprenants</h1>
        </div>
    <div>
      <Carousel
        showArrows={true}
        infiniteLoop={true}
        showThumbs={false}
        showStatus={false}
        autoPlay={true}
        interval={5500}
        showIndicators={false}
      >
      {testData && testData.map((row,i)=>
        <div>
            <img src={row.student.profile_img} alt={row.student.fullname} />
          <>
          <div className="myCarousel">
            <names>{row.course.fullname}</names>
            <titles>{row.course.title}</titles>
            <p>{row.reviews}</p>
            <span>--{row.student.fullname}</span>
          </div>
          </>
        </div>
        )}
      </Carousel>
    </div>
      {/* ENd Student Testimonial*/}
    </div>
    </>
  )
}

export default Home