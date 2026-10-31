import { lazy, Suspense, useState, useSyncExternalStore, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { ErrorBoundary } from "../../../src/shared/components/ErrorBoundary";
import { installModuleLoadRecovery } from "../../../src/shared/appShell/moduleLoadRecovery";
import { createSessionLifecycle, installSessionRuntime } from "../../../src/shared/appShell/sessionLifecycle";
import { useDraftUnloadWarning, useSessionDraft } from "../../../src/shared/hooks/useSessionDraft";
import { useSessionMutation } from "../../../src/shared/hooks/useSessionMutation";

const LazyFeature = lazy(() => import("./LazyFeature"));
let lifecycle = createSessionLifecycle();
lifecycle.observe(new URLSearchParams(globalThis.location.search).get("account") === "beta" ? "beta" : "alpha");
let uninstall = installSessionRuntime({ lifecycle, retire: () => lifecycle.retire(), signOut: async () => { lifecycle.retire(); } });
installModuleLoadRecovery();
globalThis.addEventListener("pagehide", () => lifecycle.retire());

function Draft() {
  const [draft, setDraft] = useSessionDraft("local-business-resource:draft", "");
  const [notice, setNotice] = useState("");
  const mutation = useSessionMutation<void>("local-business-resource:save");
  useDraftUnloadWarning(draft.length > 0);
  async function save(event: FormEvent) {
    event.preventDefault();
    try {
      await mutation.runOnce(async () => {
        const response = await fetch("/__business", { method: "POST", body: "inert-local-fixture" });
        if (!response.ok) throw new Error("Local accepted result unavailable");
      });
      setNotice("Saved");
    } catch { setNotice("Save result unknown. Check the existing result before trying again."); }
  }
  return <form onSubmit={save}><label>Local draft<input value={draft} onChange={event => setDraft(event.target.value)} /></label><button type="submit">Save locally</button><p role="status">{notice || (mutation.status === "error" ? "Save result unknown. Check the existing result before trying again." : "")}</p></form>;
}

function Fixture() {
  const navigate = useNavigate();
  const location = useLocation();
  const [account, setAccount] = useState(lifecycle.getSnapshot().uid ?? "alpha");
  const session = useSyncExternalStore(lifecycle.subscribe, lifecycle.getSnapshot);
  function switchAccount() {
    lifecycle.retire();
    uninstall();
    lifecycle = createSessionLifecycle();
    lifecycle.observe("beta");
    uninstall = installSessionRuntime({ lifecycle, retire: () => lifecycle.retire(), signOut: async () => { lifecycle.retire(); } });
    setAccount("beta");
    navigate(`${location.pathname}?account=beta&from=upgrade#review`, { replace: true });
  }
  return <>
    <p>Shell build __DEPLOYMENT_FIXTURE_VERSION__</p><p>Current account: {account === "alpha" ? "Alpha" : "Beta"}</p><p>Session {session.phase}</p>
    <button type="button" onClick={switchAccount}>Switch to Beta</button>
    <nav><Link to={`/fixture?account=${account}`}>Home</Link>{" "}<Link to={`/fixture/draft?account=${account}`}>Draft</Link>{" "}<Link to={`/fixture/feature?account=${account}&from=upgrade#review`}>Open lazy feature</Link></nav>
    <ErrorBoundary title="Local fixture unavailable" resetKey={`${location.key}:${location.pathname}:${location.search}`} onBack={() => navigate(-1)} onHome={() => navigate(`/fixture?account=${account}`)}>
      <Suspense fallback={<p>Loading local fixture</p>}><Routes><Route path="/fixture/feature" element={<LazyFeature />} /><Route path="/fixture/draft" element={<Draft />} /><Route path="*" element={<h1>Local fixture home</h1>} /></Routes></Suspense>
    </ErrorBoundary>
  </>;
}

createRoot(globalThis.document.getElementById("root")!).render(<BrowserRouter><Fixture /></BrowserRouter>);
