import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import axios from 'axios'
import Home from './Home'

jest.mock('axios', () => ({
  get: jest.fn(),
}))

test('renders popular courses returned as direct course records', async () => {
  axios.get.mockImplementation((url) => {
    if (url.includes('/popular-courses/')) {
      return Promise.resolve({
        data: {
          results: [{
            id: 42,
            title: 'Formation la plus suivie',
            featured_img: '/formation.jpg',
            teacher: { full_name: 'Formateur test' },
            course_rating: null,
            total_enrolled_students: 12,
          }],
        },
      })
    }
    if (url.includes('/popular-teachers/')) return Promise.resolve({ data: [] })
    return Promise.resolve({ data: { results: [] } })
  })

  render(<MemoryRouter><Home /></MemoryRouter>)

  const popularCourseLinks = await screen.findAllByRole('link', { name: 'Formation la plus suivie' })
  expect(popularCourseLinks).toHaveLength(2)
  popularCourseLinks.forEach((link) => expect(link).toHaveAttribute('href', '/detail/42'))
  expect(screen.getByText('12')).toBeInTheDocument()
})