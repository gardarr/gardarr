import { render, screen, fireEvent } from '@testing-library/react';
import { ListFilter } from '../ListFilter';

function openDropdown() {
  fireEvent.click(screen.getByRole('button', { name: /filtrar por/i }));
}

describe('ListFilter', () => {
  it('renders a flat list when groupByScope is false', () => {
    render(
      <ListFilter
        label="tags"
        availableItems={['movies', 'quality::4k', 'quality::1080p']}
        selectedItems={new Set()}
        onToggleItem={() => {}}
        onSetAll={() => {}}
      />
    );
    openDropdown();

    expect(screen.getByText('movies')).toBeInTheDocument();
    expect(screen.getByText('quality::4k')).toBeInTheDocument();
    // No scope heading should appear without groupByScope
    expect(screen.queryByText('quality')).not.toBeInTheDocument();
  });

  it('renders a flat list when groupByScope is true but nothing is scoped', () => {
    render(
      <ListFilter
        label="tags"
        availableItems={['movies', 'music']}
        selectedItems={new Set()}
        onToggleItem={() => {}}
        onSetAll={() => {}}
        groupByScope={true}
      />
    );
    openDropdown();

    expect(screen.getByText('movies')).toBeInTheDocument();
    expect(screen.getByText('music')).toBeInTheDocument();
  });

  it('groups scoped tags under a scope heading, with a separate section for the rest', () => {
    render(
      <ListFilter
        label="tags"
        availableItems={['quality::4k', 'quality::1080p', 'genre::action', 'movies']}
        selectedItems={new Set()}
        onToggleItem={() => {}}
        onSetAll={() => {}}
        useTagBadge={true}
        groupByScope={true}
      />
    );
    openDropdown();

    // Scope headings appear once each, in addition to one TagBadge key
    // half per item under that scope: "quality" has two items (4k,
    // 1080p) plus its heading = 3 nodes; "genre" has one item (action)
    // plus its heading = 2 nodes.
    expect(screen.getAllByText('quality')).toHaveLength(3);
    expect(screen.getAllByText('genre')).toHaveLength(2);

    // Both quality values are listed (rendered as split TagBadge halves)
    expect(screen.getByText('4k')).toBeInTheDocument();
    expect(screen.getByText('1080p')).toBeInTheDocument();
    expect(screen.getByText('action')).toBeInTheDocument();

    // The plain tag falls into the leftover "other" section
    expect(screen.getByText('movies')).toBeInTheDocument();
  });

  it('calls onToggleItem with the full tag name when a grouped option is clicked', () => {
    const onToggleItem = vi.fn();
    render(
      <ListFilter
        label="tags"
        availableItems={['quality::4k']}
        selectedItems={new Set()}
        onToggleItem={onToggleItem}
        onSetAll={() => {}}
        groupByScope={true}
      />
    );
    openDropdown();

    fireEvent.click(screen.getByText('quality::4k').closest('button')!);
    expect(onToggleItem).toHaveBeenCalledWith('quality::4k');
  });
});
