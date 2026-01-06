import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../../test-utils';
import userEvent from '@testing-library/user-event';
import PaginationDisplay from '../PaginationDisplay';

describe('PaginationDisplay', () => {
  it('should not render when totalPages is 1', () => {
    const onChange = vi.fn();
    const { container } = render(
      <PaginationDisplay page={1} totalPages={1} onChange={onChange} />
    );
    
    expect(container.firstChild).toBeNull();
  });

  it('should render pagination when totalPages > 1', () => {
    const onChange = vi.fn();
    render(<PaginationDisplay page={1} totalPages={5} onChange={onChange} />);
    
    // MUI Pagination renders as a nav element
    const pagination = screen.getByRole('navigation');
    expect(pagination).toBeInTheDocument();
  });

  it('should call onChange when page changes', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    
    render(<PaginationDisplay page={1} totalPages={5} onChange={onChange} />);
    
    // Find and click next page button
    const nextButton = screen.getByLabelText(/go to page 2/i);
    await user.click(nextButton);
    
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('should display current page', () => {
    const onChange = vi.fn();
    render(<PaginationDisplay page={3} totalPages={5} onChange={onChange} />);
    
    const pagination = screen.getByRole('navigation');
    expect(pagination).toBeInTheDocument();
  });
});

