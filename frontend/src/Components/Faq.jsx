import React from 'react'
import { useEffect } from 'react'
import { useState } from 'react'
import axios from 'axios'

const baseUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api'

const Faq = () => {
  const [openFaq, setOpenFaq] = useState(null)
  const [faqError, setFaqError] = useState('')

  useEffect(()=>{
    document.title='TCiD Center | Questions fréquentes'
  })

  const [faqData, setFaqData]=useState([]);

  useEffect(()=>{
    axios.get(baseUrl+'/faq/')
      .then((res) => setFaqData(res.data))
      .catch(() => setFaqError('Impossible de charger les questions fréquentes. Veuillez réessayer plus tard.'))
  },[]);

  return (
    <div className='container mt-4'>
    <h3 className=' pb-1 mb-4 mt-5'>Questions fréquentes</h3>
      {faqError && <div className="alert alert-danger" role="alert">{faqError}</div>}
      <div className="accordion" id="accordionExample">
      {faqData && faqData.map((row) =>
      <div className="accordion-item" key={row.id}>
      <h2 className="accordion-header" id={`faq-heading-${row.id}`}>
        <button
          className={`accordion-button ${openFaq === row.id ? '' : 'collapsed'}`}
          type="button"
          aria-expanded={openFaq === row.id}
          aria-controls={`faq-answer-${row.id}`}
          onClick={() => setOpenFaq(openFaq === row.id ? null : row.id)}
        >
          {row.question}
        </button>
      </h2>
        {openFaq === row.id && <div className="accordion-body" id={`faq-answer-${row.id}`}>{row.answer}</div>}
        </div>
      )}
    </div>
  </div>
  )
}

export default Faq