import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/lib/auth/AuthProvider'
import { BackgroundProvider } from '@/lib/backgrounds'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <BackgroundProvider>
        <AuthProvider>
          <App />
          <Toaster />
        </AuthProvider>
      </BackgroundProvider>
    </BrowserRouter>
  </StrictMode>,
)
