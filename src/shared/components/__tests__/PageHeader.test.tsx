import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../../test-utils';
import PageHeader from '../PageHeader';

describe('PageHeader', () => {
  it('should render title', () => {
    const onBack = vi.fn();
    render(<PageHeader title="Test Page" onBack={onBack} />);
    
    expect(screen.getByText('Test Page')).toBeInTheDocument();
  });

  it('should render back button', () => {
    const onBack = vi.fn();
    render(<PageHeader title="Test Page" onBack={onBack} />);
    
    const backButton = screen.getByRole('button', { name: /back/i });
    expect(backButton).toBeInTheDocument();
  });

  it('should call onBack when back button is clicked', async () => {
    const onBack = vi.fn();
    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();
    
    render(<PageHeader title="Test Page" onBack={onBack} />);
    
    const backButton = screen.getByRole('button', { name: /back/i });
    await user.click(backButton);
    
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

