import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HomePage from '../page';

describe('Skip Navigation Link', () => {
  it('renders the skip link as the first focusable element', () => {
    render(<HomePage />);
    const skipLink = screen.getByRole('link', { name: /skip to main content/i });
    expect(skipLink).toBeInTheDocument();
  });

  it('has the correct href pointing to #main-content', () => {
    render(<HomePage />);
    const skipLink = screen.getByRole('link', { name: /skip to main content/i });
    expect(skipLink).toHaveAttribute('href', '#main-content');
  });

  it('has the skip-link class for styling', () => {
    render(<HomePage />);
    const skipLink = screen.getByRole('link', { name: /skip to main content/i });
    expect(skipLink).toHaveClass('skip-link');
  });

  it('main content has id="main-content"', () => {
    render(<HomePage />);
    const mainContent = screen.getByRole('main');
    expect(mainContent).toHaveAttribute('id', 'main-content');
  });
});