import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PublicHomePage from "../PublicHomePage";

describe("PublicHomePage", () => {
  it("shows club intro and primary CTAs", () => {
    render(<PublicHomePage onJoinClick={vi.fn()} onLogInClick={vi.fn()} />);

    expect(screen.getByRole("heading", { name: /royal air force \| sodc/i })).toBeInTheDocument();
    expect(screen.getByText(/signal officers' dinner club/i)).toBeInTheDocument();
    expect(screen.getByText(/come together/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join SODC" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("calls join and log in handlers from CTAs", async () => {
    const user = userEvent.setup();
    const onJoinClick = vi.fn();
    const onLogInClick = vi.fn();

    render(<PublicHomePage onJoinClick={onJoinClick} onLogInClick={onLogInClick} />);

    await user.click(screen.getByRole("button", { name: "Join SODC" }));
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(onJoinClick).toHaveBeenCalledOnce();
    expect(onLogInClick).toHaveBeenCalledOnce();
  });
});
