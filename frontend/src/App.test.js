import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./Components/Main', () => () => 'Main component loaded');

test('renders the application routes', () => {
  render(<App />);
  expect(screen.getByText('Main component loaded')).toBeInTheDocument();
});
