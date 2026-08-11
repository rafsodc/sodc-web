import { getApp, getApps, initializeApp } from "firebase-admin/app";
import { getDataConnect } from "firebase-admin/data-connect";

const BOOKING_SERVICE_APP_NAME = "booking-service-data-connect";

const connectorConfig = {
  connector: "booking-service",
  serviceId: "sodc-web-service",
  location: "europe-west2",
};

/**
 * Firebase Admin 13.10 caches Data Connect clients by location and service ID,
 * omitting the connector ID. A dedicated named app gives the server-only
 * booking connector its own cache and prevents it reusing the public API client.
 */
export function getBookingServiceDataConnect() {
  let app = getApps().find((candidate) => candidate.name === BOOKING_SERVICE_APP_NAME);
  if (!app) {
    app = initializeApp(getApp().options, BOOKING_SERVICE_APP_NAME);
  }
  return getDataConnect(connectorConfig, app);
}
