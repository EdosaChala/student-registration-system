import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import StudentLogin from './pages/StudentLogin';
import StudentDashboard from './pages/StudentDashboard';
import StudentRegistration from './pages/StudentRegistration';
import InstructorDashboard from './pages/InstructorDashboard';
import RegistrarDashboard from './pages/RegistrarDashboard';
import DeptHeadDashboard from './pages/DeptHeadDashboard';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <Router>
      <div className="App">
        <Navigation />
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<StudentRegistration />} />
          <Route path="/register" element={<StudentRegistration />} />
          <Route path="/login" element={<StudentLogin />} />
          
          {/* Role-Based Dashboards */}
          <Route path="/student/dashboard" element={<StudentDashboard />} />
          <Route path="/instructor/dashboard" element={<InstructorDashboard />} />
          <Route path="/registrar/dashboard" element={<RegistrarDashboard />} />
          <Route path="/dept-head/dashboard" element={<DeptHeadDashboard />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;