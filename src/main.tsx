import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { ColorModeProvider } from './shared/appShell/ColorModeProvider'
import { CookiePreferencesProvider } from './shared/cookies/CookiePreferencesProvider'
import './index.css'
import App from './App.tsx'
import { queryClient } from './shared/query/queryClient'

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
