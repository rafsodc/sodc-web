import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, useLocation, useNavigate } from "react-router-dom";
import Baseline from "probe:baseline";
import Candidate from "probe:candidate";
import { useUpcomingEventsForUser as useBaselineHome } from "probe:home-baseline";
import { useUpcomingEventsForUser as useCandidateHome } from "probe:home-candidate";
import { createSessionLifecycle, installSessionRuntime } from "../../../src/shared/appShell/sessionLifecycle";
import { Ready } from "./views";

interface Probe {
  phase: string; inFlight: number; errors: string[]; marks: Array<{ phase: string; elapsedMs: number }>;
  longTasks: number[]; begin(phase: string): void; ready(kind: string): void;
}
declare global { var probe: Probe; }
let phase = "initial";
let started = 0;
let pending = false;
globalThis.probe = {
  phase: "initial", inFlight: 0, errors: [], marks: [], longTasks: [],
  begin(next) { this.phase = next; phase = next; started = performance.now(); pending = true; },
  ready(kind) {
    const scenario = new URLSearchParams(location.search).get("case") ?? sessionStorage.getItem("probe-case");
    const expected = phase === "back" || phase === "section" ? "events" : phase === "detail" ? "detail" : phase === "homeBack" || scenario === "home" ? "home" : scenario === "members" ? "members" : scenario === "direct" ? "detail" : "events";
    if (pending && kind === expected) { pending = false; this.marks.push({ phase, elapsedMs: performance.now() - started }); }
  },
};
if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
  new PerformanceObserver(list => { if (started) globalThis.probe.longTasks.push(...list.getEntries().map(entry => entry.duration)); }).observe({ entryTypes: ["longtask"] });
}
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const lifecycle = createSessionLifecycle(); lifecycle.observe("synthetic-probe");
installSessionRuntime({ lifecycle, queryClient: client, retire: () => lifecycle.retire(), signOut: async () => { lifecycle.retire(); } });
const homeSections = ["11111111-1111-4111-8111-111111111111", "11111111-1111-4111-8111-111111111113", "11111111-1111-4111-8111-111111111114"].map(id => ({ id, type: "EVENTS" as const, name: "Synthetic section" }));
function Home({ variant }: { variant: string }) {
  const navigate = useNavigate();
  const result = (variant === "baseline" ? useBaselineHome : useCandidateHome)(homeSections);
  if (result.loading || result.isError || result.events.length !== 75) return <p>Loading home</p>;
  return <Ready kind="home"><p>{result.events.length} synthetic upcoming events</p><button onClick={() => { globalThis.probe.begin("section"); navigate(`/sections/${homeSections[0].id}`); }}>Open synthetic section</button></Ready>;
}
function Harness() {
  const location = useLocation();
  const navigate = useNavigate();
  const [active, setActive] = useState(false);
  const params = new URLSearchParams(location.search);
  const variant = params.get("variant") ?? sessionStorage.getItem("probe-variant") ?? "baseline";
  const scenario = params.get("case") ?? sessionStorage.getItem("probe-case") ?? "events";
  sessionStorage.setItem("probe-variant", variant); sessionStorage.setItem("probe-case", scenario);
  const Component = variant === "baseline" ? Baseline : Candidate;
  const sectionId = scenario === "members" ? "11111111-1111-4111-8111-111111111112" : "11111111-1111-4111-8111-111111111111";
  const eventId = location.pathname.match(/\/events\/([^/]+)/)?.[1] ?? undefined;
  if (!active) return <button onClick={() => { globalThis.probe.begin("initial"); setActive(true); }}>Start component probe</button>;
  if (location.pathname === "/home") return <Home variant={variant} />;
  return <Component key={sectionId} sectionId={sectionId} eventId={eventId} onBack={() => {
    if (scenario !== "home") throw new Error("Unexpected section exit");
    globalThis.probe.begin("homeBack"); navigate("/home");
  }} />;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}><BrowserRouter><Harness /></BrowserRouter></QueryClientProvider>);
