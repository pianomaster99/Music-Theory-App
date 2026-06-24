import { Route, Routes } from 'react-router-dom'
import Home from '@/pages/Home'
import LessonPage from '@/pages/LessonPage'
import StaffDemo from '@/pages/StaffDemo'
import PianoDemo from '@/pages/PianoDemo'
import { Calibrate } from '@/pages/Calibrate'
import Auth from '@/pages/Auth'
import RequireAuth from '@/components/RequireAuth'

export default function App() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Home />
          </RequireAuth>
        }
      />
      <Route
        path="/lesson/:lessonId"
        element={
          <RequireAuth>
            <LessonPage />
          </RequireAuth>
        }
      />
      <Route path="/dev/staff" element={<StaffDemo />} />
      <Route path="/dev/piano" element={<PianoDemo />} />
      <Route path="/dev/calibrate" element={<Calibrate />} />
    </Routes>
  )
}
