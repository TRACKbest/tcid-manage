import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from './Header';

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

jest.mock('./confirmLogout', () => jest.fn());
import confirmLogout from './confirmLogout';

beforeEach(() => {
  localStorage.clear();
  confirmLogout.mockReset();
});

test('opens and closes the mobile navigation menu', () => {
  render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>,
  );

  const menuButton = screen.getByRole('button', { name: 'Ouvrir le menu de navigation' });
  const navigation = document.getElementById('navbarCollapse');

  expect(navigation).not.toHaveClass('show');
  fireEvent.click(menuButton);
  expect(screen.getByRole('button', { name: 'Fermer le menu de navigation' })).toHaveAttribute('aria-expanded', 'true');
  expect(navigation).toHaveClass('show');

  fireEvent.click(screen.getByRole('link', { name: /Accueil/ }));
  expect(navigation).not.toHaveClass('show');
});

test('opens the teacher account menu without Bootstrap JavaScript', () => {
  render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole('button', { name: /Formateur/ }));
  expect(screen.getAllByRole('link', { name: /Inscription/ })[0]).toHaveAttribute('href', '/teacher-register');
  expect(screen.getAllByRole('link', { name: /Connexion/ })[0]).toHaveAttribute('href', '/teacher-login');
  expect(screen.queryByText('Administration')).not.toBeInTheDocument();
});

test('keeps a teacher signed in when the styled logout confirmation is cancelled', async () => {
  localStorage.setItem('teacherLoginStatus', 'true');
  localStorage.setItem('teacherId', '7');
  confirmLogout.mockResolvedValue(false);

  render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole('button', { name: /Formateur/ }));
  fireEvent.click(screen.getByRole('link', { name: /Déconnexion/ }));

  expect(confirmLogout).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem('teacherLoginStatus')).toBe('true');
  expect(localStorage.getItem('teacherId')).toBe('7');
});
