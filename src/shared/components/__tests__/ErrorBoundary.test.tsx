import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "../ErrorBoundary";

// Suppress React's console.error output for expected boundary errors
const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

beforeEach(() => {
  consoleError.mockClear();
});

function Boom({ message }: { message: string }): never {
  throw new Error(message);
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

  it("renders safe error UI without exposing the thrown message", () => {
    render(
      <ErrorBoundary onBack={vi.fn()}>
        <Boom message="Test explosion" />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.queryByText("Test explosion")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload page" })).toBeInTheDocument();
  });

  it("shows the page title in the error state", () => {
    render(
      <ErrorBoundary title="My Feature Page" onBack={vi.fn()}>
        <Boom message="Oops" />
      </ErrorBoundary>
    );

    expect(screen.getByRole("heading", { name: "My Feature Page" })).toBeInTheDocument();
  });

  it("offers configured back and home recovery actions", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onHome = vi.fn();
    render(
      <ErrorBoundary title="Test" onBack={onBack} onHome={onHome}>
        <Boom message="Crash" />
      </ErrorBoundary>
    );

    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: "Home" }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(onHome).toHaveBeenCalledOnce();
  });

  it("calls the configured reload action", async () => {
    const user = userEvent.setup();
    const onReload = vi.fn();

    render(
      <ErrorBoundary title="Test Page" onReload={onReload}>
        <Boom message="Crash" />
      </ErrorBoundary>
    );

    await user.click(screen.getByRole("button", { name: "Reload page" }));

    expect(onReload).toHaveBeenCalledOnce();
  });

  it("can recover by retrying after a transient render failure", async () => {
    const user = userEvent.setup();
    let shouldThrow = true;
    function Transient() {
      if (shouldThrow) throw new Error("temporary detail");
      return <Fine />;
    }

    render(
      <ErrorBoundary>
        <Transient />
      </ErrorBoundary>
    );
    shouldThrow = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("clears stale failure state when the reset key changes", () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="first">
        <Boom message="route failure" />
      </ErrorBoundary>
    );

    rerender(
      <ErrorBoundary resetKey="second">
        <Fine />
      </ErrorBoundary>
    );

    expect(screen.getByText("All good")).toBeInTheDocument();
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
