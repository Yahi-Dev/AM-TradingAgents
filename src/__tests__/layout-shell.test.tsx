import React from 'react';
import { render, screen } from '@testing-library/react';
import Shell from '@/components/layout/Shell';
import Rail from '@/components/layout/Rail';
import Topbar from '@/components/layout/Topbar';

describe('Layout Shell', () => {
  it('renders rail with logo and 6 nav icons', () => {
    render(<Shell />);
    expect(screen.getByTestId('rail')).toBeInTheDocument();
    expect(screen.getByTestId('rail-logo')).toBeInTheDocument();
    const navButtons = screen.getAllByRole('button');
    expect(navButtons).toHaveLength(6);
  });

  it('renders topbar with breadcrumb and indicators', () => {
    render(<Shell />);
    expect(screen.getByTestId('topbar')).toBeInTheDocument();
    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
    expect(screen.getByTestId('system-indicators')).toBeInTheDocument();
  });

  it('applies design tokens via CSS variables', () => {
    const { container } = render(<Shell />);
    const shell = container.querySelector('[data-testid="shell"]');
    expect(shell).toHaveStyle({ background: 'var(--bg-0)' });
  });

  it('navigates without full page reload', () => {
    const onNavigate = jest.fn();
    render(<Shell onNavigate={onNavigate} />);
    const ordersBtn = screen.getByTestId('nav-orders');
    ordersBtn.click();
    expect(onNavigate).toHaveBeenCalledWith('orders');
  });
});