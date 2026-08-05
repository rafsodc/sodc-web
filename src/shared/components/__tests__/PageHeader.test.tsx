import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../../test-utils';
import PageHeader from '../PageHeader';

describe('PageHeader', () => {
  it('should render title', () => {
    render(<PageHeader title="Test Page" />);

    expect(screen.getByText('Test Page')).toBeInTheDocument();
  });

  it('should not render a back button', () => {
    render(<PageHeader title="Test Page" />);

    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument();
  });

  it('should not render an admin button when no admin action is provided', () => {
    render(<PageHeader title="Test Page" />);

    expect(screen.queryByRole('button', { name: /admin/i })).not.toBeInTheDocument();
  });

  it('should not render an admin button when the admin action is not visible', () => {
    render(<PageHeader title="Test Page" adminAction={{ visible: false, onClick: vi.fn() }} />);

    expect(screen.queryByRole('button', { name: /admin/i })).not.toBeInTheDocument();
  });

  it('should render admin action when visible', () => {
    const onAdminClick = vi.fn();

    render(<PageHeader title="Test Page" adminAction={{ visible: true, onClick: onAdminClick }} />);

    expect(screen.getByRole('button', { name: /admin/i })).toBeInTheDocument();
  });

  it('should call admin action when admin button is clicked', async () => {
    const onAdminClick = vi.fn();
    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();

    render(<PageHeader title="Test Page" adminAction={{ visible: true, onClick: onAdminClick }} />);

    await user.click(screen.getByRole('button', { name: /admin/i }));

    expect(onAdminClick).toHaveBeenCalledTimes(1);
  });
});
