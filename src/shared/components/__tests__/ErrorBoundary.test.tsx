import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "../ErrorBoundary";
import { installModuleLoadRecovery } from "../../appShell/moduleLoadRecovery";

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

  it("offers an explicit reload instead of retrying a failed lazy import", async () => {
    const user = userEvent.setup();
    const onReload = vi.fn();
    const onBack = vi.fn();
    function MissingModule(): never {
      throw new TypeError("Failed to fetch dynamically imported module: /assets/private-old.js");
    }
    render(<ErrorBoundary title="Page unavailable" onReload={onReload} onBack={onBack}>
      <MissingModule />
    </ErrorBoundary>);

    expect(screen.getByRole("heading", { name: "This page couldn’t load" })).toHaveFocus();
    expect(screen.getByText(/unsaved changes may be lost/i)).toBeInTheDocument();
    expect(screen.getByText(/check any recent save/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    expect(screen.queryByText(/private-old/)).not.toBeInTheDocument();
    expect(onReload).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(onReload).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Reload page" }));
    expect(onReload).toHaveBeenCalledOnce();
  });

  it("handles a Vite-reported CSS failure without displaying provider details", () => {
    const uninstall = installModuleLoadRecovery();
    const error = new Error("Unable to preload CSS: PRIVATE_TECHNICAL_DETAIL");
    const event = new Event("vite:preloadError", { cancelable: true });
    Object.assign(event, { payload: error });
    window.dispatchEvent(event);
    function MissingStyles(): never { throw error; }
    try {
      render(<ErrorBoundary><MissingStyles /></ErrorBoundary>);
      expect(screen.getByRole("button", { name: "Reload page" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
      expect(screen.queryByText(/PRIVATE_TECHNICAL_DETAIL/)).not.toBeInTheDocument();
      expect(event.defaultPrevented).toBe(false);
    } finally { uninstall(); }
  });

  it("retains ordinary retry for API failures and clears module-specific state on navigation", () => {
    function MissingModule(): never {
      throw new TypeError("Importing a module script failed.");
    }
    const { rerender } = render(<ErrorBoundary resetKey="old-route"><MissingModule /></ErrorBoundary>);
    rerender(<ErrorBoundary resetKey="new-route"><Boom message="Failed to fetch" /></ErrorBoundary>);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "This page couldn’t load" })).not.toBeInTheDocument();
  });
});
