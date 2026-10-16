import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import axios from 'axios'
import MyTeachers from './MyTeachers'

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}))

test('shows all courses grouped under the teacher with one message action', async () => {
  localStorage.setItem('studentId', '19')
  axios.get.mockImplementation((url) => {
    if (url.includes('/fetch-my-teachers/')) {
      return Promise.resolve({
        data: [
          { id: 42, title: 'Python', teacher: { id: 7, full_name: 'Ada Lovelace', profile_img: '' } },
          { id: 43, title: 'Django', teacher: { id: 7, full_name: 'Ada Lovelace', profile_img: '' } },
        ],
      })
    }
    return Promise.resolve({ data: [] })
  })

  render(<MemoryRouter><MyTeachers /></MemoryRouter>)

  expect(await screen.findByRole('link', { name: 'Python' })).toHaveAttribute('href', '/detail/42')
  expect(screen.getByRole('link', { name: 'Django' })).toHaveAttribute('href', '/detail/43')
  expect(screen.getAllByRole('row')).toHaveLength(2)
  expect(screen.getByRole('button', { name: 'Ouvrir la conversation avec Ada Lovelace' }))
    .toHaveAttribute('data-bs-target', '#teacher-chat-modal-7')
})