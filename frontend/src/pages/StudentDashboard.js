import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Dashboard.css';

// Configure axios for authentication - ENHANCED VERSION
axios.defaults.withCredentials = true;
axios.defaults.xsrfCookieName = 'csrftoken';
axios.defaults.xsrfHeaderName = 'X-CSRFToken';

// Enhanced CSRF token helper
const getCSRFToken = () => {
  const name = 'csrftoken';
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        return decodeURIComponent(cookie.substring(name.length + 1));
      }
    }
  }
  return null;
};

// Add request interceptor to ensure credentials are sent
axios.interceptors.request.use(
  (config) => {
    // Ensure withCredentials is true for all requests
    config.withCredentials = true;
    
    // Add CSRF token if available
    const csrfToken = getCSRFToken();
    if (csrfToken) {
      config.headers['X-CSRFToken'] = csrfToken;
    }
    
    // Add content type for all requests
    if (!config.headers['Content-Type']) {
      config.headers['Content-Type'] = 'application/json';
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle auth errors
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403 || error.response?.status === 401) {
      console.error('Authentication error:', error.response);
      // You can redirect to login page here if needed
    }
    return Promise.reject(error);
  }
);

const StudentDashboard = () => {
  const [student, setStudent] = useState(null);
  const [grades, setGrades] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [courseSlip, setCourseSlip] = useState(null);
  const [gpa, setGpa] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // First, ensure we have a CSRF token
    ensureCSRFToken().then(() => {
      fetchStudentData();
    });
  }, []);

  // Function to ensure CSRF token is available
  const ensureCSRFToken = async () => {
    try {
      const csrfToken = getCSRFToken();
      if (!csrfToken) {
        console.log('🔄 Fetching CSRF token...');
        await axios.get('http://127.0.0.1:8000/api/csrf-token/');
        console.log('✅ CSRF token fetched');
      } else {
        console.log('✅ CSRF token already available:', csrfToken);
      }
    } catch (error) {
      console.error('❌ Error fetching CSRF token:', error);
    }
  };

  // Enhanced data fetching with proper authentication
  const fetchStudentData = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('🔄 Starting student data fetch...');
      console.log('🔐 Current CSRF token:', getCSRFToken());

      // Check authentication status first
      try {
        const authCheck = await axios.get('http://127.0.0.1:8000/api/debug/auth-status/');
        console.log('🔐 Auth status:', authCheck.data);
      } catch (authError) {
        console.error('❌ Auth check failed:', authError);
      }

      // Fetch student data
      const studentResponse = await axios.get('http://127.0.0.1:8000/api/students/');
      console.log('📊 All students:', studentResponse.data);
      
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      console.log('👤 Current user from localStorage:', currentUser);
      
      const currentStudent = studentResponse.data.find(s => {
        if (s.user && typeof s.user === 'object') {
          return s.user.username === currentUser.username || 
                 s.user.email === currentUser.email ||
                 s.user.id === currentUser.id;
        }
        return false;
      });

      if (currentStudent) {
        console.log('✅ Found student:', currentStudent);
        setStudent(currentStudent);
        
        await Promise.all([
          fetchStudentGrades(currentStudent.id),
          fetchStudentRegistrations(currentStudent.id),
          fetchCurrentCourseSlip()
        ]);
      } else {
        console.log('❌ No student record found for user:', currentUser);
        setError('No student record found for your account. Please contact administrator.');
      }
    } catch (error) {
      console.error('❌ Error fetching student data:', error);
      handleAuthError(error);
    } finally {
      setLoading(false);
    }
  };

  // Enhanced error handling for authentication
  const handleAuthError = (error) => {
    if (error.response?.status === 403 || error.response?.status === 401) {
      setError('Authentication failed. Please log in again.');
      // Optionally redirect to login page
      // window.location.href = '/login';
    } else {
      setError('Failed to load student data. Please try again.');
    }
  };

  // CORRECTED course slip fetching with proper student filtering
const fetchCurrentCourseSlip = async () => {
  try {
    setLoading(true);

    // Get current user
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!currentUser || !currentUser.id) {
      console.log('❌ No user found in localStorage');
      setCourseSlip(null);
      return;
    }

    // Get all students to find the current one
    const studentsResponse = await axios.get('http://127.0.0.1:8000/api/students/');
    const currentStudent = studentsResponse.data.find(s => {
      if (s.user && typeof s.user === 'object') {
        return s.user.id === currentUser.id;
      }
      return false;
    });

    if (!currentStudent) {
      console.log('❌ No student record found for user:', currentUser);
      setCourseSlip(null);
      return;
    }

    console.log('🎯 Current student found:', currentStudent);

    // Try endpoints with proper student filtering
    const endpoints = [
      `http://127.0.0.1:8000/api/course-slips/?student=${currentStudent.id}`,
      `http://127.0.0.1:8000/api/course-slips/student/${currentStudent.id}/`,
      `http://127.0.0.1:8000/api/student/course-slip/?student_id=${currentStudent.id}`,
      'http://127.0.0.1:8000/api/student/course-slip/',
    ];

    let courseSlipData = null;

    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Trying endpoint: ${endpoint}`);
        const response = await axios.get(endpoint);
        
        if (response.data) {
          // Handle array response - filter by current student
          if (Array.isArray(response.data) && response.data.length > 0) {
            // Find course slip for current student
            const studentCourseSlip = response.data.find(slip => {
              const slipStudentId = typeof slip.student === 'object' ? slip.student.id : slip.student;
              return slipStudentId == currentStudent.id;
            });
            
            if (studentCourseSlip) {
              courseSlipData = studentCourseSlip;
              console.log(`✅ Found course slip for student at: ${endpoint}`);
              break;
            }
          }
          // Handle single object response - verify it belongs to current student
          else if (response.data && typeof response.data === 'object') {
            const slipStudentId = typeof response.data.student === 'object' ? 
                                 response.data.student.id : response.data.student;
            
            if (slipStudentId == currentStudent.id) {
              courseSlipData = response.data;
              console.log(`✅ Found course slip object for student at: ${endpoint}`);
              break;
            } else {
              console.log('❌ Course slip belongs to different student:', slipStudentId, 'expected:', currentStudent.id);
            }
          }
        }
      } catch (error) {
        console.log(`❌ Endpoint failed: ${endpoint}`, error.response?.status);
        continue;
      }
    }

    if (courseSlipData) {
      // Process the course slip data
      if (courseSlipData.course_details && courseSlipData.course_details.length > 0) {
        courseSlipData.courses = courseSlipData.course_details;
      }
      
      // Verify the course slip belongs to the correct department
      const slipDepartment = courseSlipData.department_name || 
                           (courseSlipData.student && typeof courseSlipData.student === 'object' ? 
                            courseSlipData.student.department_name : null);
      
      const studentDepartment = currentStudent.department_name;
      
      if (slipDepartment && studentDepartment && slipDepartment !== studentDepartment) {
        console.warn('⚠️ Department mismatch:', {
          slipDepartment,
          studentDepartment,
          courseSlipData
        });
      }
      
      setCourseSlip(courseSlipData);
    } else {
      console.log('❌ No course slip data found for current student');
      setCourseSlip(null);
    }

  } catch (error) {
    console.error('Error fetching course slip:', error);
    setCourseSlip(null);
  } finally {
    setLoading(false);
  }
};
  const fetchStudentGrades = async (studentId) => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/api/grades/');
      const studentGrades = response.data.filter(grade => {
        const gradeStudentId = typeof grade.student === 'object' ? grade.student.id : grade.student;
        return gradeStudentId == studentId;
      });
      
      const validatedGrades = studentGrades.map(validateAndCapGradePoints);
      setGrades(validatedGrades);
    } catch (error) {
      console.error('Error fetching grades:', error);
      setGrades([]);
    }
  };

  const fetchStudentRegistrations = async (studentId) => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/api/registrations/');
      const studentRegistrations = response.data.filter(reg => {
        const regStudentId = typeof reg.student === 'object' ? reg.student.id : reg.student;
        return regStudentId == studentId;
      });
      setRegistrations(studentRegistrations);
    } catch (error) {
      console.error('Error fetching registrations:', error);
      setRegistrations([]);
    }
  };

  const validateAndCapGradePoints = (grade) => {
    if (!grade.points) return grade;
    
    return {
      ...grade,
      points: Math.min(parseFloat(grade.points), 4.00)
    };
  };

  const calculateAndSetGPA = () => {
    if (grades.length === 0) {
      setGpa('0.00');
      return;
    }
    
    let totalQualityPoints = 0;
    let totalCredits = 0;
    
    console.log('Calculating GPA with grades:', grades);
    
    grades.forEach(grade => {
      if (grade.is_published !== false && 
          grade.points !== null && grade.points !== undefined && 
          grade.course_credits) {
        
        const points = parseFloat(grade.points);
        const credits = parseFloat(grade.course_credits);
        
        if (!isNaN(points) && !isNaN(credits) && credits > 0) {
          const cappedPoints = Math.min(points, 4.00);
          totalQualityPoints += cappedPoints * credits;
          totalCredits += credits;
        }
      }
    });
    
    if (totalCredits === 0) {
      setGpa('0.00');
    } else {
      const calculatedGPA = totalQualityPoints / totalCredits;
      const finalGPA = Math.min(calculatedGPA, 4.00).toFixed(2);
      setGpa(finalGPA);
    }
  };

  const calculateQualityPoints = (grade) => {
    if (!grade.points || !grade.course_credits || grade.is_published === false) return 'N/A';
    
    const points = parseFloat(grade.points);
    const credits = parseFloat(grade.course_credits);
    
    if (isNaN(points) || isNaN(credits)) return 'N/A';
    
    const cappedPoints = Math.min(points, 4.00);
    return (cappedPoints * credits).toFixed(2);
  };

  const getTotalCourses = () => {
    return registrations.reduce((total, reg) => total + (reg.courses_details?.length || reg.courses?.length || 0), 0);
  };

  const getCompletedCredits = () => {
    return grades.reduce((total, grade) => {
      if (grade.points && grade.points > 0 && grade.course_credits && grade.is_published !== false) {
        return total + parseFloat(grade.course_credits);
      }
      return total;
    }, 0);
  };

  const getGradedCoursesCount = () => {
    return grades.filter(grade => 
      grade.points && grade.points > 0 && grade.course_credits && grade.is_published !== false
    ).length;
  };

  const getGradeBadgeClass = (grade) => {
    if (!grade) return 'grade-na';
    
    const gradeValue = grade.grade || grade;
    if (gradeValue === 'A+' || gradeValue === 'A') return 'grade-a';
    if (gradeValue === 'A-') return 'grade-a-minus';
    if (gradeValue === 'B+') return 'grade-b-plus';
    if (gradeValue === 'B') return 'grade-b';
    if (gradeValue === 'B-') return 'grade-b-minus';
    if (gradeValue === 'C+') return 'grade-c-plus';
    if (gradeValue === 'C') return 'grade-c';
    if (gradeValue === 'C-') return 'grade-c-minus';
    if (gradeValue === 'D') return 'grade-d';
    if (gradeValue === 'F') return 'grade-f';
    if (gradeValue === 'I') return 'grade-i';
    return 'grade-na';
  };

  // Helper to get course info from grade object
  const getCourseInfo = (grade) => {
    if (typeof grade.course === 'object') {
      return {
        code: grade.course.code,
        name: grade.course.name,
        credits: grade.course.credits
      };
    }
    return {
      code: grade.course_code,
      name: grade.course_name,
      credits: grade.course_credits
    };
  };

  // Helper to get semester info from grade object
  const getSemesterInfo = (grade) => {
    if (typeof grade.semester === 'object') {
      return grade.semester.name;
    }
    return grade.semester_name;
  };

  // Refresh course slip data
  const refreshCourseSlip = async () => {
    setLoading(true);
    try {
      await fetchCurrentCourseSlip();
      console.log('✅ Course slip refreshed successfully');
    } catch (error) {
      console.error('Error refreshing course slip:', error);
    } finally {
      setLoading(false);
    }
  };
   useEffect(() => {
    const checkLoginStatus = () => {
      const user = localStorage.getItem('user');
      if (!user) {
        setError('You are not logged in. Please log in first.');
        setLoading(false);
        return false;
      }
      return true;
    };

    if (!checkLoginStatus()) {
      return;
    }
  }, []);

  // Add a retry function with re-authentication
  const retryWithAuth = async () => {
    // Clear any existing errors
    setError('');
    
    // Ensure we have a fresh CSRF token
    await ensureCSRFToken();
    
    // Retry fetching data
    await fetchStudentData();
  };
// Add this function to test authentication
const testAuthentication = async () => {
  try {
    console.log('🔐 Testing authentication...');
    
    // First get CSRF token
    await axios.get('http://127.0.0.1:8000/api/csrf-token/', {
      withCredentials: true
    });
    
    // Then test auth status
    const authResponse = await axios.get('http://127.0.0.1:8000/api/debug/auth-status/', {
      withCredentials: true
    });
    
    console.log('🔐 Auth status test:', authResponse.data);
    return authResponse.data;
  } catch (error) {
    console.error('❌ Auth test failed:', error);
    return null;
  }
};

// Call this in your useEffect or when component mounts
useEffect(() => {
  testAuthentication();
}, []);
  // Update your error display to include retry option
  if (error && !student) {
    return (
      <div className="dashboard">
        <div className="error-message">
          <h3>Authentication Required</h3>
          <p>{error}</p>
          <div className="error-actions">
            <button onClick={retryWithAuth} className="retry-btn">Retry</button>
            <button onClick={() => window.location.href = '/login'} className="btn-primary">
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

// CORRECTED Course Slip Tab Rendering with department validation
const renderCourseSlipTab = () => {
  // Check if course slip exists and has courses - prioritize course_details
  const hasCourses = courseSlip && courseSlip.course_details && courseSlip.course_details.length > 0;

  if (!hasCourses) {
    return (
      <div className="no-data-message">
        <h3>No Course Slip Available</h3>
        <p>Your course slip for the current semester has not been assigned yet.</p>
        <p>Please contact your department or registrar for course assignment.</p>
        <div className="course-slip-info">
          <p><strong>Student:</strong> {student?.first_name} {student?.last_name}</p>
          <p><strong>Department:</strong> {student?.department_name}</p>
          <p><strong>Year:</strong> {student?.year}</p>
          <p><strong>Student ID:</strong> {student?.student_id}</p>
        </div>
        <div className="refresh-section">
          <button className="btn-primary" onClick={refreshCourseSlip}>
            🔄 Check Again
          </button>
        </div>
      </div>
    );
  }

  // ALWAYS use course_details for the actual course data
  const courses = courseSlip.course_details || [];
  
  // Check if courses match student's department
  const studentDepartment = student?.department_name;
  const departmentMismatch = studentDepartment && 
    courses.some(course => course.department_name !== studentDepartment);

  return (
    <div className="course-slip-section">
      <div className="course-slip-header">
        <h2>Course Slip - {courseSlip.semester?.name || courseSlip.semester_name || 'Current Semester'}</h2>
        {departmentMismatch && (
          <div className="warning-message">
            ⚠️ Some courses may not belong to your department. Please contact your advisor.
          </div>
        )}
        <div className="slip-info">
          <p><strong>Academic Year:</strong> {courseSlip.academic_year?.name || courseSlip.academic_year_name || 'N/A'}</p>
          <p><strong>Total Credits:</strong> {courseSlip.total_credits || courses.reduce((total, course) => total + (parseInt(course.credits) || 0), 0)}</p>
          <p><strong>Student Department:</strong> {studentDepartment || 'N/A'}</p>
          <p><strong>Status:</strong> 
            <span className={`status-badge ${courseSlip.is_approved ? 'approved' : 'pending'}`}>
              {courseSlip.is_approved ? 'APPROVED' : 'PENDING APPROVAL'}
            </span>
          </p>
        </div>
      </div>

      <div className="courses-table-container">
        <table className="courses-table">
          <thead>
            <tr>
              <th>Course Code</th>
              <th>Course Name</th>
              <th>Credits</th>
              <th>Department</th>
              <th>Year</th>
              <th>Instructor</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course, index) => {
              const isCorrectDepartment = course.department_name === studentDepartment;
              return (
                <tr key={course.id || index} className={!isCorrectDepartment ? 'wrong-department' : ''}>
                  <td>{course.code}</td>
                  <td>{course.name}</td>
                  <td>{course.credits}</td>
                  <td>
                    {course.department_name}
                    {!isCorrectDepartment && ' ⚠️'}
                  </td>
                  <td>Year {course.year}</td>
                  <td>{course.instructor_name}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Rest of the component remains the same */}
      <div className="course-slip-summary">
        <div className="summary-card">
          <h4>Course Slip Summary</h4>
          <div className="summary-details">
            <div className="summary-item">
              <span className="label">Total Courses:</span>
              <span className="value">{courses.length}</span>
            </div>
            <div className="summary-item">
              <span className="label">Total Credits:</span>
              <span className="value">{courseSlip.total_credits || courses.reduce((total, course) => total + (parseInt(course.credits) || 0), 0)}</span>
            </div>
            <div className="summary-item">
              <span className="label">Your Department:</span>
              <span className="value">{studentDepartment || 'N/A'}</span>
            </div>
            {courseSlip.assigned_by && (
              <div className="summary-item">
                <span className="label">Assigned By:</span>
                <span className="value">
                  {courseSlip.assigned_by_name || 'N/A'}
                </span>
              </div>
            )}
            {courseSlip.assigned_date && (
              <div className="summary-item">
                <span className="label">Assigned Date:</span>
                <span className="value">{new Date(courseSlip.assigned_date).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="course-slip-actions">
        <button className="btn-primary" onClick={() => window.print()}>
          🖨️ Print Course Slip
        </button>
        <button className="btn-secondary" onClick={refreshCourseSlip}>
          🔄 Refresh
        </button>
        {departmentMismatch && (
          <button className="btn-warning" onClick={() => alert('Please contact your department advisor to correct your course assignments.')}>
            🚨 Report Issue
          </button>
        )}
      </div>
    </div>
  );
};

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading student data...</p>
        </div>
      </div>
    );
  }

  if (error && !student) {
    return (
      <div className="dashboard">
        <div className="error-message">
          <h3>Error Loading Dashboard</h3>
          <p>{error}</p>
          <div className="error-actions">
            <button onClick={fetchStudentData} className="retry-btn">Retry</button>
            <a href="/login" className="btn-primary">Go to Login</a>
          </div>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="dashboard">
        <div className="no-data">
          <h3>No Student Data Found</h3>
          <p>Please register students first through the registration form.</p>
          <a href="/" className="btn-primary">Go to Registration</a>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="welcome-section">
          <h1>Welcome, {student.first_name}!</h1>
          <p>Student ID: {student.student_id} | {student.department_name}</p>
        </div>
        <div className="academic-info">
          <span className="academic-year">Year {student.year} Student</span>
          <span className="program">{student.program_name}</span>
          <span className="cumulative-gpa">Cumulative GPA: <strong>{gpa}/4.00</strong></span>
        </div>
      </div>

      <div className="dashboard-tabs">
        <button 
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Overview
        </button>
        <button 
  className={`tab-btn ${activeTab === 'course-slip' ? 'active' : ''}`}
  onClick={() => setActiveTab('course-slip')}
>
  📋 Course Slip {
    courseSlip && (courseSlip.courses || courseSlip.course_details) ? 
    `(${(courseSlip.courses || courseSlip.course_details).length})` : 
    ''
  }
</button>
        <button 
          className={`tab-btn ${activeTab === 'grades' ? 'active' : ''}`}
          onClick={() => setActiveTab('grades')}
        >
          📝 Grades & Transcript
        </button>
        <button 
          className={`tab-btn ${activeTab === 'courses' ? 'active' : ''}`}
          onClick={() => setActiveTab('courses')}
        >
          📚 Registered Courses
        </button>
        <button 
          className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          👤 Profile
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="overview-section">
            <h2>Academic Overview</h2>
            <div className="overview-grid">
              <div className="stat-card primary">
                <h3>Registered Courses</h3>
                <div className="stat-number">{getTotalCourses()}</div>
                <p>Total enrolled courses</p>
              </div>
              <div className="stat-card success">
                <h3>Cumulative GPA</h3>
                <div className="stat-number">{gpa}/4.00</div>
                <p>Overall academic performance</p>
              </div>
              <div className="stat-card info">
                <h3>Academic Year</h3>
                <div className="stat-number">Year {student.year}</div>
                <p>Current year of study</p>
              </div>
              <div className="stat-card warning">
                <h3>Completed Credits</h3>
                <div className="stat-number">{getCompletedCredits()}</div>
                <p>Total credits earned</p>
              </div>
            </div>

            <div className="recent-grades">
              <h3>Recent Grades</h3>
              {grades.length > 0 ? (
                <div className="grades-mini-table">
                  {grades.slice(0, 5).map((grade, index) => {
                    const courseInfo = getCourseInfo(grade);
                    return (
                      <div key={grade.id || index} className="grade-item">
                        <span className="course-code">{courseInfo.code}</span>
                        <span className="course-name">{courseInfo.name}</span>
                        <span className={`grade-badge ${getGradeBadgeClass(grade)}`}>
                          {grade.grade} ({Math.min(parseFloat(grade.points || 0), 4.00).toFixed(2)})
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="no-data-message">No grades available yet.</p>
              )}
            </div>

          {/* Course Slip Preview in Overview */}
<div className="course-slip-preview">
  <h3>Current Course Slip</h3>
  {courseSlip && (courseSlip.courses || courseSlip.course_details) && 
   ((courseSlip.courses && courseSlip.courses.length > 0) || 
    (courseSlip.course_details && courseSlip.course_details.length > 0)) ? (
    <div className="preview-courses">
      <p><strong>Semester:</strong> {courseSlip.semester?.name || courseSlip.semester_name || 'Current'}</p>
      <p><strong>Total Courses:</strong> {(courseSlip.courses || courseSlip.course_details).length}</p>
      <p><strong>Total Credits:</strong> {courseSlip.total_credits || (courseSlip.courses || courseSlip.course_details).reduce((total, course) => total + (parseInt(course.credits) || 0), 0)}</p>
      <div className="preview-course-list">
        {(courseSlip.courses || courseSlip.course_details).slice(0, 3).map((course, index) => (
          <div key={course.id || index} className="preview-course-item">
            <span>{course.code || 'N/A'}</span>
            <span>{course.name || 'N/A'}</span>
            <span>{course.credits || '0'} cr</span>
          </div>
        ))}
        {(courseSlip.courses || courseSlip.course_details).length > 3 && (
          <div className="more-courses">
            +{(courseSlip.courses || courseSlip.course_details).length - 3} more courses
          </div>
        )}
      </div>
      <button 
        className="btn-secondary"
        onClick={() => setActiveTab('course-slip')}
      >
        View Full Course Slip
      </button>
    </div>
  ) : (
    <div className="no-course-slip">
      <p>No course slip assigned for current semester.</p>
      <button 
        className="btn-primary"
        onClick={() => setActiveTab('course-slip')}
      >
        Check Course Slip Status
      </button>
    </div>
  )}
</div>
          </div>
        )}

        {activeTab === 'course-slip' && renderCourseSlipTab()}

        {activeTab === 'grades' && (
          <div className="grades-section">
            <div className="section-header">
              <h2>Academic Transcript</h2>
              <div className="transcript-summary">
                <span>Cumulative GPA: <strong>{gpa}/4.00</strong></span>
                <span>Graded Courses: <strong>{getGradedCoursesCount()}</strong></span>
                <span>Total Credits: <strong>{getCompletedCredits()}</strong></span>
              </div>
            </div>
            
            {grades.length > 0 ? (
              <div className="grades-table-container">
                <table className="grades-table">
                  <thead>
                    <tr>
                      <th>Course Code</th>
                      <th>Course Name</th>
                      <th>Credits</th>
                      <th>Grade</th>
                      <th>Points</th>
                      <th>Quality Points</th>
                      <th>Semester</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grades.map((grade) => {
                      const courseInfo = getCourseInfo(grade);
                      const semesterInfo = getSemesterInfo(grade);
                      const cappedPoints = Math.min(parseFloat(grade.points || 0), 4.00);
                      
                      return (
                        <tr key={grade.id}>
                          <td>{courseInfo.code}</td>
                          <td>{courseInfo.name}</td>
                          <td>{courseInfo.credits || 'N/A'}</td>
                          <td>
                            <span className={`grade-badge ${getGradeBadgeClass(grade)}`}>
                              {grade.grade || 'N/A'}
                            </span>
                          </td>
                          <td>{grade.points ? cappedPoints.toFixed(2) : 'N/A'}</td>
                          <td>{calculateQualityPoints(grade)}</td>
                          <td>{semesterInfo || 'N/A'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="no-data-message">
                <h3>No Grades Available</h3>
                <p>Your grades will appear here once they are published by your instructors.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'courses' && (
          <div className="courses-section">
            <h2>Registered Courses</h2>
            {registrations.length > 0 ? (
              <div className="registrations-list">
                {registrations.map(registration => (
                  <div key={registration.id} className="registration-card">
                    <div className="semester-header">
                      <h4>{registration.semester_name || registration.semester?.name}</h4>
                      <span className="registration-date">
                        Registered: {new Date(registration.registered_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="courses-grid">
                      {registration.courses_details?.map(course => (
                        <div key={course.id} className="course-card">
                          <h5>{course.code}</h5>
                          <p className="course-title">{course.name}</p>
                          <div className="course-meta">
                            <span className="credits">{course.credits} Credits</span>
                            <span className="semester">Semester {course.semester}</span>
                          </div>
                        </div>
                      )) || 
                      registration.courses?.map(course => (
                        <div key={course.id} className="course-card">
                          <h5>{course.code}</h5>
                          <p className="course-title">{course.name}</p>
                          <div className="course-meta">
                            <span className="credits">{course.credits} Credits</span>
                            <span className="semester">Semester {course.semester}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-data-message">
                <h3>No Course Registrations</h3>
                <p>You haven't registered for any courses yet.</p>
                <a href="/courses" className="btn-primary">Browse Courses</a>
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="profile-section">
            <h2>Student Profile</h2>
            <div className="profile-card">
              <div className="profile-header">
                <h3>{student.first_name} {student.last_name}</h3>
                <span className="student-id">{student.student_id}</span>
              </div>
              
              <div className="profile-grid">
                <div className="profile-field">
                  <label>Full Name:</label>
                  <span>{student.first_name} {student.last_name}</span>
                </div>
                <div className="profile-field">
                  <label>Student ID:</label>
                  <span>{student.student_id}</span>
                </div>
                <div className="profile-field">
                  <label>Email:</label>
                  <span>{student.email}</span>
                </div>
                <div className="profile-field">
                  <label>Phone:</label>
                  <span>{student.phone}</span>
                </div>
                <div className="profile-field">
                  <label>Gender:</label>
                  <span>{student.gender === 'M' ? 'Male' : 'Female'}</span>
                </div>
                <div className="profile-field">
                  <label>Department:</label>
                  <span>{student.department_name}</span>
                </div>
                <div className="profile-field">
                  <label>Program:</label>
                  <span>{student.program_name}</span>
                </div>
                <div className="profile-field">
                  <label>Year:</label>
                  <span>Year {student.year}</span>
                </div>
                <div className="profile-field">
                  <label>Cumulative GPA:</label>
                  <span className="gpa-value">{gpa}/4.00</span>
                </div>
                <div className="profile-field">
                  <label>Registration Date:</label>
                  <span>{new Date(student.registration_date).toLocaleDateString()}</span>
                </div>
                <div className="profile-field">
                  <label>Status:</label>
                  <span className={`status ${student.is_active ? 'active' : 'inactive'}`}>
                    {student.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;