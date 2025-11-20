import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/Navigation.css';

const Navigation = () => {
  const location = useLocation();
  const userRole = localStorage.getItem('userRole');
  const isLoggedIn = localStorage.getItem('user');

  return (
    <nav className="navbar">
      <div className="nav-container">
        {/* University Branding */}
        <div className="nav-brand">
          <div className="university-brand">
            <h1>Wollega University</h1>
            <span className="system-name">Student Registration System</span>
          </div>
        </div>

        {/* Main Navigation */}
        <div className="nav-menu">
          <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
            🏠 Home
          </Link>
          <Link to="/register" className={`nav-link ${location.pathname === '/register' ? 'active' : ''}`}>
            📝 Student Registration
          </Link>
          
          {/* Show role-specific links only when logged in */}
          {isLoggedIn && userRole === 'student' && (
            <Link to="/student/dashboard" className={`nav-link ${location.pathname === '/student/dashboard' ? 'active' : ''}`}>
              🎓 My Dashboard
            </Link>
          )}
          
          {isLoggedIn && userRole === 'instructor' && (
            <Link to="/instructor/dashboard" className={`nav-link ${location.pathname === '/instructor/dashboard' ? 'active' : ''}`}>
              👨‍🏫 Instructor Dashboard
            </Link>
          )}
          
          {isLoggedIn && userRole === 'department_head' && (
            <Link to="/dept-head/dashboard" className={`nav-link ${location.pathname === '/dept-head/dashboard' ? 'active' : ''}`}>
              🏫 Department Dashboard
            </Link>
          )}
          
          {isLoggedIn && userRole === 'registrar' && (
            <Link to="/registrar/dashboard" className={`nav-link ${location.pathname === '/registrar/dashboard' ? 'active' : ''}`}>
              📋 Registrar Dashboard
            </Link>
          )}
          
          {isLoggedIn && userRole === 'administrator' && (
            <Link to="/admin/dashboard" className={`nav-link ${location.pathname === '/admin/dashboard' ? 'active' : ''}`}>
              ⚙️ Admin Dashboard
            </Link>
          )}

          <Link to="/reports" className={`nav-link ${location.pathname === '/reports' ? 'active' : ''}`}>
            📊 Reports
          </Link>
          <Link to="/about" className={`nav-link ${location.pathname === '/about' ? 'active' : ''}`}>
            ℹ️ About
          </Link>
        </div>

        {/* User Actions */}
        <div className="nav-actions">
          {isLoggedIn ? (
            <div className="user-info">
              <span>Welcome, {JSON.parse(localStorage.getItem('user')).first_name}</span>
              <button 
                onClick={() => {
                  localStorage.clear();
                  window.location.href = '/';
                }} 
                className="logout-btn"
              >
                🚪 Logout
              </button>
            </div>
          ) : (
            <Link to="/login" className="login-btn">
              🔐 University Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;