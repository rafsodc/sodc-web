import { useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { QueryClientProvider } from "@tanstack/react-query";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../../config/firebase";
import { createAppQueryClient } from "../query/queryClient";
import { LOGOUT_NOTICE, sessionRestartPath } from "./sessionBrowser";
import { createSessionLifecycle, installSessionRuntime, type RetirementOptions } from "./sessionLifecycle";

const replaceBrowserDocument = (path: string) => window.location.replace(path);

export default function PrivateSessionBoundary({ children, replaceDocument = replaceBrowserDocument }: {
  children: ReactNode;
  replaceDocument?: (path: string) => void;
}) {
  const [lifecycle] = useState(createSessionLifecycle);
  const [queryClient] = useState(createAppQueryClient);
  const snapshot = useSyncExternalStore(lifecycle.subscribe, lifecycle.getSnapshot);

  useLayoutEffect(() => {
    let restartRequested = false;
    let signOutPromise: Promise<void> | null = null;
    let pendingOptions: RetirementOptions | undefined;
    const removePrivateSnapshot = () => {
      // React must remove private content before the browser snapshots pagehide,
      // and before another auth observer can start work for a replacement UID.
      flushSync(() => lifecycle.retire());
      void queryClient.cancelQueries();
      queryClient.clear();
    };
    const restart = (options?: RetirementOptions) => {
      if (restartRequested) return;
      restartRequested = true;
      replaceDocument(sessionRestartPath(window.location, options?.returnTo));
    };
    const retire = (options?: RetirementOptions) => {
      removePrivateSnapshot();
      restart(options);
    };
    const logout = (options?: RetirementOptions): Promise<void> => {
      if (signOutPromise) return signOutPromise;
      pendingOptions = options;
      removePrivateSnapshot();
      signOutPromise = Promise.resolve().then(() => signOut(auth)).then(() => {
        try { sessionStorage.setItem(LOGOUT_NOTICE, String(Date.now())); } catch { /* Storage may be unavailable. */ }
        restart(options);
      }).catch(() => {
        lifecycle.fail();
      }).finally(() => { signOutPromise = null; });
      return signOutPromise;
    };
    const uninstall = installSessionRuntime({ lifecycle, retire, signOut: logout, queryClient });
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (lifecycle.getSnapshot().phase !== "active") return;
      if (!lifecycle.observe(user?.uid ?? null)) {
        // A cross-tab sign-out/account replacement has already changed Firebase.
        // Never accept B or wait for old network work to finish in A's document.
        removePrivateSnapshot();
        restart();
      }
    });
    const pagehide = () => {
      if (lifecycle.getSnapshot().uid !== null) removePrivateSnapshot();
    };
    const pageshow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        removePrivateSnapshot();
        if (!restartRequested) {
          restartRequested = true;
          replaceDocument(window.location.href);
        }
      }
    };
    const retry = () => { void logout(pendingOptions); };
    window.addEventListener("pagehide", pagehide);
    window.addEventListener("pageshow", pageshow);
    window.addEventListener("sodc-retry-sign-out", retry);
    return () => {
      uninstall();
      unsubscribe();
      window.removeEventListener("pagehide", pagehide);
      window.removeEventListener("pageshow", pageshow);
      window.removeEventListener("sodc-retry-sign-out", retry);
      void queryClient.cancelQueries();
      queryClient.clear();
    };
  }, [lifecycle, queryClient, replaceDocument]);

  if (snapshot.phase !== "active") {
    return <Box component="main" sx={{ maxWidth: 640, mx: "auto", p: 4 }}>
      <Stack spacing={2}>
        <Typography variant="h5" component="h1">Account session ending</Typography>
        {snapshot.phase === "failed" ? <>
          <Alert severity="error">We could not sign you out. Your private information is hidden. Try signing out again.</Alert>
          <Button variant="contained" onClick={() => window.dispatchEvent(new Event("sodc-retry-sign-out"))}>Try signing out again</Button>
        </> : <CircularProgress aria-label="Ending account session" />}
      </Stack>
    </Box>;
  }
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
