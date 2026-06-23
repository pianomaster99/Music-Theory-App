import { Route, Routes } from 'react-router-dom'
import Home from '@/pages/Home'
import LessonPlaceholder from '@/pages/LessonPlaceholder'
import StaffDemo from '@/pages/StaffDemo'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/lesson/:lessonId" element={<LessonPlaceholder />} />
      <Route path="/dev/staff" element={<StaffDemo />} />
    </Routes>
  )
}
