import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const defaultApp = { name: "[DEFAULT]", options: { projectId: "test-project" } };
  const bookingApp = { name: "booking-service-data-connect", options: defaultApp.options };
  const apps = [defaultApp];
  return {
    apps,
    defaultApp,
    bookingApp,
    initializeApp: vi.fn(() => {
      apps.push(bookingApp);
      return bookingApp;
    }),
    getDataConnect: vi.fn(() => ({ executeMutation: vi.fn() })),
  };
});

vi.mock("firebase-admin/app", () => ({
  getApp: vi.fn(() => mocks.defaultApp),
  getApps: vi.fn(() => mocks.apps),
  initializeApp: mocks.initializeApp,
}));

vi.mock("firebase-admin/data-connect", () => ({
  getDataConnect: mocks.getDataConnect,
}));

import { getBookingServiceDataConnect } from "../../bookingServiceDataConnect";

describe("booking-service Data Connect isolation", () => {
  beforeEach(() => {
    mocks.apps.splice(1);
    mocks.initializeApp.mockClear();
    mocks.getDataConnect.mockClear();
  });

  it("uses a dedicated named app so Firebase Admin cannot reuse the api connector cache", () => {
    getBookingServiceDataConnect();
    getBookingServiceDataConnect();

    expect(mocks.initializeApp).toHaveBeenCalledOnce();
    expect(mocks.initializeApp).toHaveBeenCalledWith(
      mocks.defaultApp.options,
      "booking-service-data-connect"
    );
    expect(mocks.getDataConnect).toHaveBeenLastCalledWith(
      {
        connector: "booking-service",
        serviceId: "sodc-web-service",
        location: "europe-west2",
      },
      mocks.bookingApp
    );
  });
});
