import { describe, expect, it } from "vitest";
import { render, screen } from "../../../test-utils";
import SafeMarkdown from "../SafeMarkdown";

describe("SafeMarkdown", () => {
  it("renders the supported CommonMark content with accessible structure", () => {
    render(
      <SafeMarkdown>{`# Welcome

This is *important* and **strong**.

- First item
- Second item

[SODC website](https://example.com)`}</SafeMarkdown>
    );

    expect(screen.getByRole("heading", { name: "Welcome", level: 3 })).toBeInTheDocument();
    expect(screen.getByText("important").tagName).toBe("EM");
    expect(screen.getByText("strong").tagName).toBe("STRONG");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "SODC website" })).toHaveAttribute("href", "https://example.com");
    expect(screen.getByRole("link", { name: "SODC website" })).toHaveAttribute("rel", "noreferrer noopener");
  });

  it("drops raw HTML and prevents unsafe link schemes", () => {
    render(
      <SafeMarkdown>{`<script>alert("unsafe")</script>

<img src=x onerror=alert(1)>

[Unsafe link](javascript:alert(1))`}</SafeMarkdown>
    );

    expect(screen.queryByText('alert("unsafe")')).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Unsafe link" })).not.toBeInTheDocument();
    expect(screen.getByText("Unsafe link")).toBeInTheDocument();
  });
});
