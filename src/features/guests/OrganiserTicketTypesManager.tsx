import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Paper, Typography } from "@mui/material";
import { auth } from "../../config/firebase";
import { ORGANISER_GUEST } from "../../shared/utils/ticketAudienceLabels";
import { TicketTypesTable } from "../admin/components/sectionEventsManagerSurfaces/TicketAdminSurface";
import { TicketTypeDialogSurface } from "../admin/components/sectionEventsManagerSurfaces/TicketTypeDialogSurface";
import type { TicketTypeRow } from "../admin/components/sectionEventsManagerTypes";
import { guestCall, type GuestList } from "./api";
import { organiserTicketTypeRow } from "./ticketTypes";

/** Section moderators use the same table and editor, limited to their allocation category. */
export default function OrganiserTicketTypesManager({
  eventId,
}: {
  eventId: string;
}) {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["organiser-guests", eventId, auth.currentUser?.uid],
    queryFn: () => guestCall<GuestList>("getOrganiserGuestList", { eventId }),
    gcTime: 0,
  });
  const [draft, setDraft] = useState<TicketTypeRow | null>(null);
  const [price, setPrice] = useState("0");
  const [sortOrder, setSortOrder] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function edit(row?: TicketTypeRow) {
    const next = row ?? {
      id: crypto.randomUUID(),
      title: "",
      description: "",
      price: 0,
      sortOrder: data?.ticketTypes.length ?? 0,
      audience: ORGANISER_GUEST,
      includesDinner: false,
      includesSymposium: false,
      userGroup: null,
      active: true,
    };
    setDraft(next);
    setPrice(String(next.price));
    setSortOrder(String(next.sortOrder));
    setError("");
  }
  async function save(
    row: TicketTypeRow,
    amount = row.price,
    order = row.sortOrder,
  ) {
    if (
      !Number.isFinite(amount) ||
      amount < 0 ||
      !Number.isSafeInteger(order)
    ) {
      setError("Enter a valid price and whole-number sort order.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await guestCall("saveOrganiserGuestTicketType", {
        eventId,
        id: row.id,
        version: row.version,
        title: row.title,
        description: row.description ?? "",
        priceMinor: Math.round(amount * 100),
        sortOrder: order,
        includesDinner: row.includesDinner,
        includesSymposium: row.includesSymposium,
        active: row.active,
      });
      setDraft(null);
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save ticket type.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Paper sx={{ p: 3, my: 3 }}>
      <Typography variant="h5">Ticket types</Typography>
      <Typography>
        Section moderators manage organiser/club guest tickets here.
        Administrators can manage all three categories in event administration.
      </Typography>
      {error && (
        <Alert
          severity="error"
          action={
            <Button disabled={busy} onClick={() => void refetch()}>
              Refresh
            </Button>
          }
        >
          {error}
        </Alert>
      )}
      {isError ? (
        <Alert
          severity="error"
          action={<Button onClick={() => void refetch()}>Retry</Button>}
        >
          Unable to load ticket types.
        </Alert>
      ) : (
        <>
          <Button disabled={busy || isPending} onClick={() => edit()}>
            Add ticket type
          </Button>
          <TicketTypesTable
            loading={isPending}
            ticketTypes={(data?.ticketTypes ?? []).map(organiserTicketTypeRow)}
            deletingTicketTypeId={busy ? (draft?.id ?? null) : null}
            onEdit={edit}
            onDelete={(id) => {
              const row = data?.ticketTypes.find((t) => t.id === id);
              if (
                row &&
                window.confirm(
                  "Archive this ticket type? Existing reservations will be retained.",
                )
              )
                void save({ ...organiserTicketTypeRow(row), active: false });
            }}
          />
        </>
      )}
      <TicketTypeDialogSurface
        open={Boolean(draft)}
        editingTicketType={draft?.version ? draft : null}
        organiserOnly
        audience={ORGANISER_GUEST}
        title={draft?.title ?? ""}
        description={draft?.description ?? ""}
        price={price}
        sortOrder={sortOrder}
        includesDinner={draft?.includesDinner ?? false}
        includesSymposium={draft?.includesSymposium ?? false}
        active={draft?.active}
        accessGroup={null}
        userGroups={[]}
        loadingUserGroups={false}
        submitting={busy}
        error={error}
        onClose={() => !busy && setDraft(null)}
        onSubmit={() =>
          draft && void save(draft, Number(price), Number(sortOrder))
        }
        onTitleChange={(title) => draft && setDraft({ ...draft, title })}
        onDescriptionChange={(description) =>
          draft && setDraft({ ...draft, description })
        }
        onPriceChange={setPrice}
        onSortOrderChange={setSortOrder}
        onAudienceChange={() => {}}
        onIncludesDinnerChange={(includesDinner) =>
          draft && setDraft({ ...draft, includesDinner })
        }
        onIncludesSymposiumChange={(includesSymposium) =>
          draft && setDraft({ ...draft, includesSymposium })
        }
        onActiveChange={(active) => draft && setDraft({ ...draft, active })}
        onAccessGroupChange={() => {}}
      />
    </Paper>
  );
}
