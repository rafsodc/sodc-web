import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, useLocation } from "react-router-dom";
import Baseline from "probe:baseline";
import Candidate from "probe:candidate";

interface Probe {
  inFlight: number; errors: string[]; marks: Array<{ phase: string; elapsedMs: number }>;
  longTasks: number[]; begin(phase: string): void; ready(kind: string): void;
}
declare global { var probe: Probe; }
let phase = "initial";
let started = 0;
let pending = false;
globalThis.probe = {
  inFlight: 0, errors: [], marks: [], longTasks: [],
  begin(next) { phase = next; started = performance.now(); pending = true; },
  ready(kind) {
    const expected = phase === "back" ? "events" : phase === "detail" ? "detail" : new URLSearchParams(location.search).get("case") === "members" ? "members" : new URLSearchParams(location.search).get("case") === "direct" ? "detail" : "events";
    if (pending && kind === expected) { pending = false; this.marks.push({ phase, elapsedMs: performance.now() - started }); }
  },
};
if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
  new PerformanceObserver(list => { if (started) globalThis.probe.longTasks.push(...list.getEntries().map(entry => entry.duration)); }).observe({ entryTypes: ["longtask"] });
}
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function Harness() {
  const location = useLocation();
  const [active, setActive] = useState(false);
  const params = new URLSearchParams(location.search);
  const variant = params.get("variant") ?? sessionStorage.getItem("probe-variant") ?? "baseline";
  const scenario = params.get("case") ?? sessionStorage.getItem("probe-case") ?? "events";
  sessionStorage.setItem("probe-variant", variant); sessionStorage.setItem("probe-case", scenario);
  const Component = variant === "baseline" ? Baseline : Candidate;
  const sectionId = scenario === "members" ? "11111111-1111-4111-8111-111111111112" : "11111111-1111-4111-8111-111111111111";
  const eventId = location.pathname.match(/\/events\/([^/]+)/)?.[1] ?? undefined;
  return active
    ? <Component key={sectionId} sectionId={sectionId} eventId={eventId} onBack={() => { throw new Error("Unexpected section exit"); }} />
    : <button onClick={() => { globalThis.probe.begin("initial"); setActive(true); }}>Start component probe</button>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}><BrowserRouter><Harness /></BrowserRouter></QueryClientProvider>);
