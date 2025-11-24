import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/InstructorDashboard.css';
// Configure axios for CSRF
axios.defaults.xsrfCookieName = 'csrftoken';
axios.defaults.xsrfHeaderName = 'X-CSRFToken';
axios.defaults.withCredentials = true;
const InstructorDashboard = () => {
  const [activeTab, setActiveTab] = useState('courses');
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [gradeEntries, setGradeEntries] = useState({});
  const [semesters, setSemesters] = useState([]);

  const navigate = useNavigate();
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000';
  // Grade configuration
  const gradeOptions = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F', 'I'];
  
  const convertGradeToPoint = (grade) => {
    const gradePoints = {
      'A+': 4.00, 'A': 4.00, 'A-': 3.75,
      'B+': 3.50, 'B': 3.00, 'B-': 2.75,
      'C+': 2.50, 'C': 2.00, 'C-': 1.75,
      'D': 1.00, 
      'F': 0.00, 'I': null,
    };
    return gradePoints[grade] || 0.0;
  };

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = () => {
    const userRole = localStorage.getItem('userRole');
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    console.log('🔐 Auth Check:', { userRole, isAuthenticated, user });
    
    if (isAuthenticated !== 'true' || !user.id) {
      setError('Please login to access this page.');
      setTimeout(() => navigate('/login'), 2000);
      return false;
    }
    
    if (userRole !== 'instructor') {
      setError('Access denied. Instructor access required.');
      setTimeout(() => navigate('/login'), 2000);
      return false;
    }
    
    fetchInstructorData();
    return true;
  };

  const fetchInstructorData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const instructorId = user.id;

      console.log('👤 Starting data fetch for instructor ID:', instructorId);

      if (!instructorId) {
        throw new Error('Unable to identify instructor. Please login again.');
      }

      // Fetch all data in parallel with better error handling
      const requests = [
        axios.get(`${API_BASE_URL}/api/courses/`, { withCredentials: true })
          .then(response => {
            console.log('✅ Courses loaded:', response.data?.length);
            return response.data || [];
          })
          .catch(error => {
            console.error('❌ Courses fetch failed:', error);
            return [];
          }),

        axios.get(`${API_BASE_URL}/api/students/`, { withCredentials: true })
          .then(response => {
            console.log('✅ Students loaded:', response.data?.length);
            return response.data || [];
          })
          .catch(error => {
            console.error('❌ Students fetch failed:', error);
            return [];
          }),

        axios.get(`${API_BASE_URL}/api/grades/`, { withCredentials: true })
          .then(response => {
            console.log('✅ Grades loaded:', response.data?.length);
            return response.data || [];
          })
          .catch(error => {
            console.error('❌ Grades fetch failed:', error);
            return [];
          }),

        axios.get(`${API_BASE_URL}/api/semesters/`, { withCredentials: true })
          .then(response => {
            console.log('✅ Semesters loaded:', response.data?.length);
            return response.data || [];
          })
          .catch(error => {
            console.error('❌ Semesters fetch failed:', error);
            return [];
          }),

        axios.get(`${API_BASE_URL}/api/registrations/`, { withCredentials: true })
          .then(response => {
            console.log('✅ Enrollments loaded:', response.data?.length);
            return response.data || [];
          })
          .catch(error => {
            console.error('❌ Enrollments fetch failed:', error);
            return [];
          })
      ];

      const [allCourses, studentsData, gradesData, semestersData, enrollmentsData] = await Promise.all(requests);

      // Filter courses by instructor
      const instructorCourses = allCourses.filter(course => {
        if (!course) return false;
        
        const courseInstructorId = typeof course.instructor === 'object' 
          ? course.instructor?.id 
          : course.instructor;
        
        const matches = courseInstructorId === instructorId;
        
        if (matches) {
          console.log('🎯 Course matched:', course.code, course.name, 'Instructor:', courseInstructorId);
        }
        
        return matches;
      });

      console.log('📊 Final Data Summary:', {
        allCourses: allCourses.length,
        instructorCourses: instructorCourses.length,
        students: studentsData.length,
        grades: gradesData.length,
        semesters: semestersData.length,
        enrollments: enrollmentsData.length
      });

      // Check if we have minimal required data
      if (instructorCourses.length === 0) {
        console.warn('⚠️ No courses found for instructor. Available courses:', allCourses.map(c => ({
          id: c.id,
          code: c.code,
          name: c.name,
          instructor: c.instructor
        })));
      }

      setCourses(instructorCourses);
      setStudents(studentsData);
      setGrades(gradesData);
      setSemesters(semestersData);
      setEnrollments(enrollmentsData);

      // Log department information for debugging
      if (instructorCourses.length > 0) {
        const departments = instructorCourses.map(course => 
          course.department_name || (typeof course.department === 'object' ? course.department?.name : course.department)
        ).filter(dept => dept);
        
        console.log('🏫 Instructor Departments:', [...new Set(departments)]);
      }

    } catch (error) {
      console.error('💥 Error in fetchInstructorData:', error);
      
      if (error.response?.status === 401) {
        setError('Authentication failed. Please login again.');
        handleLogout();
      } else if (error.message?.includes('Unable to identify instructor')) {
        setError(error.message);
        handleLogout();
      } else {
        setError(`Failed to load dashboard data: ${error.message}. Please check your connection and try again.`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get grades for a specific course and semester
  const getCourseGrades = (courseId, semesterId = null) => {
    if (!courseId) return [];
    
    const currentSemId = semesterId || (getCurrentSemester()?.id || 0);
    return grades.filter(g => g.course === courseId && g.semester === currentSemId);
  };

  // Get instructor's departments from their courses
  const getInstructorDepartments = () => {
    if (courses.length === 0) return [];
    
    const departments = courses.map(course => {
      if (typeof course.department === 'object') {
        return course.department?.name || course.department_name;
      }
      return course.department_name || course.department;
    }).filter(dept => dept && dept !== 'undefined');
    
    return [...new Set(departments)];
  };

  // Get students for selected course - only from instructor's departments
  const getStudentsForCourse = (courseId) => {
    if (!courseId) return [];
    
    const currentCourse = courses.find(c => c.id === courseId);
    if (!currentCourse) {
      console.log('❌ Course not found:', courseId);
      return [];
    }

    // Get course department
    const courseDept = typeof currentCourse.department === 'object' 
      ? currentCourse.department?.name 
      : currentCourse.department_name || currentCourse.department;

    // Get instructor's departments
    const instructorDepts = getInstructorDepartments();

    console.log('🎯 Student Filtering:', {
      course: currentCourse.code,
      courseDepartment: courseDept,
      instructorDepartments: instructorDepts
    });

    // Find enrollments for this course
    const courseEnrollments = enrollments.filter(enrollment => {
      if (!enrollment || !enrollment.courses || !Array.isArray(enrollment.courses)) return false;
      
      const hasCourse = enrollment.courses.some(course => {
        if (typeof course === 'object') {
          return course.id === courseId;
        }
        return course === courseId;
      });
      
      return hasCourse;
    });

    console.log('📋 Course enrollments found:', courseEnrollments.length);

    // Get unique student IDs from enrollments
    const enrolledStudentIds = new Set();
    
    courseEnrollments.forEach(enrollment => {
      if (enrollment.student) {
        const studentId = typeof enrollment.student === 'object' 
          ? enrollment.student.id 
          : enrollment.student;
        enrolledStudentIds.add(studentId);
      }
    });

    // Also include students who already have grades for this course
    const courseGrades = getCourseGrades(courseId);
    courseGrades.forEach(grade => {
      enrolledStudentIds.add(grade.student);
    });

    console.log('👥 Enrolled student IDs:', Array.from(enrolledStudentIds));

    // Filter students by enrollment and department match
    const filteredStudents = students.filter(student => {
      if (!enrolledStudentIds.has(student.id)) {
        return false;
      }
      
      const studentDept = typeof student.department === 'object' 
        ? student.department?.name 
        : student.department_name || student.department;
      
      const departmentMatch = instructorDepts.includes(studentDept);
      
      if (!departmentMatch) {
        console.log('🚫 Student filtered out - department mismatch:', {
          student: `${student.first_name} ${student.last_name}`,
          studentDepartment: studentDept,
          allowedDepartments: instructorDepts
        });
      }
      
      return departmentMatch;
    });

    console.log('✅ Final students for course:', filteredStudents.length);
    
    return filteredStudents;
  };

  // Get current active semester
  const getCurrentSemester = () => {
    const activeSemester = semesters.find(sem => sem && sem.is_active);
    return activeSemester || (semesters.length > 0 ? semesters[0] : null);
  };

  // Handle grade input change
  const handleGradeChange = (studentId, gradeValue) => {
    setGradeEntries(prev => ({
      ...prev,
      [studentId]: gradeValue
    }));
  };

  // Save grades function
  const saveGrades = async () => {
    if (!selectedCourse) {
      alert('Please select a course first.');
      return;
    }

    const currentSemester = getCurrentSemester();
    if (!currentSemester) {
      alert('No active semester found. Please contact administrator.');
      return;
    }

    const courseStudents = getStudentsForCourse(selectedCourse.id);
    if (courseStudents.length === 0) {
      alert('No students enrolled in this course.');
      return;
    }

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!user || !user.id) {
      alert('Authentication error: Please log in again.');
      return;
    }

    const gradesToSave = Object.entries(gradeEntries)
      .filter(([studentId, grade]) => grade && grade.trim() !== '')
      .map(([studentId, grade]) => {
        const existingGrade = getCourseGrades(selectedCourse.id, currentSemester.id)
          .find(g => g.student === parseInt(studentId));

        const gradeData = {
          student: parseInt(studentId),
          course: selectedCourse.id,
          semester: currentSemester.id,
          grade: grade,
          grade_point: convertGradeToPoint(grade),
          is_published: false,
          entered_by: user.id
        };

        return existingGrade 
          ? { ...gradeData, id: existingGrade.id, method: 'PUT', url: `${API_BASE_URL}/api/grades/${existingGrade.id}/` }
          : { ...gradeData, method: 'POST', url: `${API_BASE_URL}/api/grades/` };
      });

    if (gradesToSave.length === 0) {
      alert('No grades to save.');
      return;
    }

    setLoading(true);
    try {
      let successCount = 0;
      let errors = [];

      for (const gradeData of gradesToSave) {
        try {
          const { method, url, ...dataToSend } = gradeData;

          const config = {
            withCredentials: true,
            headers: {
              'Content-Type': 'application/json'
            }
          };

          let response;
          if (method === 'PUT') {
            response = await axios.put(url, dataToSend, config);
          } else {
            response = await axios.post(url, dataToSend, config);
          }
          
          successCount++;
        } catch (error) {
          const student = students.find(s => s.id === gradeData.student);
          const studentName = student ? `${student.first_name} ${student.last_name}` : `ID: ${gradeData.student}`;
          errors.push(`${studentName}: ${error.response?.data?.message || error.message}`);
        }
      }

      if (successCount > 0) {
        alert(`✅ Successfully saved ${successCount} grade(s)!`);
        setGradeEntries({});
        fetchInstructorData();
      }
      
      if (errors.length > 0) {
        alert(`❌ Failed to save ${errors.length} grade(s):\n\n${errors.join('\n')}`);
      }

    } catch (error) {
      console.error('Error in saveGrades:', error);
      alert(`Error: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Publish grades function
  const publishGrades = async () => {
    if (!selectedCourse) {
      alert('Please select a course first.');
      return;
    }

    const currentSemester = getCurrentSemester();
    if (!currentSemester) {
      alert('No active semester found.');
      return;
    }

    if (!window.confirm('Are you sure you want to publish these grades? Published grades cannot be modified.')) {
      return;
    }

    setLoading(true);
    try {
      const unpublishedGrades = getCourseGrades(selectedCourse.id, currentSemester.id)
        .filter(g => !g.is_published);

      if (unpublishedGrades.length === 0) {
        alert('No unpublished grades found for this course in the current semester.');
        return;
      }

      let successCount = 0;
      let errors = [];

      for (const grade of unpublishedGrades) {
        try {
          await axios.patch(`${API_BASE_URL}/api/grades/${grade.id}/`, {
            is_published: true
          }, { withCredentials: true });
          
          successCount++;
        } catch (error) {
          const student = students.find(s => s.id === grade.student);
          const studentName = student ? `${student.first_name} ${student.last_name}` : `ID: ${grade.student}`;
          errors.push(`${studentName}: ${error.message}`);
        }
      }

      if (successCount > 0) {
        alert(`✅ Successfully published ${successCount} grade(s)!`);
        fetchInstructorData();
      }
      
      if (errors.length > 0) {
        alert(`❌ Failed to publish ${errors.length} grade(s):\n\n${errors.join('\n')}`);
      }

    } catch (error) {
      console.error('Error publishing grades:', error);
      alert('Error publishing grades. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const retryFetch = () => {
    fetchInstructorData();
  };

  if (loading && courses.length === 0) {
    return (
      <div className="instructor-dashboard">
        <div className="loading-spinner">
          <div>Loading instructor dashboard...</div>
          <div className="loading-details">
            <p>Fetching your courses and student data</p>
          </div>
        </div>
      </div>
    );
  }

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const instructorDepts = getInstructorDepartments();

  return (
    <div className="instructor-dashboard">
      <div className="dashboard-header">
        <div className="header-content">
          <div>
            <h1>Instructor Dashboard</h1>
            <p>Welcome, {user.first_name} {user.last_name}</p>
            <p>Manage your courses and enter grades</p>
            {semesters.length > 0 && (
              <div className="semester-info">
                Current Semester: {getCurrentSemester()?.name || 'None'}
              </div>
            )}
            {instructorDepts.length > 0 && (
              <div className="department-info">
                Department(s): {instructorDepts.join(', ')}
              </div>
            )}
          </div>
          <div className="header-actions">
            <button onClick={retryFetch} className="btn-secondary">
              Refresh Data
            </button>
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <div className="error-content">
            <strong>Error:</strong> {error}
            <button onClick={retryFetch} className="btn-retry">
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="instructor-tabs">
        <button 
          className={`tab-btn ${activeTab === 'courses' ? 'active' : ''}`}
          onClick={() => setActiveTab('courses')}
        >
          📚 My Courses ({courses.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'grades' ? 'active' : ''}`}
          onClick={() => setActiveTab('grades')}
        >
          📝 Enter Grades
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* My Courses Tab */}
        {activeTab === 'courses' && (
          <div className="courses-section">
            <h2>My Courses ({courses.length})</h2>
            {courses.length > 0 ? (
              <div className="courses-grid">
                {courses.map(course => {
                  const courseStudents = getStudentsForCourse(course.id);
                  const courseGrades = getCourseGrades(course.id);
                  const courseDept = course.department_name || 
                                   (typeof course.department === 'object' ? course.department.name : course.department);
                  
                  return (
                    <div key={course.id} className="course-card">
                      <h3>{course.code} - {course.name}</h3>
                      <div className="course-details">
                        <p><strong>Department:</strong> {courseDept}</p>
                        <p><strong>Credits:</strong> {course.credits || 3}</p>
                        <p><strong>Students Enrolled:</strong> {courseStudents.length}</p>
                        <p><strong>Grades Entered:</strong> {courseGrades.length}</p>
                        <p><strong>Published:</strong> {
                          courseGrades.filter(g => g.is_published).length
                        }</p>
                      </div>
                      <button 
                        className="btn-primary"
                        onClick={() => {
                          setSelectedCourse(course);
                          setActiveTab('grades');
                        }}
                        disabled={courseStudents.length === 0}
                      >
                        {courseStudents.length === 0 ? 'No Students' : 'Enter Grades'}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="no-data">
                <p>No courses assigned to you in your department.</p>
                <p className="info-text">Please contact the administrator if you believe this is an error.</p>
              </div>
            )}
          </div>
        )}

        {/* Enter Grades Tab */}
        {activeTab === 'grades' && (
          <div className="grades-section">
            <div className="grades-header">
              <h2>Enter Grades</h2>
              {selectedCourse && (
                <div className="selected-course">
                  <h3>{selectedCourse.code} - {selectedCourse.name}</h3>
                  <div className="course-info">
                    <span className="student-count">
                      Students: {getStudentsForCourse(selectedCourse.id).length}
                    </span>
                    <span className="semester-info">
                      Semester: {getCurrentSemester()?.name || 'Not set'}
                    </span>
                    <span className="department-info">
                      Department: {selectedCourse.department_name || selectedCourse.department}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Course Selection */}
            {!selectedCourse && (
              <div className="course-selection">
                <h3>Select a Course</h3>
                <p>Choose a course from your department to enter grades for:</p>
                <div className="courses-list">
                  {courses.map(course => {
                    const courseStudents = getStudentsForCourse(course.id);
                    const courseDept = course.department_name || 
                                     (typeof course.department === 'object' ? course.department.name : course.department);
                    
                    return (
                      <button
                        key={course.id}
                        className={`course-select-btn ${courseStudents.length === 0 ? 'disabled' : ''}`}
                        onClick={() => courseStudents.length > 0 && setSelectedCourse(course)}
                        disabled={courseStudents.length === 0}
                      >
                        <div className="course-btn-content">
                          <div className="course-code">{course.code} - {course.name}</div>
                          <div className="course-details">
                            <span className="department">Dept: {courseDept}</span>
                            <span className="students">
                              {courseStudents.length === 0 ? ' (No students)' : ` (${courseStudents.length} students)`}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Grade Entry Form */}
            {selectedCourse && (
              <div className="grade-entry-form">
                <div className="form-actions">
                  <button 
                    onClick={saveGrades}
                    className="btn-success"
                    disabled={loading || getStudentsForCourse(selectedCourse.id).length === 0}
                  >
                    {loading ? 'Saving...' : 'Save Grades'}
                  </button>
                  <button 
                    onClick={publishGrades}
                    className="btn-warning"
                    disabled={loading}
                  >
                    {loading ? 'Publishing...' : 'Publish Grades'}
                  </button>
                  <button 
                    onClick={() => setSelectedCourse(null)}
                    className="btn-secondary"
                  >
                    Change Course
                  </button>
                </div>

                <div className="grades-table-container">
                  {getStudentsForCourse(selectedCourse.id).length === 0 ? (
                    <div className="no-students-message">
                      <p>No students from your department are currently enrolled in this course.</p>
                      <p>Students need to register for this course before you can enter grades.</p>
                    </div>
                  ) : (
                    <table className="grades-table">
                      <thead>
                        <tr>
                          <th>Student ID</th>
                          <th>Student Name</th>
                          <th>Department</th>
                          <th>New Grade</th>
                          <th>Current Grade</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getStudentsForCourse(selectedCourse.id).map(student => {
                          const existingGrade = getCourseGrades(selectedCourse.id)
                            .find(g => g.student === student.id);
                          
                          const studentDept = student.department_name || 
                                            (typeof student.department === 'object' ? student.department.name : student.department);
                          
                          return (
                            <tr key={student.id}>
                              <td>{student.student_id}</td>
                              <td>{student.first_name} {student.last_name}</td>
                              <td>{studentDept}</td>
                              <td>
                                <select
                                  value={gradeEntries[student.id] || ''}
                                  onChange={(e) => handleGradeChange(student.id, e.target.value)}
                                  className="grade-select"
                                  disabled={existingGrade?.is_published}
                                >
                                  <option value="">Select Grade</option>
                                  {gradeOptions.map(grade => (
                                    <option key={grade} value={grade}>
                                      {grade}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                {existingGrade ? (
                                  <span className={`grade-badge ${existingGrade.is_published ? 'published' : 'saved'}`}>
                                    {existingGrade.grade}
                                  </span>
                                ) : (
                                  <span className="no-grade">-</span>
                                )}
                              </td>
                              <td>
                                {existingGrade ? (
                                  <span className={`status-badge ${existingGrade.is_published ? 'published' : 'saved'}`}>
                                    {existingGrade.is_published ? 'Published' : 'Saved'}
                                  </span>
                                ) : (
                                  <span className="status-badge not-entered">Not Entered</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Summary */}
                <div className="grades-summary">
                  <h4>Summary</h4>
                  <div className="summary-stats">
                    <div className="stat">
                      <span className="stat-label">Total Students:</span>
                      <span className="stat-value">{getStudentsForCourse(selectedCourse.id).length}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">New Grades:</span>
                      <span className="stat-value">
                        {Object.values(gradeEntries).filter(grade => grade && grade.trim() !== '').length}
                      </span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Published Grades:</span>
                      <span className="stat-value">
                        {getCourseGrades(selectedCourse.id).filter(g => g.is_published).length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InstructorDashboard;