import { useLayoutEffect } from "react";

export function Ready({ kind, children }: { kind: string; children: React.ReactNode }) {
  useLayoutEffect(() => { globalThis.probe.ready(kind); });
  return <section data-ready={kind}>{children}</section>;
}
// Keep actual parent fetching/filtering/sorting/render lifecycle; replace expensive
// children so these numbers cannot be mistaken for full application UI performance.
export default function Surface({ title, message, items, onBack }: { title?: string; message?: string; items?: unknown[]; onBack?: () => void }) {
  if (items) return null;
  if (!title) return null;
  return <header><h1>{title}</h1>{message}<button onClick={onBack}>Section back</button></header>;
}
export function SectionDescriptionHeader() { return null; }
export function SectionEventsListView({ events, loading, isError, onSelectEvent }: { events: Array<{ id: string; title: string }>; loading: boolean; isError: boolean; onSelectEvent: (id: string) => void }) {
  if (loading || isError || !events.length) return <p>Loading events</p>;
  return <Ready kind="events">{events.map(event => <button key={event.id} onClick={() => { globalThis.probe.begin("detail"); onSelectEvent(event.id); }}>{event.title}</button>)}</Ready>;
}
export function SectionEventDetailView({ event, loading, isError, onBackToEvents }: { event: { id: string; title: string } | null; loading: boolean; isError: boolean; onBackToEvents: () => void }) {
  if (!event || loading || isError) return <p>Loading event</p>;
  return <Ready kind="detail"><h2>{event.title}</h2><button onClick={() => { globalThis.probe.begin("back"); onBackToEvents(); }}>Back to events</button></Ready>;
}
export function SectionMembersView({ paginatedMembers, loading, isError }: { paginatedMembers: Array<{ userId: string; firstName: string; lastName: string }>; loading: boolean; isError: boolean }) {
  if (loading || isError || !paginatedMembers.length) return <p>Loading members</p>;
  return <Ready kind="members">{paginatedMembers.map(member => <p key={member.userId}>{member.firstName} {member.lastName}</p>)}</Ready>;
}
