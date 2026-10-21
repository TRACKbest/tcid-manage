import React from 'react'
import { formatAriary } from './format'

const style = {
  display: 'inline-block',
  marginTop: '0.35rem',
  padding: '0.2rem 0.65rem',
  borderRadius: '999px',
  fontSize: '0.78rem',
  fontWeight: 800,
}

const PriceTag = ({ course }) => (course?.price > 0
  ? <span className="course-price-tag" style={{ ...style, color: '#9a3412', background: '#ffedd5' }}>{formatAriary(course.price)} · 1re vidéo offerte</span>
  : <span className="course-price-tag" style={{ ...style, color: '#0f7a3a', background: '#dcfce7' }}>Gratuit</span>)

export default PriceTag
