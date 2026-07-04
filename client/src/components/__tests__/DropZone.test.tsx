import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DropZone } from '../DropZone';

describe('DropZone', () => {
  it('renders with default text', () => {
    render(<DropZone onFiles={() => {}} />);
    expect(screen.getByText(/drop/i)).toBeInTheDocument();
  });

  it('renders with custom children', () => {
    render(<DropZone onFiles={() => {}}><span>custom content</span></DropZone>);
    expect(screen.getByText('custom content')).toBeInTheDocument();
  });
});
