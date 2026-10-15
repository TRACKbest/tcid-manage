import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from './Header';

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

beforeEach(() => {
  localStorage.clear();
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

  fireEvent.click(screen.getByRole('button', { name: /Enseignant/ }));
  expect(screen.getAllByRole('link', { name: /Inscription/ })[0]).toHaveAttribute('href', '/teacher-register');
  expect(screen.getAllByRole('link', { name: /Connexion/ })[0]).toHaveAttribute('href', '/teacher-login');
  expect(screen.queryByText('Administration')).not.toBeInTheDocument();
});
