import { describe, expect, it, vi } from "vitest";
import {
  dismissCheckoutQueryParams,
  getCheckoutQueryState,
  selectedAdminSectionId,
  selectedAdminUserGroupId,
} from "../appRoutingHelpers";

describe("appRoutingHelpers", () => {
  it("reads checkout query state from success and cancel URLs", () => {
    expect(getCheckoutQueryState("?checkout=success&orderId=order-1")).toEqual({
      checkout: "success",
      orderId: "order-1",
    });
    expect(getCheckoutQueryState("?checkout=cancel")).toEqual({
      checkout: "cancel",
      orderId: null,
    });
  });

  it("ignores URLs without a supported checkout state", () => {
    expect(getCheckoutQueryState("?checkout=pending&orderId=order-1")).toBeNull();
    expect(getCheckoutQueryState("?orderId=order-1")).toBeNull();
  });

  it("removes checkout query params without dropping unrelated URL state", () => {
    const navigate = vi.fn();

    dismissCheckoutQueryParams(
      {
        pathname: "/",
        search: "?checkout=success&orderId=order-1&keep=yes",
        hash: "#receipt",
      } as Parameters<typeof dismissCheckoutQueryParams>[0],
      navigate
    );

    expect(navigate).toHaveBeenCalledWith("/?keep=yes#receipt", { replace: true });
  });

  it("selects admin IDs only for their matching admin routes", () => {
    expect(
      selectedAdminSectionId("/admin/sections", "/admin/sections", {
        managedSection: { id: "section-1" },
      })
    ).toBe("section-1");
    expect(selectedAdminSectionId("/", "/admin/sections", { managedSection: { id: "section-1" } })).toBeNull();

    expect(
      selectedAdminUserGroupId("/admin/user-groups", "/admin/user-groups", {
        expandedGroupId: "group-1",
      })
    ).toBe("group-1");
    expect(selectedAdminUserGroupId("/", "/admin/user-groups", { expandedGroupId: "group-1" })).toBeNull();
  });
});
