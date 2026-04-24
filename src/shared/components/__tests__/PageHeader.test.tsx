import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../../test-utils';
import PageHeader, { PageHeaderAdminActionProvider } from '../PageHeader';

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

  it('should render admin action when provided', () => {
    const onBack = vi.fn();
    const onAdminClick = vi.fn();

    render(
      <PageHeaderAdminActionProvider value={{ visible: true, onClick: onAdminClick }}>
        <PageHeader title="Test Page" onBack={onBack} />
      </PageHeaderAdminActionProvider>
    );

    expect(screen.getByRole('button', { name: /admin/i })).toBeInTheDocument();
  });

  it('should call admin action when admin button is clicked', async () => {
    const onBack = vi.fn();
    const onAdminClick = vi.fn();
    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();

    render(
      <PageHeaderAdminActionProvider value={{ visible: true, onClick: onAdminClick }}>
        <PageHeader title="Test Page" onBack={onBack} />
      </PageHeaderAdminActionProvider>
    );

    await user.click(screen.getByRole('button', { name: /admin/i }));

    expect(onAdminClick).toHaveBeenCalledTimes(1);
  });

  it('should prefer page admin action over provider action', async () => {
    const onBack = vi.fn();
    const onProviderAdminClick = vi.fn();
    const onPageAdminClick = vi.fn();
    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();

    render(
      <PageHeaderAdminActionProvider value={{ visible: true, onClick: onProviderAdminClick }}>
        <PageHeader
          title="Test Page"
          onBack={onBack}
          adminAction={{ visible: true, onClick: onPageAdminClick }}
        />
      </PageHeaderAdminActionProvider>
    );

    await user.click(screen.getByRole('button', { name: /admin/i }));

    expect(onPageAdminClick).toHaveBeenCalledTimes(1);
    expect(onProviderAdminClick).not.toHaveBeenCalled();
  });
});

