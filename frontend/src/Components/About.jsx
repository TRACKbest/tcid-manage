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
                            alt="À propos de TCiD Center"
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
                            <p class="mb-0"><i class="fa fa-arrow-right text-primary me-2"></i>Accéder aux supports de formation</p>
                        </div>
                        <div class="col-sm-6">
                            <p class="mb-0"><i class="fa fa-arrow-right text-primary me-2"></i>Exercices hebdomadaires</p>
                        </div>
                        <div class="col-sm-6">
                            <p class="mb-0"><i class="fa fa-arrow-right text-primary me-2"></i>Auto-formation</p>
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