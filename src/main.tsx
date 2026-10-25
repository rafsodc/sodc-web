import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ColorModeProvider } from './shared/appShell/ColorModeProvider'
import { CookiePreferencesProvider } from './shared/cookies/CookiePreferencesProvider'
import './index.css'
import App from './App.tsx'
import PrivateSessionBoundary from './shared/appShell/PrivateSessionBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CookiePreferencesProvider>
      <ColorModeProvider>
        <PrivateSessionBoundary>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </PrivateSessionBoundary>
      </ColorModeProvider>
    </CookiePreferencesProvider>
  </StrictMode>,
)
