import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSnackbar } from "../useSnackbar";

describe("useSnackbar", () => {
  it("starts closed", () => {
    const { result } = renderHook(() => useSnackbar());
    expect(result.current.snackbar).toEqual({ open: false, message: "", severity: "success" });
  });

  it("showSuccess opens with success severity", () => {
    const { result } = renderHook(() => useSnackbar());
    act(() => result.current.showSuccess("Saved"));
    expect(result.current.snackbar).toEqual({ open: true, message: "Saved", severity: "success" });
  });

  it("showError opens with error severity", () => {
    const { result } = renderHook(() => useSnackbar());
    act(() => result.current.showError("Failed"));
    expect(result.current.snackbar).toEqual({ open: true, message: "Failed", severity: "error" });
  });

  it("close sets open to false without clearing the message", () => {
    const { result } = renderHook(() => useSnackbar());
    act(() => result.current.showSuccess("Saved"));
    act(() => result.current.close());
    expect(result.current.snackbar).toEqual({ open: false, message: "Saved", severity: "success" });
  });

  it("a later call replaces the previous message and severity", () => {
    const { result } = renderHook(() => useSnackbar());
    act(() => result.current.showSuccess("Saved"));
    act(() => result.current.showError("Now failed"));
    expect(result.current.snackbar).toEqual({ open: true, message: "Now failed", severity: "error" });
  });
});
