import type { Location, NavigateFunction } from "react-router-dom";

export interface CheckoutQueryState {
  checkout: "success" | "cancel";
  orderId: string | null;
}

export function getCheckoutQueryState(search: string): CheckoutQueryState | null {
  const params = new URLSearchParams(search);
  const checkout = params.get("checkout");
  if (checkout !== "success" && checkout !== "cancel") {
    return null;
  }

  return {
    checkout,
    orderId: params.get("orderId"),
  };
}

export function dismissCheckoutQueryParams(location: Location, navigate: NavigateFunction) {
  const params = new URLSearchParams(location.search);
  params.delete("checkout");
  params.delete("orderId");
  const search = params.toString();
  navigate(`${location.pathname}${search ? `?${search}` : ""}${location.hash}`, { replace: true });
}

export function navigateBackOr(
  fallbackRoute: string,
  location: Pick<Location, "key">,
  navigate: NavigateFunction
) {
  if (window.history.state?.idx > 0 || location.key !== "default") {
    navigate(-1);
    return;
  }
  navigate(fallbackRoute, { replace: true });
}

export function selectedAdminSectionId(pathname: string, manageSectionsRoute: string, state: unknown) {
  if (pathname !== manageSectionsRoute) {
    return null;
  }
  return ((state as { managedSection?: { id?: string } } | null)?.managedSection?.id ?? null);
}

export function selectedAdminUserGroupId(pathname: string, userGroupsRoute: string, state: unknown) {
  if (pathname !== userGroupsRoute) {
    return null;
  }
  return ((state as { expandedGroupId?: string } | null)?.expandedGroupId ?? null);
}
