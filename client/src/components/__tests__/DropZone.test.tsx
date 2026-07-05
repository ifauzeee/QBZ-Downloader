import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DropZone } from '../DropZone';

describe('DropZone', () => {
  it('renders with children', () => {
    render(<DropZone><span>drop zone content</span></DropZone>);
    expect(screen.getByText('drop zone content')).toBeInTheDocument();
  });

  it('renders the drop zone container', () => {
    const { container } = render(<DropZone><div>child</div></DropZone>);
    const firstChild = container.firstElementChild;
    expect(firstChild).toBeInTheDocument();
    expect(firstChild!.tagName).toBe('DIV');
  });
});
