import { useEffect, useState } from "react";
import type { Location, NavigateFunction } from "react-router-dom";
import {
  dismissCheckoutQueryParams,
  getCheckoutQueryState,
  type CheckoutQueryState,
} from "./appRoutingHelpers";

export function useCheckoutQueryState(location: Location, navigate: NavigateFunction) {
  const [checkoutQueryState, setCheckoutQueryState] = useState<CheckoutQueryState | null>(null);

  useEffect(() => {
    const nextCheckoutState = getCheckoutQueryState(location.search);
    if (nextCheckoutState) {
      setCheckoutQueryState(nextCheckoutState);
    }
  }, [location.search]);

  const dismissCheckoutStatus = () => {
    dismissCheckoutQueryParams(location, navigate);
    setCheckoutQueryState(null);
  };

  return { checkoutQueryState, dismissCheckoutStatus };
}
