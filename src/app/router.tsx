import { Navigate, Route, Routes } from 'react-router-dom';

import AppShell from './layouts/AppShell';

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/discovery/detection" replace />} />
      <Route path="/discovery/screenshot" element={<AppShell />} />
      <Route path="/discovery/detection" element={<AppShell />} />
      <Route path="/discovery/results" element={<AppShell />} />
      <Route path="/candidates" element={<AppShell />} />
      <Route path="/candidates/:candidateId" element={<AppShell />} />
      <Route path="/leads" element={<AppShell />} />
      <Route path="/leads/:leadId" element={<AppShell />} />
      <Route path="/projects" element={<AppShell />} />
      <Route path="/projects/:projectId" element={<AppShell />} />
      <Route path="*" element={<Navigate to="/discovery/detection" replace />} />
    </Routes>
  );
}
