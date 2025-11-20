import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/DeptHeadDashboard.css';

const DeptHeadDashboard = () => {
  const [department, setDepartment] = useState(null);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [grades, setGrades] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  
  // Global filter states for year and semester
  const [globalFilters, setGlobalFilters] = useState({
    year: '',
    semester: ''
  });

  // Course filter states
  const [courseFilters, setCourseFilters] = useState({
    year: '',
    semester: '',
    instructor: '',
    status: ''
  });

  // Student filter states
  const [studentFilters, setStudentFilters] = useState({
    year: '',
    program: '',
    status: ''
  });

  // Grade filter states
  const [gradeFilters, setGradeFilters] = useState({
    course: '',
    year: '',
    semester: '',
    instructor: '',
    status: '',
    grade: ''
  });

  // Filtered data states
  const [filteredCourses, setFilteredCourses] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [filteredGrades, setFilteredGrades] = useState([]);

  useEffect(() => {
    fetchDeptHeadData();
  }, []);

  // Apply filters when data or filters change
  useEffect(() => {
    applyAllFilters();
  }, [courses, students, grades, globalFilters, courseFilters, studentFilters, gradeFilters]);

  const fetchDeptHeadData = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching department head data...');
      
      // Get current user info
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      console.log('👤 Current user:', userData);

      // Get user roles to find department head's department
      const userRoleResponse = await axios.get('http://127.0.0.1:8000/api/user-roles/');
      console.log('🎭 All user roles:', userRoleResponse.data);
      
      // Find the current user's role
      const userRole = userRoleResponse.data.find(role => {
        const roleUserId = typeof role.user === 'object' ? role.user.id : role.user;
        return roleUserId === userData.id;
      });
      
      console.log('🔍 Found user role:', userRole);

      if (userRole && userRole.department) {
        const deptId = typeof userRole.department === 'object' ? userRole.department.id : userRole.department;
        const deptName = typeof userRole.department === 'object' ? userRole.department.name : 'Department';
        console.log('🏫 Department ID:', deptId, 'Name:', deptName);
        
        setDepartment(userRole.department);
        
        // Fetch all data using your existing endpoints
        const [studentsResponse, coursesResponse, gradesResponse, allInstructorsResponse, programsResponse] = await Promise.all([
          axios.get('http://127.0.0.1:8000/api/students/'),
          axios.get('http://127.0.0.1:8000/api/courses/'),
          axios.get('http://127.0.0.1:8000/api/grades/'),
          axios.get('http://127.0.0.1:8000/api/user-roles/'),
          axios.get('http://127.0.0.1:8000/api/academic-programs/')
        ]);

        console.log('📊 Raw data:', {
          students: studentsResponse.data?.length,
          courses: coursesResponse.data?.length,
          grades: gradesResponse.data?.length,
          instructors: allInstructorsResponse.data?.length,
          programs: programsResponse.data?.length
        });

        // Filter data by department
        const deptStudents = (studentsResponse.data || []).filter(student => {
          if (!student.department) return false;
          const studentDeptId = typeof student.department === 'object' ? student.department.id : student.department;
          return studentDeptId == deptId;
        }).map(student => {
          // Enhance student data with program information
          let programInfo = null;
          if (student.academic_program) {
            if (typeof student.academic_program === 'object') {
              programInfo = student.academic_program;
            } else {
              // If academic_program is just an ID, find the program details
              programInfo = programsResponse.data.find(program => program.id === student.academic_program);
            }
          }

          return {
            ...student,
            _program: programInfo,
            program_name: programInfo?.name || 'Not Assigned'
          };
        });

        // Enhanced course filtering with instructor information
        const deptCourses = (coursesResponse.data || []).filter(course => {
          if (!course.department) return false;
          const courseDeptId = typeof course.department === 'object' ? course.department.id : course.department;
          return courseDeptId == deptId;
        }).map(course => {
          // Try to find instructor from grades if course instructor is not assigned
          let instructorInfo = null;
          
          // First, check if course has instructor assigned
          if (course.instructor && typeof course.instructor === 'object' && course.instructor.id) {
            instructorInfo = course.instructor;
          } else if (course.instructor && typeof course.instructor !== 'object') {
            // If instructor is just an ID, try to find the instructor details
            const instructorRole = (allInstructorsResponse.data || []).find(role => 
              role.user?.id === course.instructor
            );
            if (instructorRole && instructorRole.user) {
              instructorInfo = instructorRole.user;
            }
          }
          
          // If still no instructor, try to find from grades for this course
          if (!instructorInfo) {
            const courseGrades = (gradesResponse.data || []).filter(grade => {
              const gradeCourseId = typeof grade.course === 'object' ? grade.course.id : grade.course;
              return gradeCourseId === course.id && grade.is_published;
            });
            
            if (courseGrades.length > 0) {
              // Get the most frequent instructor from grades
              const instructorCounts = {};
              courseGrades.forEach(grade => {
                if (grade.entered_by) {
                  const enteredById = typeof grade.entered_by === 'object' ? grade.entered_by.id : grade.entered_by;
                  instructorCounts[enteredById] = (instructorCounts[enteredById] || 0) + 1;
                }
              });
              
              // Find instructor with most grades
              const mostFrequentInstructorId = Object.keys(instructorCounts).reduce((a, b) => 
                instructorCounts[a] > instructorCounts[b] ? a : b, null
              );
              
              if (mostFrequentInstructorId) {
                const instructorRole = (allInstructorsResponse.data || []).find(role => 
                  role.user?.id == mostFrequentInstructorId
                );
                if (instructorRole && instructorRole.user) {
                  instructorInfo = instructorRole.user;
                  console.log(`🎯 Found instructor from grades for course ${course.code}:`, instructorInfo);
                }
              }
            }
          }

          return {
            ...course,
            _instructor: instructorInfo,
            instructor_name: instructorInfo ? 
              `${instructorInfo.first_name} ${instructorInfo.last_name}` : 
              'Not Assigned'
          };
        });

        // Get instructors for the department
        const deptInstructors = (allInstructorsResponse.data || []).filter(role => {
          if (!role.department) return false;
          const roleDeptId = typeof role.department === 'object' ? role.department.id : role.department;
          return roleDeptId == deptId && ['instructor', 'department_head'].includes(role.role);
        });

        // Get grades for courses in this department - ONLY PUBLISHED GRADES
        const deptCourseIds = deptCourses.map(course => course.id);
        
        // Only include published grades for display
        const publishedGrades = (gradesResponse.data || []).filter(grade => {
          if (!grade.course) return false;
          
          // Check if grade is published - ONLY SHOW PUBLISHED GRADES
          if (!grade.is_published) {
            return false;
          }
          
          const gradeCourseId = typeof grade.course === 'object' ? grade.course.id : grade.course;
          return deptCourseIds.includes(gradeCourseId);
        }).map(grade => {
          // Enhance grade data with course, student, and instructor information
          const gradeCourseId = typeof grade.course === 'object' ? grade.course.id : grade.course;
          const gradeStudentId = typeof grade.student === 'object' ? grade.student.id : grade.student;
          const enteredById = typeof grade.entered_by === 'object' ? grade.entered_by.id : grade.entered_by;
          
          const course = deptCourses.find(c => c.id === gradeCourseId);
          const student = deptStudents.find(s => s.id === gradeStudentId);
          
          // Find the instructor who entered the grade using user roles data
          let enteredByInstructor = null;
          if (enteredById) {
            const instructorRole = (allInstructorsResponse.data || []).find(role => {
              const roleUserId = typeof role.user === 'object' ? role.user.id : role.user;
              return roleUserId === enteredById;
            });
            
            if (instructorRole && instructorRole.user) {
              const user = instructorRole.user;
              enteredByInstructor = {
                first_name: user.first_name,
                last_name: user.last_name,
                username: user.username,
                id: user.id
              };
            }
          }

          return {
            ...grade,
            _course: course,
            _student: student,
            _entered_by: enteredByInstructor,
            course_name: course?.name || grade.course_name || 'Unknown Course',
            student_name: student ? `${student.first_name} ${student.last_name}` : (grade.student_name || 'Unknown Student'),
            student_id: student?.student_id || 'N/A',
            program_name: student?.program_name || 'N/A',
            entered_by_name: enteredByInstructor ? 
              `${enteredByInstructor.first_name} ${enteredByInstructor.last_name}` : 
              (grade.entered_by_name || 'Unknown Instructor'),
            // Add year and semester from course for filtering
            course_year: course?.year,
            course_semester: course?.semester,
            student_year: student?.year
          };
        });

        console.log('✅ Published grades data:', publishedGrades.length);
        console.log('📊 Grades summary - Total:', gradesResponse.data?.length, 'Published:', publishedGrades.length);
        console.log('📚 Enhanced courses:', deptCourses.map(c => ({
          code: c.code,
          name: c.name,
          instructor: c.instructor_name
        })));

        setStudents(deptStudents);
        setCourses(deptCourses);
        setInstructors(deptInstructors);
        setGrades(publishedGrades); // Only set published grades for display
        
        // Initialize filtered data with all data
        setFilteredStudents(deptStudents);
        setFilteredCourses(deptCourses);
        setFilteredGrades(publishedGrades);
      } else {
        console.error('❌ No department found for user. User role:', userRole);
      }
    } catch (error) {
      console.error('❌ Error fetching department head data:', error);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
    } finally {
      setLoading(false);
    }
  };

  // Apply all filters
  const applyAllFilters = () => {
    applyCourseFilters();
    applyStudentFilters();
    applyGradeFilters();
  };

  // Apply course filters
  const applyCourseFilters = () => {
    let filtered = [...courses];

    // Apply global filters first
    if (globalFilters.year) {
      filtered = filtered.filter(course => course.year == globalFilters.year);
    }
    if (globalFilters.semester) {
      filtered = filtered.filter(course => course.semester == globalFilters.semester);
    }

    // Then apply specific course filters
    if (courseFilters.year) {
      filtered = filtered.filter(course => course.year == courseFilters.year);
    }
    if (courseFilters.semester) {
      filtered = filtered.filter(course => course.semester == courseFilters.semester);
    }
    if (courseFilters.instructor) {
      filtered = filtered.filter(course => {
        const instructorId = typeof course.instructor === 'object' ? course.instructor.id : course.instructor;
        return instructorId == courseFilters.instructor;
      });
    }
    if (courseFilters.status) {
      filtered = filtered.filter(course => {
        if (courseFilters.status === 'active') return course.is_active === true;
        if (courseFilters.status === 'inactive') return course.is_active === false;
        return true;
      });
    }

    setFilteredCourses(filtered);
  };

  // Apply student filters
  const applyStudentFilters = () => {
    let filtered = [...students];

    // Apply global year filter
    if (globalFilters.year) {
      filtered = filtered.filter(student => student.year == globalFilters.year);
    }

    // Apply specific student filters
    if (studentFilters.year) {
      filtered = filtered.filter(student => student.year == studentFilters.year);
    }
    if (studentFilters.program) {
      filtered = filtered.filter(student => {
        const programId = typeof student.academic_program === 'object' ? student.academic_program.id : student.academic_program;
        return programId == studentFilters.program;
      });
    }
    if (studentFilters.status) {
      filtered = filtered.filter(student => {
        if (studentFilters.status === 'active') return student.is_active === true;
        if (studentFilters.status === 'inactive') return student.is_active === false;
        return true;
      });
    }

    setFilteredStudents(filtered);
  };

  // Apply grade filters
  const applyGradeFilters = () => {
    let filtered = [...grades];

    // Apply global filters
    if (globalFilters.year) {
      filtered = filtered.filter(grade => 
        grade.course_year == globalFilters.year || grade.student_year == globalFilters.year
      );
    }
    if (globalFilters.semester) {
      filtered = filtered.filter(grade => grade.course_semester == globalFilters.semester);
    }

    // Apply specific grade filters
    if (gradeFilters.course) {
      filtered = filtered.filter(grade => {
        const courseId = typeof grade.course === 'object' ? grade.course.id : grade.course;
        return courseId == gradeFilters.course;
      });
    }
    if (gradeFilters.year) {
      filtered = filtered.filter(grade => 
        grade.course_year == gradeFilters.year || grade.student_year == gradeFilters.year
      );
    }
    if (gradeFilters.semester) {
      filtered = filtered.filter(grade => grade.course_semester == gradeFilters.semester);
    }
    if (gradeFilters.instructor) {
      filtered = filtered.filter(grade => {
        if (!grade._entered_by) return false;
        return grade._entered_by.id == gradeFilters.instructor;
      });
    }
    if (gradeFilters.status) {
      filtered = filtered.filter(grade => {
        if (gradeFilters.status === 'has_grade') return grade.grade && grade.grade !== '';
        if (gradeFilters.status === 'no_grade') return !grade.grade || grade.grade === '';
        return true;
      });
    }
    if (gradeFilters.grade) {
      filtered = filtered.filter(grade => grade.grade === gradeFilters.grade);
    }

    setFilteredGrades(filtered);
  };

  // Handle filter changes
  const handleGlobalFilterChange = (filterType, value) => {
    setGlobalFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const handleCourseFilterChange = (filterType, value) => {
    setCourseFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const handleStudentFilterChange = (filterType, value) => {
    setStudentFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const handleGradeFilterChange = (filterType, value) => {
    setGradeFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  // Clear all filters
  const clearAllFilters = () => {
    setGlobalFilters({ year: '', semester: '' });
    setCourseFilters({ year: '', semester: '', instructor: '', status: '' });
    setStudentFilters({ year: '', program: '', status: '' });
    setGradeFilters({ course: '', year: '', semester: '', instructor: '', status: '', grade: '' });
  };

  const clearCourseFilters = () => {
    setCourseFilters({ year: '', semester: '', instructor: '', status: '' });
  };

  const clearStudentFilters = () => {
    setStudentFilters({ year: '', program: '', status: '' });
  };

  const clearGradeFilters = () => {
    setGradeFilters({ course: '', year: '', semester: '', instructor: '', status: '', grade: '' });
  };

  // Get unique values for filter options
  const getUniqueYears = () => {
    const years = [...new Set([
      ...courses.map(course => course.year).filter(Boolean),
      ...students.map(student => student.year).filter(Boolean)
    ])].sort();
    return years;
  };

  const getUniqueSemesters = () => {
    return [...new Set(courses.map(course => course.semester).filter(Boolean))].sort();
  };

  const getUniquePrograms = () => {
    const programsMap = {};
    students.forEach(student => {
      if (student._program) {
        programsMap[student._program.id] = student._program;
      }
    });
    return Object.values(programsMap);
  };

  const getUniqueInstructors = () => {
    const instructorsMap = {};
    courses.forEach(course => {
      if (course.instructor && typeof course.instructor === 'object') {
        instructorsMap[course.instructor.id] = course.instructor;
      }
    });
    return Object.values(instructorsMap);
  };

  const getUniqueCourses = () => {
    return courses.filter(course => course.is_active);
  };

  const getUniqueGrades = () => {
    const gradeValues = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F', 'I'];
    return gradeValues;
  };

  // CSV Export Function for Grades
  const exportGradesToCSV = () => {
    if (filteredGrades.length === 0) {
      alert('No grades data to export!');
      return;
    }

    const headers = [
      'Course Code',
      'Course Name',
      'Student ID',
      'Student Name',
      'Program',
      'Year',
      'Semester',
      'Grade',
      'Entered By',
      'Status',
      'Date Entered'
    ];

    const csvData = filteredGrades.map(grade => [
      grade._course?.code || 'N/A',
      grade.course_name,
      grade.student_id,
      grade.student_name,
      grade.program_name,
      grade.course_year || grade.student_year || 'N/A',
      grade.course_semester || 'N/A',
      grade.grade || 'Not Entered',
      grade.entered_by_name,
      'Published',
      grade.entered_at ? new Date(grade.entered_at).toLocaleDateString() : 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `grades_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getDepartmentStats = () => {
    const totalStudents = students.length;
    const totalCourses = courses.length;
    const totalInstructors = instructors.length;
    
    return {
      totalStudents,
      totalCourses,
      totalInstructors,
      publishedGrades: grades.length
    };
  };

  const stats = getDepartmentStats();

  if (loading) {
    return (
      <div className="dept-head-dashboard">
        <div className="loading-spinner">Loading department data...</div>
      </div>
    );
  }

  return (
    <div className="dept-head-dashboard">
      <div className="dashboard-header">
        <h1>Department Head Dashboard</h1>
        <p>Managing {department?.name || 'Department'}</p>
        
        {/* GLOBAL FILTERS */}
        <div className="global-filters">
          <h3>📅 Academic Filters</h3>
          <div className="filter-controls">
            <div className="filter-group">
              <label>Academic Year:</label>
              <select 
                value={globalFilters.year} 
                onChange={(e) => handleGlobalFilterChange('year', e.target.value)}
              >
                <option value="">All Years</option>
                {getUniqueYears().map(year => (
                  <option key={year} value={year}>Year {year}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Semester:</label>
              <select 
                value={globalFilters.semester} 
                onChange={(e) => handleGlobalFilterChange('semester', e.target.value)}
              >
                <option value="">All Semesters</option>
                {getUniqueSemesters().map(semester => (
                  <option key={semester} value={semester}>
                    {semester === 1 ? '1st Semester' : semester === 2 ? '2nd Semester' : semester}
                  </option>
                ))}
              </select>
            </div>

            {(globalFilters.year || globalFilters.semester) && (
              <button className="clear-filters-btn" onClick={clearAllFilters}>
                Clear All Filters
              </button>
            )}
          </div>
          
          {(globalFilters.year || globalFilters.semester) && (
            <div className="active-global-filters">
              <strong>Active Filters:</strong>
              {globalFilters.year && ` Year ${globalFilters.year}`}
              {globalFilters.semester && ` • ${globalFilters.semester === '1' ? '1st Semester' : '2nd Semester'}`}
            </div>
          )}
        </div>

        <div className="status-info">
          {department ? (
            <div className="term-info">
              Department: <strong>{department.name}</strong>
            </div>
          ) : (
            <div className="warning-banner">
              ⚠️ No department assigned. Please contact administrator.
            </div>
          )}
          <div style={{fontSize: '12px', color: '#666', marginTop: '5px'}}>
            Loaded: {stats.totalStudents} students, {stats.totalCourses} courses, {stats.totalInstructors} instructors, {stats.publishedGrades} published grades
          </div>
        </div>
      </div>

      {/* Department Statistics */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Students</h3>
          <div className="stat-number">{stats.totalStudents}</div>
          {globalFilters.year && <div className="stat-filtered">Filtered: {filteredStudents.length}</div>}
        </div>
        <div className="stat-card">
          <h3>Courses</h3>
          <div className="stat-number">{stats.totalCourses}</div>
          {(globalFilters.year || globalFilters.semester) && <div className="stat-filtered">Filtered: {filteredCourses.length}</div>}
        </div>
        <div className="stat-card">
          <h3>Instructors</h3>
          <div className="stat-number">{stats.totalInstructors}</div>
        </div>
        <div className="stat-card info">
          <h3>Published Grades</h3>
          <div className="stat-number">{stats.publishedGrades}</div>
          <div className="stat-subtitle">All grades are published</div>
        </div>
      </div>

      <div className="dashboard-tabs">
        <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}>
          📊 Department Overview
        </button>
        <button className={`tab-btn ${activeTab === 'students' ? 'active' : ''}`}
                onClick={() => setActiveTab('students')}>
          👥 Students ({globalFilters.year || studentFilters.year ? filteredStudents.length : stats.totalStudents})
        </button>
        <button className={`tab-btn ${activeTab === 'courses' ? 'active' : ''}`}
                onClick={() => setActiveTab('courses')}>
          📚 Courses ({(globalFilters.year || globalFilters.semester || courseFilters.year || courseFilters.semester) ? filteredCourses.length : stats.totalCourses})
        </button>
        <button className={`tab-btn ${activeTab === 'grades' ? 'active' : ''}`}
                onClick={() => setActiveTab('grades')}>
          📝 Grade Oversight ({(globalFilters.year || globalFilters.semester || Object.values(gradeFilters).some(f => f)) ? filteredGrades.length : grades.length})
        </button>
        <button className={`tab-btn ${activeTab === 'instructors' ? 'active' : ''}`}
                onClick={() => setActiveTab('instructors')}>
          👨‍🏫 Instructors ({stats.totalInstructors})
        </button>
      </div>

      <div className="tab-content">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="overview-section">
            <h2>Department Overview - {department?.name}</h2>
            
            <div className="overview-notice">
              <div className="notice-info">
                <strong>📝 Note:</strong> Only published grades are visible in this dashboard.
              </div>
            </div>
            
            {stats.totalStudents === 0 && stats.totalCourses === 0 ? (
              <div className="no-data">
                <p>No data found for your department.</p>
                <p>Please check if you are assigned as a Department Head and have students/courses in your department.</p>
              </div>
            ) : (
              <div className="overview-grid">
                <div className="info-card">
                  <h3>Recent Grade Activity</h3>
                  <div className="recent-grades">
                    {filteredGrades.slice(0, 5).length > 0 ? (
                      filteredGrades.slice(0, 5).map(grade => (
                        <div key={grade.id} className="grade-item">
                          <span className="course-name">{grade.course_name}</span>
                          <span className="student-name">{grade.student_name}</span>
                          <span className={`grade-badge published`}>
                            {grade.grade || 'N/A'} ✅
                          </span>
                        </div>
                      ))
                    ) : (
                      <p>No published grade data available</p>
                    )}
                  </div>
                </div>
                
                <div className="info-card">
                  <h3>Course Distribution</h3>
                  <div className="course-distribution">
                    {filteredCourses.length > 0 ? (
                      filteredCourses.map(course => (
                        <div key={course.id} className="course-item">
                          <span><strong>{course.code}</strong> - {course.name}</span>
                          <span>Instructor: {course.instructor_name}</span>
                          <span>Credits: {course.credits}</span>
                        </div>
                      ))
                    ) : (
                      <p>No courses in department</p>
                    )}
                  </div>
                </div>

                <div className="info-card">
                  <h3>Grade Statistics</h3>
                  <div className="grade-stats">
                    <div className="stat-item">
                      <span>Total Published Grades:</span>
                      <span className="stat-value">{stats.publishedGrades}</span>
                    </div>
                    <div className="stat-item">
                      <span>Courses with Grades:</span>
                      <span className="stat-value">
                        {[...new Set(grades.map(grade => grade.course))].length}
                      </span>
                    </div>
                    <div className="stat-item">
                      <span>Instructors with Grades:</span>
                      <span className="stat-value">
                        {[...new Set(grades.map(grade => grade._entered_by?.id).filter(Boolean))].length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STUDENTS TAB */}
        {activeTab === 'students' && (
          <div className="students-section">
            <div className="section-header">
              <h2>Students in {department?.name}</h2>
              <div className="filter-controls">
                <div className="filter-group">
                  <label>Year:</label>
                  <select 
                    value={studentFilters.year} 
                    onChange={(e) => handleStudentFilterChange('year', e.target.value)}
                  >
                    <option value="">All Years</option>
                    {getUniqueYears().map(year => (
                      <option key={year} value={year}>Year {year}</option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label>Program:</label>
                  <select 
                    value={studentFilters.program} 
                    onChange={(e) => handleStudentFilterChange('program', e.target.value)}
                  >
                    <option value="">All Programs</option>
                    {getUniquePrograms().map(program => (
                      <option key={program.id} value={program.id}>
                        {program.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label>Status:</label>
                  <select 
                    value={studentFilters.status} 
                    onChange={(e) => handleStudentFilterChange('status', e.target.value)}
                  >
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                {(studentFilters.year || studentFilters.program || studentFilters.status) && (
                  <button className="clear-filters-btn" onClick={clearStudentFilters}>
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            <div className="filter-info">
              Showing {filteredStudents.length} of {students.length} students
              {(studentFilters.year || studentFilters.program || studentFilters.status) && (
                <span className="active-filters">
                  {studentFilters.year && ` • Year: ${studentFilters.year}`}
                  {studentFilters.program && ` • Program: ${getUniquePrograms().find(p => p.id == studentFilters.program)?.name}`}
                  {studentFilters.status && ` • Status: ${studentFilters.status}`}
                </span>
              )}
            </div>

            {filteredStudents.length > 0 ? (
              <div className="students-table-container">
                <table className="students-table">
                  <thead>
                    <tr>
                      <th>Student ID</th>
                      <th>Name</th>
                      <th>Program</th>
                      <th>Year</th>
                      <th>GPA</th>
                      <th>Published Grades</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map(student => {
                      const studentGrades = grades.filter(grade => 
                        grade._student?.id === student.id
                      );
                      
                      return (
                        <tr key={student.id}>
                          <td>{student.student_id}</td>
                          <td>{student.first_name} {student.last_name}</td>
                          <td>{student.program_name}</td>
                          <td>Year {student.year}</td>
                          <td>{student.cumulative_gpa || student.cumulative_gpa === 0 ? student.cumulative_gpa : 'N/A'}</td>
                          <td>
                            <span className="grade-count">
                              {studentGrades.length} published
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge ${student.is_active ? 'active' : 'inactive'}`}>
                              {student.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="no-data">
                <p>No students found matching your filters.</p>
                {(studentFilters.year || studentFilters.program || studentFilters.status) && (
                  <button className="clear-filters-btn" onClick={clearStudentFilters}>
                    Clear Filters to Show All Students
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* COURSES TAB */}
        {activeTab === 'courses' && (
          <div className="courses-section">
            <div className="section-header">
              <h2>Courses in {department?.name}</h2>
              <div className="filter-controls">
                <div className="filter-group">
                  <label>Year:</label>
                  <select 
                    value={courseFilters.year} 
                    onChange={(e) => handleCourseFilterChange('year', e.target.value)}
                  >
                    <option value="">All Years</option>
                    {getUniqueYears().map(year => (
                      <option key={year} value={year}>Year {year}</option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label>Semester:</label>
                  <select 
                    value={courseFilters.semester} 
                    onChange={(e) => handleCourseFilterChange('semester', e.target.value)}
                  >
                    <option value="">All Semesters</option>
                    {getUniqueSemesters().map(semester => (
                      <option key={semester} value={semester}>
                        {semester === 1 ? '1st Semester' : semester === 2 ? '2nd Semester' : semester}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label>Instructor:</label>
                  <select 
                    value={courseFilters.instructor} 
                    onChange={(e) => handleCourseFilterChange('instructor', e.target.value)}
                  >
                    <option value="">All Instructors</option>
                    {getUniqueInstructors().map(instructor => (
                      <option key={instructor.id} value={instructor.id}>
                        {instructor.first_name} {instructor.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label>Status:</label>
                  <select 
                    value={courseFilters.status} 
                    onChange={(e) => handleCourseFilterChange('status', e.target.value)}
                  >
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                {(courseFilters.year || courseFilters.semester || courseFilters.instructor || courseFilters.status) && (
                  <button className="clear-filters-btn" onClick={clearCourseFilters}>
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            <div className="filter-info">
              Showing {filteredCourses.length} of {courses.length} courses
              {(courseFilters.year || courseFilters.semester || courseFilters.instructor || courseFilters.status) && (
                <span className="active-filters">
                  {courseFilters.year && ` • Year: ${courseFilters.year}`}
                  {courseFilters.semester && ` • Semester: ${courseFilters.semester === '1' ? '1st' : '2nd'}`}
                  {courseFilters.status && ` • Status: ${courseFilters.status}`}
                </span>
              )}
            </div>

            {filteredCourses.length > 0 ? (
              <div className="courses-grid">
                {filteredCourses.map(course => {
                  const courseGrades = grades.filter(grade => {
                    const gradeCourseId = typeof grade.course === 'object' ? grade.course.id : grade.course;
                    return gradeCourseId === course.id;
                  });
                  
                  return (
                    <div key={course.id} className="course-card">
                      <h4>{course.code} - {course.name}</h4>
                      <p><strong>Credits:</strong> {course.credits}</p>
                      <p><strong>Instructor:</strong> {course.instructor_name}</p>
                      <p><strong>Semester:</strong> {course.semester === 1 ? '1st Semester' : course.semester === 2 ? '2nd Semester' : course.semester}</p>
                      <p><strong>Year:</strong> {course.year ? `Year ${course.year}` : 'N/A'}</p>
                      <p><strong>Published Grades:</strong> {courseGrades.length}</p>
                      <p><strong>Status:</strong> 
                        <span className={`status-badge ${course.is_active ? 'active' : 'inactive'}`}>
                          {course.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="no-data">
                <p>No courses found matching your filters.</p>
                {(courseFilters.year || courseFilters.semester || courseFilters.instructor || courseFilters.status) && (
                  <button className="clear-filters-btn" onClick={clearCourseFilters}>
                    Clear Filters to Show All Courses
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* GRADES TAB */}
        {activeTab === 'grades' && (
          <div className="grades-section">
            <div className="section-header">
              <h2>Grade Oversight - {department?.name}</h2>
              <div className="section-actions">
                <button className="export-csv-btn" onClick={exportGradesToCSV}>
                  📥 Export Grades to CSV
                </button>
              </div>
              <div className="section-notice">
                <p>📝 <strong>Note:</strong> Only published grades are visible.</p>
              </div>
              <div className="filter-controls">
                <div className="filter-group">
                  <label>Course:</label>
                  <select 
                    value={gradeFilters.course} 
                    onChange={(e) => handleGradeFilterChange('course', e.target.value)}
                  >
                    <option value="">All Courses</option>
                    {getUniqueCourses().map(course => (
                      <option key={course.id} value={course.id}>
                        {course.code} - {course.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label>Year:</label>
                  <select 
                    value={gradeFilters.year} 
                    onChange={(e) => handleGradeFilterChange('year', e.target.value)}
                  >
                    <option value="">All Years</option>
                    {getUniqueYears().map(year => (
                      <option key={year} value={year}>Year {year}</option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label>Semester:</label>
                  <select 
                    value={gradeFilters.semester} 
                    onChange={(e) => handleGradeFilterChange('semester', e.target.value)}
                  >
                    <option value="">All Semesters</option>
                    {getUniqueSemesters().map(semester => (
                      <option key={semester} value={semester}>
                        {semester === 1 ? '1st Semester' : semester === 2 ? '2nd Semester' : semester}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label>Instructor:</label>
                  <select 
                    value={gradeFilters.instructor} 
                    onChange={(e) => handleGradeFilterChange('instructor', e.target.value)}
                  >
                    <option value="">All Instructors</option>
                    {getUniqueInstructors().map(instructor => (
                      <option key={instructor.id} value={instructor.id}>
                        {instructor.first_name} {instructor.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label>Grade Status:</label>
                  <select 
                    value={gradeFilters.status} 
                    onChange={(e) => handleGradeFilterChange('status', e.target.value)}
                  >
                    <option value="">All Entries</option>
                    <option value="has_grade">With Grade</option>
                    <option value="no_grade">No Grade</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label>Grade:</label>
                  <select 
                    value={gradeFilters.grade} 
                    onChange={(e) => handleGradeFilterChange('grade', e.target.value)}
                  >
                    <option value="">All Grades</option>
                    {getUniqueGrades().map(grade => (
                      <option key={grade} value={grade}>{grade}</option>
                    ))}
                  </select>
                </div>

                {(gradeFilters.course || gradeFilters.year || gradeFilters.semester || gradeFilters.instructor || gradeFilters.status || gradeFilters.grade) && (
                  <button className="clear-filters-btn" onClick={clearGradeFilters}>
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            <div className="filter-info">
              Showing {filteredGrades.length} of {grades.length} published grade entries
              {(gradeFilters.course || gradeFilters.year || gradeFilters.semester || gradeFilters.instructor || gradeFilters.status || gradeFilters.grade) && (
                <span className="active-filters">
                  {gradeFilters.course && ` • Course: ${getUniqueCourses().find(c => c.id == gradeFilters.course)?.code}`}
                  {gradeFilters.year && ` • Year: ${gradeFilters.year}`}
                  {gradeFilters.semester && ` • Semester: ${gradeFilters.semester === '1' ? '1st' : '2nd'}`}
                  {gradeFilters.status && ` • Grade Status: ${gradeFilters.status === 'has_grade' ? 'With Grade' : 'No Grade'}`}
                  {gradeFilters.grade && ` • Grade: ${gradeFilters.grade}`}
                </span>
              )}
            </div>

            {filteredGrades.length > 0 ? (
              <div className="grades-table-container">
                <table className="grades-table">
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Student ID</th>
                      <th>Student Name</th>
                      <th>Program</th>
                      <th>Grade</th>
                      <th>Entered By</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGrades.map(grade => (
                      <tr key={grade.id}>
                        <td>{grade.course_name}</td>
                        <td>{grade.student_id}</td>
                        <td>{grade.student_name}</td>
                        <td>{grade.program_name}</td>
                        <td>
                          <span className={`grade-badge has-grade`}>
                            {grade.grade || 'Not Entered'}
                          </span>
                        </td>
                        <td>{grade.entered_by_name}</td>
                        <td>
                          <span className={`status-badge published`}>
                            Published ✅
                          </span>
                        </td>
                        <td>{grade.entered_at ? new Date(grade.entered_at).toLocaleDateString() : 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="no-data">
                <p>No published grades found matching your filters.</p>
                <p className="info-text">
                  {grades.length === 0 
                    ? "No published grades available in your department yet." 
                    : "Try adjusting your filters to see more results."}
                </p>
                {(gradeFilters.course || gradeFilters.year || gradeFilters.semester || gradeFilters.instructor || gradeFilters.status || gradeFilters.grade) && (
                  <button className="clear-filters-btn" onClick={clearGradeFilters}>
                    Clear Filters to Show All Published Grades
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* INSTRUCTORS TAB */}
        {activeTab === 'instructors' && (
          <div className="instructors-section">
            <h2>Instructors in {department?.name}</h2>
            {instructors.length > 0 ? (
              <div className="instructors-grid">
                {instructors.map(instructor => {
                  const instructorGrades = grades.filter(grade => 
                    grade._entered_by?.id === instructor.user?.id
                  );
                  
                  return (
                    <div key={instructor.id} className="instructor-card">
                      <h4>{instructor.user?.first_name} {instructor.user?.last_name}</h4>
                      <p><strong>Role:</strong> {instructor.role === 'department_head' ? 'Department Head' : 'Instructor'}</p>
                      <p><strong>Email:</strong> {instructor.user?.email}</p>
                      <p><strong>Username:</strong> {instructor.user?.username}</p>
                      <p><strong>Published Grades:</strong> {instructorGrades.length}</p>
                      <p><strong>Status:</strong> 
                        <span className={`status-badge ${instructor.user?.is_active ? 'active' : 'inactive'}`}>
                          {instructor.user?.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="no-data">
                <p>No instructors found in your department.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DeptHeadDashboard;