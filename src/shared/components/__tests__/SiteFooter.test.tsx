import { beforeEach, describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "../../../test-utils";
import CookieBanner from "../CookieBanner";
import CookieSettingsDialog from "../CookieSettingsDialog";
import SiteFooter from "../SiteFooter";

function clearCookies() {
  document.cookie.split(";").forEach((cookie) => {
    const name = cookie.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; max-age=0; path=/`;
  });
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
  beforeEach(clearCookies);

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
      screen.getByRole("button", { name: "Appearance: System" })
    );
    expect(
      screen.getByText("Light and Dark use one cookie to remember your choice.")
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /System/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Light/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Dark/ })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: /Dark/ }));

    expect(
      screen.getByRole("button", { name: "Appearance: Dark" })
    ).toBeInTheDocument();
    expect(document.cookie).toContain("sodc-color-mode-preference=dark");
    expect(document.cookie).toContain("sodc-cookie-preferences=accepted");

    await user.click(screen.getByRole("button", { name: "Appearance: Dark" }));
    expect(
      screen.queryByText("Light and Dark use one cookie to remember your choice.")
    ).not.toBeInTheDocument();
  });

  it("reopens settings and removes appearance storage when disabled", async () => {
    const user = userEvent.setup();
    renderUtilities();

    await user.click(
      screen.getByRole("button", { name: "Appearance: System" })
    );
    await user.click(screen.getByRole("menuitem", { name: /Light/ }));
    await user.click(screen.getByRole("button", { name: "Cookie settings" }));

    const appearanceSwitch = screen.getByRole("switch", {
      name: "Remember my Light or Dark appearance choice",
    });
    expect(appearanceSwitch).toBeChecked();
    await user.click(appearanceSwitch);
    await user.click(screen.getByRole("button", { name: "Save cookie settings" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Appearance: System" })
      ).toBeInTheDocument();
    });
    expect(document.cookie).not.toContain("sodc-color-mode-preference=");
    expect(document.cookie).toContain("sodc-cookie-preferences=rejected");

    await user.click(screen.getByRole("button", { name: "Appearance: System" }));
    expect(
      screen.getByText("Light and Dark use one cookie to remember your choice.")
    ).toBeInTheDocument();
  });
});
