import { render, screen } from '@testing-library/react';
import { TagBadge } from '../TagBadge';

describe('TagBadge', () => {
  describe('Regular tags', () => {
    it('renders tag text correctly', () => {
      render(<TagBadge tag="test-tag" />);
      expect(screen.getByText('test-tag')).toBeInTheDocument();
    });

    it('renders with icon by default', () => {
      render(<TagBadge tag="test-tag" />);
      // Check if the Tag icon is present (it should have the lucide-react tag icon)
      const iconElement = document.querySelector('svg');
      expect(iconElement).toBeInTheDocument();
    });

    it('renders without icon when showIcon is false', () => {
      render(<TagBadge tag="test-tag" showIcon={false} />);
      // Should not have any SVG elements when showIcon is false
      const iconElement = document.querySelector('svg');
      expect(iconElement).not.toBeInTheDocument();
    });

    it('applies correct size classes', () => {
      const { rerender } = render(<TagBadge tag="test-tag" size="sm" />);
      let badgeElement = screen.getByText('test-tag').closest('span');
      expect(badgeElement).toHaveClass('text-xs', 'px-2', 'py-0.5');

      rerender(<TagBadge tag="test-tag" size="md" />);
      badgeElement = screen.getByText('test-tag').closest('span');
      expect(badgeElement).toHaveClass('text-sm', 'px-2.5', 'py-1');

      rerender(<TagBadge tag="test-tag" size="lg" />);
      badgeElement = screen.getByText('test-tag').closest('span');
      expect(badgeElement).toHaveClass('text-base', 'px-3', 'py-1.5');
    });

    it('applies custom className', () => {
      render(<TagBadge tag="test-tag" className="custom-class" />);
      const badgeElement = screen.getByText('test-tag').closest('span');
      expect(badgeElement).toHaveClass('custom-class');
    });

    it('has correct base styling', () => {
      render(<TagBadge tag="test-tag" />);
      const badgeElement = screen.getByText('test-tag').closest('span');
      expect(badgeElement).toHaveClass(
        'inline-flex',
        'items-center',
        'gap-1',
        'bg-primary',
        'text-primary-foreground',
        'border',
        'border-primary',
        'rounded-full',
        'font-medium'
      );
    });
  });

  describe('Composite tags (with :: separator)', () => {
    it('renders composite tag as two separate badges', () => {
      render(<TagBadge tag="games::played" />);
      expect(screen.getByText('games')).toBeInTheDocument();
      expect(screen.getByText('played')).toBeInTheDocument();
    });

    it('applies correct styling to category badge (primary theme)', () => {
      render(<TagBadge tag="games::played" />);
      const categoryBadge = screen.getByText('games').closest('span');
      expect(categoryBadge).toHaveClass(
        'bg-primary',
        'text-primary-foreground',
        'border-primary',
        'rounded-l-full'
      );
    });

    it('applies correct styling to value badge (secondary theme)', () => {
      render(<TagBadge tag="games::played" />);
      const valueBadge = screen.getByText('played').closest('span');
      expect(valueBadge).toHaveClass(
        'bg-secondary',
        'text-secondary-foreground',
        'border-secondary',
        'rounded-r-full',
        'border-l-0'
      );
    });

    it('shows icon only on category badge for composite tags', () => {
      render(<TagBadge tag="games::played" />);
      const svgElements = document.querySelectorAll('svg');
      expect(svgElements).toHaveLength(1); // Only one icon should be present
      
      const categoryBadge = screen.getByText('games').closest('span');
      const iconInCategory = categoryBadge?.querySelector('svg');
      expect(iconInCategory).toBeInTheDocument();
    });

    it('does not show icon on value badge for composite tags', () => {
      render(<TagBadge tag="games::played" />);
      const valueBadge = screen.getByText('played').closest('span');
      const iconInValue = valueBadge?.querySelector('svg');
      expect(iconInValue).not.toBeInTheDocument();
    });

    it('applies size classes to both badges in composite tags', () => {
      render(<TagBadge tag="games::played" size="md" />);
      const categoryBadge = screen.getByText('games').closest('span');
      const valueBadge = screen.getByText('played').closest('span');
      
      expect(categoryBadge).toHaveClass('text-sm', 'px-2.5', 'py-1');
      expect(valueBadge).toHaveClass('text-sm', 'px-2.5', 'py-1');
    });

    it('applies custom className to container div for composite tags', () => {
      render(<TagBadge tag="games::played" className="custom-class" />);
      const container = screen.getByText('games').closest('div');
      expect(container).toHaveClass('custom-class');
    });

    it('handles multiple :: separators by splitting only on first occurrence', () => {
      render(<TagBadge tag="category::sub::value" />);
      expect(screen.getByText('category')).toBeInTheDocument();
      expect(screen.getByText('sub::value')).toBeInTheDocument();
    });

    it('renders as a single plain badge when the category is empty', () => {
      // "::value" has nothing before the separator, so it isn't a valid
      // scoped tag (see tagRules.parseTag) and falls back to a single
      // badge showing the literal text, instead of a badge with a blank
      // category pill.
      render(<TagBadge tag="::value" />);
      expect(screen.getByText('::value')).toBeInTheDocument();
      expect(screen.queryByText('value')).not.toBeInTheDocument();
    });

    it('renders as a single plain badge when the value is empty', () => {
      // "category::" has nothing after the separator, so it isn't a valid
      // scoped tag and falls back to a single badge showing the literal
      // text, instead of a badge with a blank value pill.
      render(<TagBadge tag="category::" />);
      expect(screen.getByText('category::')).toBeInTheDocument();
      expect(screen.queryByText('category')).not.toBeInTheDocument();
    });
  });
});
