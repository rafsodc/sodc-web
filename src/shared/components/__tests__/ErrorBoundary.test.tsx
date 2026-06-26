import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "../ErrorBoundary";

// Suppress React's console.error output for expected boundary errors
const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

beforeEach(() => {
  consoleError.mockClear();
});

function Boom({ message }: { message: string }): never {
  throw new Error(message);
}

function BoomNoMessage(): never {
  throw new Error();
}

function Fine() {
  return <div>All good</div>;
}

describe("ErrorBoundary", () => {
  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary title="Test Page" onBack={vi.fn()}>
        <Fine />
      </ErrorBoundary>
    );

    expect(screen.getByText("All good")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("renders error UI when a child throws", () => {
    render(
      <ErrorBoundary title="Test Page" onBack={vi.fn()}>
        <Boom message="Test explosion" />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Test explosion")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reload page/i })).toBeInTheDocument();
  });

  it("shows the page title in the error state", () => {
    render(
      <ErrorBoundary title="My Feature Page" onBack={vi.fn()}>
        <Boom message="Oops" />
      </ErrorBoundary>
    );

    expect(screen.getByText("My Feature Page")).toBeInTheDocument();
  });

  it("shows fallback message when error has no message", () => {
    render(
      <ErrorBoundary title="Test" onBack={vi.fn()}>
        <BoomNoMessage />
      </ErrorBoundary>
    );

    expect(screen.getByText("An unexpected error occurred")).toBeInTheDocument();
  });

  it("calls window.location.reload when Reload Page is clicked", () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: { reload: reloadMock },
      writable: true,
    });

    render(
      <ErrorBoundary title="Test Page" onBack={vi.fn()}>
        <Boom message="Crash" />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByRole("button", { name: /reload page/i }));

    expect(reloadMock).toHaveBeenCalledOnce();
  });

  it("logs error details via componentDidCatch", () => {
    render(
      <ErrorBoundary title="Test" onBack={vi.fn()}>
        <Boom message="Logged error" />
      </ErrorBoundary>
    );

    expect(consoleError).toHaveBeenCalled();
  });
});
