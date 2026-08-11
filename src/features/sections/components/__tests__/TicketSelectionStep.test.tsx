import { useState } from "react";
import { describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "../../../../test-utils";
import TicketSelectionStep from "../wizardSteps/TicketSelectionStep";

function SeatingPickerHarness() {
  const [inputValue, setInputValue] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  return (
    <TicketSelectionStep
      memberTicketTypes={[]}
      memberTicketTypeId={null}
      onMemberTicketTypeChange={() => undefined}
      memberDietaryNote=""
      onMemberDietaryNoteChange={() => undefined}
      seatingOptions={[{ id: "firebase-user-2", label: "Alex Member" }]}
      seatingSearchInputValue={inputValue}
      onSeatingSearchInputValueChange={setInputValue}
      seatingOptionsLoading={false}
      sitNextToUserIds={selectedIds}
      onSitNextToUserIdsChange={setSelectedIds}
      accommodationRequested={false}
      onAccommodationRequestedChange={() => undefined}
      canRequestAccommodation={false}
    />
  );
}

describe("TicketSelectionStep seating picker", () => {
  it("clears search text after selecting a member while retaining the selected chip", async () => {
    const user = userEvent.setup();
    render(<SeatingPickerHarness />);

    const input = screen.getByLabelText("Sit next to (optional)");
    await user.type(input, "Alex");
    await user.click(screen.getByRole("option", { name: "Alex Member" }));

    expect(input).toHaveValue("");
    expect(screen.getByText("Alex Member")).toBeInTheDocument();
  });
});
