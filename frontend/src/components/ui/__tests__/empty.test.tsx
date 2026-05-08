import { render, screen } from '@testing-library/react';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../empty';
import { Server } from 'lucide-react';

describe('Empty Component', () => {
  it('renders empty state with all components', () => {
    render(
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Server className="h-8 w-8 text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle>No workers available</EmptyTitle>
          <EmptyDescription>
            You need to register a worker before managing torrents.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <button>Add Worker</button>
        </EmptyContent>
      </Empty>
    );

    expect(screen.getByText('No workers available')).toBeInTheDocument();
    expect(screen.getByText('You need to register a worker before managing torrents.')).toBeInTheDocument();
    expect(screen.getByText('Add Worker')).toBeInTheDocument();
  });

  it('renders with default variant for EmptyMedia', () => {
    render(
      <Empty>
        <EmptyHeader>
          <EmptyMedia>
            <Server className="h-8 w-8 text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle>Test Title</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );

    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <Empty className="custom-class">
        <EmptyHeader>
          <EmptyTitle>Test</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });
});
