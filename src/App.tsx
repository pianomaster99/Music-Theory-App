import { Navigate, Route, Routes } from 'react-router-dom'
import Landing from '@/pages/Landing'
import Home from '@/pages/Home'
import LessonPage from '@/pages/LessonPage'
import StaffDemo from '@/pages/StaffDemo'
import PianoDemo from '@/pages/PianoDemo'
import ChoirDemo from '@/pages/ChoirDemo'
import MascotDemo from '@/pages/MascotDemo'
import MascotPianoDemo from '@/pages/MascotPianoDemo'
import MascotChoirDemo from '@/pages/MascotChoirDemo'
import { Calibrate } from '@/pages/Calibrate'
import TunerDemo from '@/pages/TunerDemo'
import GameHome from '@/pages/GameHome'
import GameRoom from '@/pages/GameRoom'
import SoloRace from '@/pages/SoloRace'
import Auth from '@/pages/Auth'
import Onboarding from '@/pages/Onboarding'
import RequireAuth from '@/components/RequireAuth'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route
        path="/map"
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
      <Route path="/dev/choir" element={<ChoirDemo />} />
      <Route path="/dev/mascot-demo" element={<MascotDemo />} />
      <Route path="/dev/mascot-piano" element={<MascotPianoDemo />} />
      <Route path="/dev/mascot-choir" element={<MascotChoirDemo />} />
      <Route path="/dev/calibrate" element={<Calibrate />} />
      <Route path="/dev/tuner" element={<TunerDemo />} />
      <Route path="/play" element={<GameHome />} />
      <Route path="/play/solo" element={<SoloRace />} />
      <Route path="/play/:roomId" element={<GameRoom />} />
      {/* Unknown URLs fall back to the landing page instead of a blank screen. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
