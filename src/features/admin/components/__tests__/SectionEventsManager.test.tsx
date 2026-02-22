import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "../../../../test-utils";
import SectionEventsManager from "../SectionEventsManager";
import * as reactGenerated from "@dataconnect/generated/react";

vi.mock("@dataconnect/generated/react", () => ({
  useGetEventsForSection: vi.fn(),
  useGetEventById: vi.fn(),
}));

vi.mock("firebase/data-connect", () => ({
  executeQuery: vi.fn().mockResolvedValue({ data: null }),
  executeMutation: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../../../config/firebase", () => ({
  dataConnect: {},
}));

vi.mock("@dataconnect/generated", async () => {
  const actual = await vi.importActual("@dataconnect/generated");
  return { ...actual };
});

describe("SectionEventsManager", () => {
  const sectionId = "section-1";
  const sectionName = "Events Section";
  const onBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reactGenerated.useGetEventsForSection).mockReturnValue({
      data: { section: { id: sectionId, events: [] } } as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);
    vi.mocked(reactGenerated.useGetEventById).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);
  });

  it("renders events list with section name and Back returns to sections", async () => {
    render(<SectionEventsManager sectionId={sectionId} sectionName={sectionName} onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText(/Events: Events Section/)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add event/i })).toBeInTheDocument();
    expect(screen.getByText(/no events yet/i)).toBeInTheDocument();

    screen.getByRole("button", { name: /back/i }).click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("shows events table when section has events", async () => {
    vi.mocked(reactGenerated.useGetEventsForSection).mockReturnValue({
      data: {
        section: {
          id: sectionId,
          events: [
            {
              id: "ev-1",
              title: "Annual Dinner",
              startDateTime: "2025-03-01T18:00:00Z",
              endDateTime: "2025-03-01T22:00:00Z",
              bookingStartDateTime: "2025-02-01T00:00:00Z",
              bookingEndDateTime: "2025-02-28T23:59:59Z",
              location: "Main Hall",
              guestOfHonour: "Jane Doe",
            },
          ],
        },
      } as any,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    render(<SectionEventsManager sectionId={sectionId} sectionName={sectionName} onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText("Annual Dinner")).toBeInTheDocument();
    });
    expect(screen.getByText("Main Hall")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ticket types/i })).toBeInTheDocument();
  });
});
