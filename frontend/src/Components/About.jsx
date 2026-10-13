import React from 'react'


const About = () => {
  return (
    <>
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
                    <h6 class="section-title bg-white text-start text-primary pe-3">À propos</h6>
                    <h1 class="mb-4">Welcome to TCiD Center</h1>
                    <p class="mb-4">Les étudiants apprennent mieux lorsqu’ils échangent, réfléchissent à ce qu’ils découvrent, font le lien avec leurs expériences et mettent leurs connaissances en pratique. L’apprentissage prend tout son sens lorsqu’il s’intègre à leur quotidien.</p>
                    <p class="mb-4">Au TCiD Center, nous créons des cours en ligne stimulants qui donnent envie d’apprendre, de développer de nouvelles compétences et de progresser.</p>
                    <div class="row gy-2 gx-4 mb-4"> 
                        <div class="col-sm-6">
                            <p class="mb-0"><i class="fa fa-arrow-right text-primary me-2"></i>Enseignants qualifiés</p>
                        </div>
                        <div class="col-sm-6">
                            <p class="mb-0"><i class="fa fa-arrow-right text-primary me-2"></i>Cours en ligne</p>
                        </div>
                        <div class="col-sm-6">
                            <p class="mb-0"><i class="fa fa-arrow-right text-primary me-2"></i>Échangez avec les enseignants</p>
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
    </>
  )
}

export default About