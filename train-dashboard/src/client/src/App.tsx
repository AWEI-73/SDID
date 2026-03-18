import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import ClassesPage from './pages/ClassesPage'
import ImportPage from './pages/ImportPage'
import NodeManagementPage from './pages/NodeManagementPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="classes" element={<ClassesPage />} />
        <Route path="classes/:classId/nodes" element={<NodeManagementPage />} />
        <Route path="import" element={<ImportPage />} />
      </Route>
    </Routes>
  )
}
