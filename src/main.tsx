import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { ColorModeProvider } from './shared/appShell/ColorModeProvider'
import { CookiePreferencesProvider } from './shared/cookies/CookiePreferencesProvider'
import './index.css'
import App from './App.tsx'

// Create a TanStack Query client instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // Data Connect's fetch has no client-side timeout, so a request issued on a
      // connection the browser/OS silently dropped while the tab was idle/backgrounded
      // can hang forever, leaving a page stuck on its loading spinner. Refetching on
      // window focus (the default we were previously opting out of) gives an already-
      // mounted stuck query a fresh attempt as soon as the user comes back to the tab.
      refetchOnWindowFocus: true,
      staleTime: 30_000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CookiePreferencesProvider>
      <ColorModeProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </ColorModeProvider>
    </CookiePreferencesProvider>
  </StrictMode>,
)
