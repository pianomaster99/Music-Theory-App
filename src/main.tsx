import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/lib/auth/AuthProvider'
import { AppBackground } from '@/lib/backgrounds'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppBackground>
        <AuthProvider>
          <App />
          <Toaster />
        </AuthProvider>
      </AppBackground>
    </BrowserRouter>
  </StrictMode>,
)
