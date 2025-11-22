import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import '../styles/Auth.css';

const StudentLogin = () => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000';
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await axios.post(`${API_BASE_URL}/api/login/`, formData, {
        headers: {
          'Content-Type': 'application/json',
        },
        withCredentials: true
      });

      console.log('🔐 Login response:', response.data); // Debug log

      // FIX 1: Check if response has the expected structure
      if (!response.data || !response.data.user) {
        throw new Error('Invalid response from server');
      }

      // FIX 2: Handle different possible role structures
      let userRole;
      if (response.data.role) {
        // Handle both {role: 'instructor'} and role object structures
        userRole = typeof response.data.role === 'string' 
          ? response.data.role 
          : response.data.role.role;
      } else if (response.data.user.role) {
        userRole = response.data.user.role;
      } else {
        throw new Error('Role information missing in response');
      }

      const userId = response.data.user.id;
      
      // FIX 3: Store ALL required authentication data
      localStorage.setItem('isAuthenticated', 'true'); // ← THIS WAS MISSING!
      localStorage.setItem('user', JSON.stringify(response.data.user));
      localStorage.setItem('userRole', userRole);
      localStorage.setItem('userId', userId);
      
      console.log('💾 Stored auth data:', { // Debug log
        isAuthenticated: 'true',
        userRole: userRole,
        userId: userId,
        user: response.data.user
      });

      // FIX 4: Redirect based on role with fallback
      const roleRoutes = {
        'student': '/student/dashboard',
        'instructor': '/instructor/dashboard', 
        'department_head': '/dept-head/dashboard',
        'registrar': '/registrar/dashboard',
        'administrator': '/admin/dashboard'
      };

      const route = roleRoutes[userRole];
      if (route) {
        navigate(route);
      } else {
        console.warn('Unknown role, redirecting to home');
        navigate('/');
      }
      
    } catch (error) {
      console.error('❌ Login error:', error);
      
      // FIX 5: Better error handling
      if (error.response) {
        // Server responded with error status
        setError(error.response.data.error || error.response.data.message || 'Login failed');
      } else if (error.request) {
        // Request made but no response
        setError('Network error. Please check your connection.');
      } else {
        // Other errors
        setError(error.message || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };
  // After successful login, check if session cookie is set
const checkSession = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/debug/auth-status/`, {
      withCredentials: true,
    });
    console.log('Session check after login:', response.data);
  } catch (error) {
    console.error('Session check failed:', error);
  }
};

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>University Login</h2>
        <p className="auth-subtitle">Login to access your portal</p>
        
        {message && <div className="message success">{message}</div>}
        {error && <div className="message error">{error}</div>}
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Username</label>
            <input 
              type="text" 
              name="username" 
              value={formData.username} 
              onChange={handleInputChange} 
              required 
              disabled={loading}
              placeholder="Enter your username"
            />
          </div>
          
          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              name="password" 
              value={formData.password} 
              onChange={handleInputChange} 
              required 
              disabled={loading}
              placeholder="Enter your password"
            />
          </div>
          
          <button 
            type="submit" 
            className="auth-btn"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        <div className="auth-footer">
          <p>Don't have an account? <Link to="/register">Register here</Link></p>
          <p><small>Students, Instructors, and Staff can login here</small></p>
        </div>
      </div>
    </div>
  );
};

export default StudentLogin;