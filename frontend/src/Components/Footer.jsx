import React from 'react'
import { Link } from 'react-router-dom';
import './Me.css'

const Footer = () => {
  return (
    <>
      <div className="container-fluid bg-dark text-light footer pt-5 mt-5 wow fadeIn" data-wow-delay="0.1s">
        <div className="container py-4">
            <div className="row g-5 justify-content-center">
                <div className="col-lg-4 col-md-6">
                    <h4 className="text-white mb-3">Liens utiles</h4>
                    <Link className="btn btn-link" to="/aboutus">À propos</Link>
                    <Link className="btn btn-link" to="/policy">Politique de confidentialité</Link>
                    <Link className="btn btn-link" to="/policy">Conditions d’utilisation</Link>
                    <Link className="btn btn-link" to="/faq">Questions et aide</Link>
                </div>
                <div className="col-lg-3 col-md-6">
                    <h4 className="text-white mb-3">Nous contacter</h4>
                    <p className="footer-contact-item mb-2">
                        <i className="fa fa-map-marker-alt" aria-hidden="true" />
                        <span>Ampitakely, Fianarantsoa, Madagascar</span>
                    </p>
                    <p className="footer-contact-item mb-2">
                        <i className="fa fa-phone-alt" aria-hidden="true" />
                        <a href="tel:+261346544539">+261 34 65 445 39</a>
                    </p>
                    <p className="footer-contact-item mb-2">
                        <i className="fa fa-envelope" aria-hidden="true" />
                        <a className="footer-email" href="mailto:tcid.centermadagascar@gmail.com">tcid.centermadagascar@gmail.com</a>
                    </p>
                    <div className="d-flex pt-2">
                        <a className="btn btn-outline-light btn-social" target="_blank" rel="noreferrer" href="https://twitter.com/home?lang=en" aria-label="Twitter"><i className="fab fa-twitter" aria-hidden="true" /><span className="visually-hidden">Twitter</span></a>
                        <a className="btn btn-outline-light btn-social" target="_blank" rel="noreferrer" href="https://www.facebook.com/" aria-label="Facebook"><i className="fab fa-facebook-f" aria-hidden="true" /><span className="visually-hidden">Facebook</span></a>
                        <a className="btn btn-outline-light btn-social" target="_blank" rel="noreferrer" href="https://www.youtube.com/channel/UCWBZgfmIVxElVuTxsboMGNg" aria-label="YouTube"><i className="fab fa-youtube" aria-hidden="true" /><span className="visually-hidden">YouTube</span></a>
                        <a className="btn btn-outline-light btn-social" target="_blank" rel="noreferrer" href="https://www.linkedin.com/feed/" aria-label="LinkedIn"><i className="fab fa-linkedin-in" aria-hidden="true" /><span className="visually-hidden">LinkedIn</span></a>
                    </div>
                </div>
            </div>
        </div>
        <div className="container">
            <div className="copyright">
                <div className="row align-items-center">
                    <div className="col-md-6 text-center text-md-start mb-3 mb-md-0">
                        <div className="footer-copyright-brand">
                            <span>&copy; 2026</span>
                            <Link className="footer-brand-link" to="/">
                                <img src="/tcid-center-logo.png" alt="" aria-hidden="true" />
                                <span>TCiD Center</span>
                            </Link>
                        </div>
                        <small className="footer-rights">Tous droits réservés.</small>
                    </div>
                    <div className="col-md-6 text-center text-md-end align-self-center">
                        <div className="footer-menu">
                          <Link to="/">Accueil</Link>
                          <Link to="/faq">Aide</Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="btn btn-lg btn-primary btn-lg-square back-to-top" aria-label="Retour en haut de page"><i className="bi bi-arrow-up" aria-hidden="true" /></button>

    </>
  )
}

export default Footer
