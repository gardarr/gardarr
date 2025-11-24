import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { Toggle } from '../toggle';

describe('Toggle', () => {
  it('renders correctly', () => {
    render(<Toggle>Toggle Button</Toggle>);
    expect(screen.getByText('Toggle Button')).toBeInTheDocument();
  });

  it('handles pressed state', () => {
    const { rerender } = render(<Toggle pressed={false}>Toggle</Toggle>);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('data-state', 'off');

    rerender(<Toggle pressed={true}>Toggle</Toggle>);
    expect(button).toHaveAttribute('data-state', 'on');
  });

  it('calls onPressedChange when clicked', async () => {
    const handlePressedChange = vi.fn();
    const user = userEvent.setup();
    
    render(
      <Toggle onPressedChange={handlePressedChange}>
        Toggle Button
      </Toggle>
    );
    
    const button = screen.getByRole('button');
    await user.click(button);
    
    expect(handlePressedChange).toHaveBeenCalledTimes(1);
  });

  it('applies variant classes correctly', () => {
    const { rerender } = render(<Toggle variant="default">Toggle</Toggle>);
    let button = screen.getByRole('button');
    expect(button).toHaveClass('bg-transparent');

    rerender(<Toggle variant="outline">Toggle</Toggle>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('border', 'border-input');
  });

  it('applies size classes correctly', () => {
    const { rerender } = render(<Toggle size="default">Toggle</Toggle>);
    let button = screen.getByRole('button');
    expect(button).toHaveClass('h-10', 'px-3');

    rerender(<Toggle size="sm">Toggle</Toggle>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('h-9', 'px-2.5');

    rerender(<Toggle size="lg">Toggle</Toggle>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('h-11', 'px-5');

    rerender(<Toggle size="icon">Toggle</Toggle>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('h-10', 'w-10');
  });

  it('can be disabled', () => {
    render(<Toggle disabled>Toggle</Toggle>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveClass('disabled:pointer-events-none', 'disabled:opacity-50');
  });

  it('accepts custom className', () => {
    render(<Toggle className="custom-class">Toggle</Toggle>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  it('supports aria-label', () => {
    render(<Toggle aria-label="Toggle feature">Toggle</Toggle>);
    const button = screen.getByRole('button', { name: 'Toggle feature' });
    expect(button).toBeInTheDocument();
  });
});

