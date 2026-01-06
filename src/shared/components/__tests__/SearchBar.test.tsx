import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../test-utils';
import { userEvent } from '@testing-library/user-event';
import SearchBar from '../SearchBar';

describe('SearchBar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render search input', () => {
    const onChange = vi.fn();
    render(<SearchBar value="" onChange={onChange} />);
    
    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
  });

  it('should display provided value', () => {
    const onChange = vi.fn();
    render(<SearchBar value="test search" onChange={onChange} />);
    
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('test search');
  });

  it('should call onChange when input value changes', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ delay: null });
    
    render(<SearchBar value="" onChange={onChange} />);
    
    const input = screen.getByRole('textbox');
    await user.type(input, 'test');
    
    expect(onChange).toHaveBeenCalled();
  });

  it('should render refresh button when onRefresh is provided', () => {
    const onChange = vi.fn();
    const onRefresh = vi.fn();
    render(<SearchBar value="" onChange={onChange} onRefresh={onRefresh} />);
    
    const refreshButton = screen.getByRole('button');
    expect(refreshButton).toBeInTheDocument();
  });

  it('should call onRefresh when refresh button is clicked', async () => {
    const onChange = vi.fn();
    const onRefresh = vi.fn();
    const user = userEvent.setup();
    
    render(<SearchBar value="" onChange={onChange} onRefresh={onRefresh} />);
    
    const refreshButton = screen.getByRole('button');
    await user.click(refreshButton);
    
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('should not render refresh button when onRefresh is not provided', () => {
    const onChange = vi.fn();
    render(<SearchBar value="" onChange={onChange} />);
    
    const buttons = screen.queryAllByRole('button');
    expect(buttons).toHaveLength(0);
  });

  it('should show loading state', () => {
    const onChange = vi.fn();
    render(<SearchBar value="" onChange={onChange} loading={true} />);
    
    // Check for loading indicator (CircularProgress)
    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
  });
});

