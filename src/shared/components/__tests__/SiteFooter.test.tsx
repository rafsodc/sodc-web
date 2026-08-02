import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "../../../test-utils";
import CookieBanner from "../CookieBanner";
import CookieSettingsDialog from "../CookieSettingsDialog";
import SiteFooter from "../SiteFooter";

function clearCookies() {
  document.cookie.split(";").forEach((cookie) => {
    const name = cookie.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; max-age=0; path=/`;
  });
}

function mockSystemDarkMode(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function renderUtilities() {
  return render(
    <>
      <SiteFooter />
      <CookieBanner />
      <CookieSettingsDialog />
    </>
  );
}

describe("site footer and cookie controls", () => {
  beforeEach(() => {
    clearCookies();
    mockSystemDarkMode(false);
  });

  it("shows an accurate first-visit banner and remembers rejection", async () => {
    const user = userEvent.setup();
    renderUtilities();

    expect(
      screen.getByRole("region", { name: "Cookies and browser storage" })
    ).toBeInTheDocument();
    expect(screen.getByText(/do not use analytics or advertising cookies/i)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Decline appearance cookie" })
    );

    expect(
      screen.queryByRole("region", { name: "Cookies and browser storage" })
    ).not.toBeInTheDocument();
    expect(document.cookie).toContain("sodc-cookie-preferences=rejected");
  });

  it("offers System, Light, and Dark in a small appearance menu", async () => {
    const user = userEvent.setup();
    renderUtilities();

    await user.click(
      screen.getByRole("button", { name: "Appearance: System, currently Light mode" })
    );
    expect(
      screen.getByText("Light and Dark use one cookie to remember your choice.")
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /System/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Light/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Dark/ })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: /Dark/ }));

    const darkButton = screen.getByRole("button", { name: "Appearance: Dark mode" });
    expect(darkButton).toHaveTextContent("Dark mode");
    expect(within(darkButton).getByTestId("DarkModeIcon")).toBeInTheDocument();
    expect(document.cookie).toContain("sodc-color-mode-preference=dark");
    expect(document.cookie).toContain("sodc-cookie-preferences=accepted");

    await user.click(darkButton);
    expect(
      screen.queryByText("Light and Dark use one cookie to remember your choice.")
    ).not.toBeInTheDocument();
  });

  it("shows the resolved mode but retains the System icon for a system preference", () => {
    mockSystemDarkMode(true);
    renderUtilities();

    const systemButton = screen.getByRole("button", {
      name: "Appearance: System, currently Dark mode",
    });
    expect(systemButton).toHaveTextContent("Dark mode");
    expect(within(systemButton).getByTestId("SettingsBrightnessIcon")).toBeInTheDocument();
  });

  it("keeps quiet utility pills on a single desktop status row", () => {
    renderUtilities();

    expect(screen.getByTestId("footer-status-row")).toHaveStyle({ flexWrap: "nowrap" });
    const utilities = screen.getByTestId("footer-utilities");
    expect(utilities).toHaveStyle({ justifyContent: "flex-end" });

    const appearanceButton = screen.getByRole("button", {
      name: "Appearance: System, currently Light mode",
    });
    const cookieButton = screen.getByRole("button", { name: "Cookie settings" });
    for (const button of [appearanceButton, cookieButton]) {
      expect(button).toHaveStyle({
        borderRadius: "9999px",
        backgroundColor: "rgba(0, 0, 0, 0.04)",
      });
    }
    expect(within(cookieButton).getByTestId("CookieOutlinedIcon")).toBeInTheDocument();
  });

  it("reopens settings and removes appearance storage when disabled", async () => {
    const user = userEvent.setup();
    renderUtilities();

    await user.click(
      screen.getByRole("button", { name: "Appearance: System, currently Light mode" })
    );
    await user.click(screen.getByRole("menuitem", { name: /Light/ }));
    const lightButton = screen.getByRole("button", { name: "Appearance: Light mode" });
    expect(lightButton).toHaveTextContent("Light mode");
    expect(within(lightButton).getByTestId("LightModeIcon")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cookie settings" }));

    const appearanceSwitch = screen.getByRole("switch", {
      name: "Remember my Light or Dark appearance choice",
    });
    expect(appearanceSwitch).toBeChecked();
    await user.click(appearanceSwitch);
    await user.click(screen.getByRole("button", { name: "Save cookie settings" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: "Appearance: System, currently Light mode",
        }),
      ).toBeInTheDocument();
    });
    expect(document.cookie).not.toContain("sodc-color-mode-preference=");
    expect(document.cookie).toContain("sodc-cookie-preferences=rejected");

    await user.click(
      screen.getByRole("button", { name: "Appearance: System, currently Light mode" }),
    );
    expect(
      screen.getByText("Light and Dark use one cookie to remember your choice.")
    ).toBeInTheDocument();
  });
});
