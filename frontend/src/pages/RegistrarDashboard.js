// IMPROVED CSRF CONFIGURATION
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/RegistrarDashboard.css';

// Configure axios for CSRF - ENHANCED
axios.defaults.xsrfCookieName = 'csrftoken';
axios.defaults.xsrfHeaderName = 'X-CSRFToken';
axios.defaults.withCredentials = true;

// Enhanced CSRF token management
const ensureCSRFToken = async () => {
  try {
    // Check if we already have a CSRF token
    const token = getCSRFToken();
    if (token) {
      console.log('🔐 CSRF token already available');
      return token;
    }
    
    // Fetch new CSRF token
    console.log('🔄 Fetching new CSRF token...');
    const response = await axios.get('http://127.0.0.1:8000/api/csrf-token/');
    const newToken = response.data.csrfToken;
    console.log('✅ New CSRF token received');
    return newToken;
  } catch (error) {
    console.error('❌ Failed to get CSRF token:', error);
    throw new Error('CSRF token initialization failed');
  }
};

const getCSRFToken = () => {
  const name = 'csrftoken=';
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    while (cookie.charAt(0) === ' ') {
      cookie = cookie.substring(1);
    }
    if (cookie.indexOf(name) === 0) {
      return cookie.substring(name.length, cookie.length);
    }
  }
  return null;
};

// Initialize CSRF
const initializeCSRF = async () => {
  console.log('🔄 Initializing CSRF protection...');
  try {
    await ensureCSRFToken();
    console.log('✅ CSRF protection initialized');
  } catch (error) {
    console.error('❌ CSRF initialization failed:', error);
  }
};
const RegistrarDashboard = () => {
  const [registrations, setRegistrations] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [activeTab, setActiveTab] = useState('assign');
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  
  // State for admin assignment
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState('');

  // Grade management states
  const [studentGrades, setStudentGrades] = useState([]);
  const [academicRecords, setAcademicRecords] = useState([]);
  const [departmentStatistics, setDepartmentStatistics] = useState([]);

  // Course slip states
  const [courseSlips, setCourseSlips] = useState([]);
  const [courseSlipFilters, setCourseSlipFilters] = useState({
    department: '',
    semester: '',
    academicYear: '',
    student: '',
    status: ''
  });
  const [filteredCourseSlips, setFilteredCourseSlips] = useState([]);

  // Filter states
  const [studentFilters, setStudentFilters] = useState({
    department: '',
    year: '',
    status: '',
    registrationStatus: ''
  });

  const [registrationFilters, setRegistrationFilters] = useState({
    semester: '',
    academicYear: '',
    registrationType: '',
    approvalStatus: '',
    lateRegistration: ''
  });

  const [courseFilters, setCourseFilters] = useState({
    department: '',
    year: '',
    semester: ''
  });

  const [gradeFilters, setGradeFilters] = useState({
    department: '',
    student: '',
    semester: '',
    academicYear: '',
    course: ''
  });

  const [academicRecordFilters, setAcademicRecordFilters] = useState({
    department: '',
    year: '',
    semester: ''
  });

  // Filtered data states
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [filteredRegistrations, setFilteredRegistrations] = useState([]);
  const [filteredCourses, setFilteredCourses] = useState([]);
  const [filteredGrades, setFilteredGrades] = useState([]);
  const [filteredAcademicRecords, setFilteredAcademicRecords] = useState([]);

  // Auto-assignment state
  const [autoAssignment, setAutoAssignment] = useState({
    selectedSemester: '',
    loading: false,
    progress: 0,
    currentStudent: ''
  });

  // CORRECTED transformCourseSlipData function
  const transformCourseSlipData = (courseSlipsFromAPI) => {
    if (!Array.isArray(courseSlipsFromAPI)) {
      console.log('Course slips data is not an array:', courseSlipsFromAPI);
      return [];
    }

    return courseSlipsFromAPI.map(slip => {
      console.log('Processing course slip:', slip);
      
      let courseDetails = [];
      if (slip.course_details && Array.isArray(slip.course_details)) {
        courseDetails = slip.course_details.map(course => ({
          id: course.id,
          code: course.code || 'N/A',
          name: course.name || 'Unknown Course',
          credits: course.credits || 0,
          department: course.department_name || course.department || 'N/A',
          year: course.year || 'N/A',
          semester: course.semester || 'N/A'
        }));
      } else if (slip.courses && Array.isArray(slip.courses)) {
        courseDetails = slip.courses.map(courseId => {
          const course = courses.find(c => c.id === courseId);
          return course ? {
            id: course.id,
            code: course.code,
            name: course.name,
            credits: course.credits,
            department: course.department_name || course.department?.name || 'N/A',
            year: course.year,
            semester: course.semester
          } : {
            id: courseId,
            code: 'N/A',
            name: 'Unknown Course',
            credits: 0,
            department: 'N/A',
            year: 'N/A',
            semester: 'N/A'
          };
        });
      }

      const totalCredits = courseDetails.reduce((sum, course) => sum + (course.credits || 0), 0);

      return {
        id: slip.id,
        student_id: slip.student_id,
        student_name: slip.student_name,
        student_department: slip.department_name,
        semester: slip.semester_name,
        academic_year: slip.academic_year_name,
        courses: courseDetails,
        total_credits: totalCredits,
        is_approved: slip.is_approved,
        approved_by: slip.approved_by_name || 'Not Approved',
        assigned_by: slip.assigned_by_name || 'System',
        assigned_date: slip.assigned_date,
        registered_at: slip.assigned_date,
        registration_type: 'admin'
      };
    });
  };

  useEffect(() => {
    initializeCSRF().then(() => {
      console.log('🔐 CSRF protection initialized');
      fetchRegistrarData();
    });
  }, []);

  // Apply filters when data or filters change
  useEffect(() => {
    applyStudentFilters();
    applyRegistrationFilters();
    applyCourseFilters();
    applyGradeFilters();
    applyAcademicRecordFilters();
    applyCourseSlipFilters();
  }, [students, registrations, courses, studentGrades, academicRecords, courseSlips, studentFilters, registrationFilters, courseFilters, gradeFilters, academicRecordFilters, courseSlipFilters]);

  // Fetch registrar data
  const fetchRegistrarData = async () => {
    setLoading(true);
    try {
      const [
        regResponse, 
        yearsResponse, 
        studentsResponse, 
        coursesResponse, 
        semestersResponse,
        gradesResponse
      ] = await Promise.all([
        axios.get('http://127.0.0.1:8000/api/registrations/'),
        axios.get('http://127.0.0.1:8000/api/academic-years/'),
        axios.get('http://127.0.0.1:8000/api/students/'),
        axios.get('http://127.0.0.1:8000/api/courses/'),
        axios.get('http://127.0.0.1:8000/api/semesters/'),
        axios.get('http://127.0.0.1:8000/api/grades/')
      ]);

      // Set basic data first
      setRegistrations(regResponse.data || []);
      setAcademicYears(yearsResponse.data || []);
      setStudents(studentsResponse.data || []);
      setCourses(coursesResponse.data || []);
      setSemesters(semestersResponse.data || []);
      
      // Enhanced grade data from standard grades endpoint
      const allGrades = gradesResponse.data || [];
      setStudentGrades(allGrades);

      // Then fetch course slips after basic data is set
      let courseSlipsData = [];
      try {
        const courseSlipsResponse = await axios.get('http://127.0.0.1:8000/api/course-slips/');
        console.log('✅ CourseSlipViewSet raw response:', courseSlipsResponse.data);
        
        // Handle different response formats
        if (Array.isArray(courseSlipsResponse.data)) {
          courseSlipsData = courseSlipsResponse.data;
        } else if (courseSlipsResponse.data && Array.isArray(courseSlipsResponse.data.results)) {
          courseSlipsData = courseSlipsResponse.data.results;
        } else if (courseSlipsResponse.data && Array.isArray(courseSlipsResponse.data.course_slips)) {
          courseSlipsData = courseSlipsResponse.data.course_slips;
        }
        
        // Transform with proper course data
        const transformedCourseSlips = transformCourseSlipData(courseSlipsData);
        setCourseSlips(transformedCourseSlips);
        
        console.log('✅ Transformed course slips:', transformedCourseSlips);
        
      } catch (courseSlipError) {
        console.error('❌ CourseSlipViewSet failed:', courseSlipError);
        setCourseSlips([]);
      }

      // Calculate statistics
      const totalStudents = studentsResponse.data?.length || 0;
      const totalRegistrations = regResponse.data?.length || 0;
      const totalGrades = allGrades.length || 0;
      const adminCourseSlipsCount = courseSlipsData.length;
      
      const pendingReg = regResponse.data?.filter(reg => reg.is_approved === false).length || 0;
      const approvedReg = regResponse.data?.filter(reg => reg.is_approved === true).length || 0;
      
      const studentsWithRegistrations = studentsResponse.data?.filter(student => {
        return regResponse.data?.some(reg => {
          const studentMatch = reg.student === student.id || 
                              reg.student_id === student.student_id ||
                              (typeof reg.student === 'object' && reg.student.id === student.id);
          return studentMatch;
        });
      }).length || 0;

      const lateReg = regResponse.data?.filter(reg => {
        return reg.is_late_registration === true;
      }).length || 0;

      setStats({
        totalStudents: totalStudents,
        totalRegistrations: totalRegistrations,
        studentsWithRegistrations: studentsWithRegistrations,
        pendingApprovals: pendingReg,
        approvedRegistrations: approvedReg,
        lateRegistrations: lateReg,
        totalGrades: totalGrades,
        averageGPA: 0,
        studentsWithGPA: 0,
        adminCourseSlips: adminCourseSlipsCount
      });

    } catch (error) {
      console.error('❌ Error fetching registrar data:', error);
      setRegistrations([]);
      setAcademicYears([]);
      setStudents([]);
      setCourses([]);
      setSemesters([]);
      setStudentGrades([]);
      setAcademicRecords([]);
      setDepartmentStatistics([]);
      setCourseSlips([]);
    } finally {
      setLoading(false);
    }
  };

  // Apply course slip filters
  const applyCourseSlipFilters = () => {
    let filtered = [...courseSlips];

    if (courseSlipFilters.department) {
      filtered = filtered.filter(slip => {
        if (!slip.student_department) return false;
        const filterDept = courseSlipFilters.department.toLowerCase().trim();
        const slipDept = slip.student_department.toLowerCase().trim();
        return slipDept === filterDept || 
               slipDept.includes(filterDept) || 
               filterDept.includes(slipDept);
      });
    }

    if (courseSlipFilters.semester) {
      filtered = filtered.filter(slip => {
        if (!slip.semester) return false;
        return slip.semester.toLowerCase().includes(courseSlipFilters.semester.toLowerCase());
      });
    }

    if (courseSlipFilters.academicYear) {
      filtered = filtered.filter(slip => {
        if (!slip.academic_year) return false;
        return slip.academic_year.includes(courseSlipFilters.academicYear);
      });
    }

    if (courseSlipFilters.student) {
      filtered = filtered.filter(slip => {
        const searchTerm = courseSlipFilters.student.toLowerCase();
        return (
          slip.student_name.toLowerCase().includes(searchTerm) ||
          (slip.student_id && slip.student_id.toLowerCase().includes(searchTerm))
        );
      });
    }

    if (courseSlipFilters.status) {
      if (courseSlipFilters.status === 'approved') {
        filtered = filtered.filter(slip => slip.is_approved);
      } else if (courseSlipFilters.status === 'pending') {
        filtered = filtered.filter(slip => !slip.is_approved);
      }
    }

    setFilteredCourseSlips(filtered);
  };

  // Handle course slip filter changes
  const handleCourseSlipFilterChange = (filterType, value) => {
    setCourseSlipFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  // Clear course slip filters
  const clearCourseSlipFilters = () => {
    setCourseSlipFilters({
      department: '',
      semester: '',
      academicYear: '',
      student: '',
      status: ''
    });
  };

  // Export course slips to CSV
  const exportCourseSlipsToCSV = () => {
    const headers = ['Student ID', 'Student Name', 'Department', 'Semester', 'Academic Year', 'Total Credits', 'Status', 'Approved By', 'Registered Date'];
    
    const csvData = filteredCourseSlips.map(slip => [
      slip.student_id,
      slip.student_name,
      slip.student_department,
      slip.semester,
      slip.academic_year,
      slip.total_credits,
      slip.is_approved ? 'Approved' : 'Pending',
      slip.approved_by || 'Not Approved',
      new Date(slip.registered_at).toLocaleDateString()
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-course-slips-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Print course slip
  const printCourseSlip = (courseSlip) => {
    const printWindow = window.open('', '_blank');
    
    let registrationDate = 'Invalid Date';
    try {
      if (courseSlip.registered_at) {
        registrationDate = new Date(courseSlip.registered_at).toLocaleDateString();
      } else if (courseSlip.assigned_date) {
        registrationDate = new Date(courseSlip.assigned_date).toLocaleDateString();
      } else {
        registrationDate = new Date().toLocaleDateString();
      }
    } catch (error) {
      console.error('Date formatting error:', error);
      registrationDate = new Date().toLocaleDateString();
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Course Slip - ${courseSlip.student_name}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
          .student-info { margin-bottom: 20px; }
          .course-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .course-table th, .course-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          .course-table th { background-color: #f5f5f5; }
          .summary { margin-top: 20px; }
          .status { margin-top: 10px; font-weight: bold; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Course Registration Slip</h1>
          <p>Admin-Assigned Courses</p>
        </div>
        
        <div class="student-info">
          <p><strong>Student ID:</strong> ${courseSlip.student_id}</p>
          <p><strong>Student Name:</strong> ${courseSlip.student_name}</p>
          <p><strong>Department:</strong> ${courseSlip.student_department}</p>
          <p><strong>Semester:</strong> ${courseSlip.semester}</p>
          <p><strong>Academic Year:</strong> ${courseSlip.academic_year}</p>
        </div>

        <table class="course-table">
          <thead>
            <tr>
              <th>Course Code</th>
              <th>Course Name</th>
              <th>Credits</th>
              <th>Department</th>
            </tr>
          </thead>
          <tbody>
            ${courseSlip.courses.map(course => `
              <tr>
                <td>${course.code}</td>
                <td>${course.name}</td>
                <td>${course.credits}</td>
                <td>${course.department || course.department_name || 'N/A'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="summary">
          <p><strong>Total Courses:</strong> ${courseSlip.courses.length}</p>
          <p><strong>Total Credits:</strong> ${courseSlip.total_credits}</p>
        </div>

        <div class="status">
          <p><strong>Status:</strong> ${courseSlip.is_approved ? 'APPROVED' : 'PENDING APPROVAL'}</p>
          ${courseSlip.is_approved ? `<p><strong>Approved By:</strong> ${courseSlip.approved_by}</p>` : ''}
          <p><strong>Registration Date:</strong> ${registrationDate}</p>
          <p><strong>Registration Type:</strong> Admin Assignment</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  // Calculate academic records from grades and students
  const calculateAcademicRecords = (students, grades) => {
    return students.map(student => {
      const studentGrades = grades.filter(grade => {
        const gradeStudentId = typeof grade.student === 'object' ? grade.student.id : grade.student;
        return gradeStudentId === student.id && grade.is_published;
      });

      const totalCredits = studentGrades.reduce((sum, grade) => {
        const course = courses.find(c => c.id === (typeof grade.course === 'object' ? grade.course.id : grade.course));
        return sum + (course?.credits || 0);
      }, 0);

      const totalQualityPoints = studentGrades.reduce((sum, grade) => {
        const course = courses.find(c => c.id === (typeof grade.course === 'object' ? grade.course.id : grade.course));
        return sum + ((course?.credits || 0) * (grade.grade_point || 0));
      }, 0);

      const gpa = totalCredits > 0 ? totalQualityPoints / totalCredits : 0;

      return {
        student_number: student.student_id,
        student_name: `${student.first_name} ${student.last_name}`,
        department: student.department_name || (typeof student.department === 'object' ? student.department.name : ''),
        year: student.year,
        gpa: round(gpa, 2),
        total_credits: totalCredits,
        total_courses: studentGrades.length,
        grades: studentGrades.map(grade => ({
          course_code: courses.find(c => c.id === (typeof grade.course === 'object' ? grade.course.id : grade.course))?.code,
          grade: grade.grade,
          credits: courses.find(c => c.id === (typeof grade.course === 'object' ? grade.course.id : grade.course))?.credits
        }))
      };
    });
  };

  // Calculate department statistics
  const calculateDepartmentStatistics = (students, grades, courses) => {
    const departmentsMap = {};
    
    // Group by department
    students.forEach(student => {
      const deptId = typeof student.department === 'object' ? student.department.id : student.department;
      const deptName = student.department_name || (typeof student.department === 'object' ? student.department.name : `Department ${deptId}`);
      
      if (!departmentsMap[deptId]) {
        departmentsMap[deptId] = {
          department_id: deptId,
          department_name: deptName,
          total_students: 0,
          total_grades: 0,
          grades: [],
          grade_distribution: {},
          grade_percentages: {}
        };
      }
      
      departmentsMap[deptId].total_students++;
    });

    // Add grade information
    grades.forEach(grade => {
      if (!grade.is_published) return;
      
      const student = students.find(s => s.id === (typeof grade.student === 'object' ? grade.student.id : grade.student));
      if (!student) return;
      
      const deptId = typeof student.department === 'object' ? student.department.id : student.department;
      if (departmentsMap[deptId]) {
        departmentsMap[deptId].total_grades++;
        departmentsMap[deptId].grades.push(grade);
        
        // Count grade distribution
        if (grade.grade) {
          departmentsMap[deptId].grade_distribution[grade.grade] = 
            (departmentsMap[deptId].grade_distribution[grade.grade] || 0) + 1;
        }
      }
    });

    // Calculate percentages and average GPA
    const result = Object.values(departmentsMap).map(dept => {
      const totalGradesWithValue = Object.values(dept.grade_distribution).reduce((sum, count) => sum + count, 0);
      Object.keys(dept.grade_distribution).forEach(grade => {
        dept.grade_percentages[grade] = totalGradesWithValue > 0 
          ? round((dept.grade_distribution[grade] / totalGradesWithValue) * 100, 1)
          : 0;
      });

      const totalPoints = dept.grades.reduce((sum, grade) => sum + (grade.grade_point || 0), 0);
      const average_gpa = dept.grades.length > 0 ? round(totalPoints / dept.grades.length, 2) : 0;

      return {
        ...dept,
        average_gpa: average_gpa
      };
    });

    return result;
  };

  // Helper function to round numbers
  const round = (value, decimals) => {
    return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
  };

  // Apply student filters
  const applyStudentFilters = () => {
    let filtered = [...students];

    if (studentFilters.department) {
      filtered = filtered.filter(student => {
        const deptId = typeof student.department === 'object' ? student.department.id : student.department;
        return deptId == studentFilters.department;
      });
    }

    if (studentFilters.year) {
      filtered = filtered.filter(student => student.year == studentFilters.year);
    }

    if (studentFilters.status) {
      filtered = filtered.filter(student => {
        if (studentFilters.status === 'active') return student.is_active === true;
        if (studentFilters.status === 'inactive') return student.is_active === false;
        return true;
      });
    }

    if (studentFilters.registrationStatus) {
      filtered = filtered.filter(student => {
        const status = getStudentRegistrationStatus(student).status;
        return status === studentFilters.registrationStatus;
      });
    }

    setFilteredStudents(filtered);
  };

  // Apply registration filters
  const applyRegistrationFilters = () => {
    let filtered = [...registrations];

    if (registrationFilters.semester) {
      filtered = filtered.filter(reg => {
        const semesterId = typeof reg.semester === 'object' ? reg.semester.id : reg.semester;
        return semesterId == registrationFilters.semester;
      });
    }

    if (registrationFilters.academicYear) {
      filtered = filtered.filter(reg => {
        const yearId = typeof reg.academic_year === 'object' ? reg.academic_year.id : reg.academic_year;
        return yearId == registrationFilters.academicYear;
      });
    }

    if (registrationFilters.registrationType) {
      filtered = filtered.filter(reg => reg.registration_type === registrationFilters.registrationType);
    }

    if (registrationFilters.approvalStatus) {
      filtered = filtered.filter(reg => {
        if (registrationFilters.approvalStatus === 'approved') return reg.is_approved === true;
        if (registrationFilters.approvalStatus === 'pending') return reg.is_approved === false;
        return true;
      });
    }

    if (registrationFilters.lateRegistration) {
      filtered = filtered.filter(reg => {
        if (registrationFilters.lateRegistration === 'late') return reg.is_late_registration === true;
        if (registrationFilters.lateRegistration === 'ontime') return reg.is_late_registration === false;
        return true;
      });
    }

    setFilteredRegistrations(filtered);
  };

  // Apply course filters
  const applyCourseFilters = () => {
    let filtered = [...courses];

    if (courseFilters.department) {
      filtered = filtered.filter(course => {
        const deptId = typeof course.department === 'object' ? course.department.id : course.department;
        return deptId == courseFilters.department;
      });
    }

    if (courseFilters.year) {
      filtered = filtered.filter(course => course.year == courseFilters.year);
    }

    if (courseFilters.semester) {
      filtered = filtered.filter(course => course.semester == courseFilters.semester);
    }

    setFilteredCourses(filtered);
  };

  // Apply grade filters
  const applyGradeFilters = () => {
    let filtered = [...studentGrades];

    if (gradeFilters.department) {
      filtered = filtered.filter(grade => {
        const student = students.find(s => s.id === (typeof grade.student === 'object' ? grade.student.id : grade.student));
        if (!student) return false;
        const deptId = typeof student.department === 'object' ? student.department.id : student.department;
        return deptId == gradeFilters.department;
      });
    }

    if (gradeFilters.student) {
      filtered = filtered.filter(grade => {
        const gradeStudentId = typeof grade.student === 'object' ? grade.student.id : grade.student;
        return gradeStudentId == gradeFilters.student;
      });
    }

    if (gradeFilters.semester) {
      filtered = filtered.filter(grade => {
        const gradeSemesterId = typeof grade.semester === 'object' ? grade.semester.id : grade.semester;
        return gradeSemesterId == gradeFilters.semester;
      });
    }

    if (gradeFilters.academicYear) {
      const semestersInYear = semesters.filter(sem => 
        sem.academic_year == gradeFilters.academicYear
      ).map(sem => sem.id);
      
      filtered = filtered.filter(grade => {
        const gradeSemesterId = typeof grade.semester === 'object' ? grade.semester.id : grade.semester;
        return semestersInYear.includes(gradeSemesterId);
      });
    }

    if (gradeFilters.course) {
      filtered = filtered.filter(grade => {
        const gradeCourseId = typeof grade.course === 'object' ? grade.course.id : grade.course;
        return gradeCourseId == gradeFilters.course;
      });
    }

    setFilteredGrades(filtered);
  };

  // Approve course slip
  const approveCourseSlip = async (courseSlipId) => {
    setLoading(true);
    try {
      const response = await axios.post(`http://127.0.0.1:8000/api/course-slips/${courseSlipId}/approve/`);
      
      if (response.data.success) {
        alert('Course slip approved successfully!');
        await fetchRegistrarData();
      } else {
        alert('Failed to approve course slip: ' + response.data.message);
      }
    } catch (error) {
      console.error('Error approving course slip:', error);
      alert('Error approving course slip: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Apply academic record filters
  const applyAcademicRecordFilters = () => {
    let filtered = [...academicRecords];

    if (academicRecordFilters.department) {
      filtered = filtered.filter(record => {
        const student = students.find(s => s.student_id === record.student_number);
        if (!student) return false;
        
        const deptId = typeof student.department === 'object' ? student.department.id : student.department;
        return deptId == academicRecordFilters.department;
      });
    }

    if (academicRecordFilters.year) {
      filtered = filtered.filter(record => record.year == academicRecordFilters.year);
    }

    setFilteredAcademicRecords(filtered);
  };

  // Handle filter changes
  const handleStudentFilterChange = (filterType, value) => {
    setStudentFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const handleRegistrationFilterChange = (filterType, value) => {
    setRegistrationFilters(prev => ({
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

  const handleGradeFilterChange = (filterType, value) => {
    setGradeFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const handleAcademicRecordFilterChange = (filterType, value) => {
    setAcademicRecordFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  // Clear all filters
  const clearStudentFilters = () => {
    setStudentFilters({
      department: '',
      year: '',
      status: '',
      registrationStatus: ''
    });
  };

  const clearRegistrationFilters = () => {
    setRegistrationFilters({
      semester: '',
      academicYear: '',
      registrationType: '',
      approvalStatus: '',
      lateRegistration: ''
    });
  };

  const clearCourseFilters = () => {
    setCourseFilters({
      department: '',
      year: '',
      semester: ''
    });
  };

  const clearGradeFilters = () => {
    setGradeFilters({
      department: '',
      student: '',
      semester: '',
      academicYear: '',
      course: ''
    });
  };

  const clearAcademicRecordFilters = () => {
    setAcademicRecordFilters({
      department: '',
      year: '',
      semester: ''
    });
  };

  // Get unique values for filters
  const getUniqueDepartments = () => {
    const departmentsMap = {};
    
    students.forEach(student => {
      if (student.department) {
        if (typeof student.department === 'object' && student.department.id) {
          departmentsMap[student.department.id] = {
            id: student.department.id,
            name: student.department.name || `Department ${student.department.id}`
          };
        } else if (student.department_name) {
          departmentsMap[student.department] = {
            id: student.department,
            name: student.department_name
          };
        } else if (typeof student.department === 'number') {
          departmentsMap[student.department] = {
            id: student.department,
            name: `Department ${student.department}`
          };
        }
      }
    });

    courses.forEach(course => {
      if (course.department) {
        if (typeof course.department === 'object' && course.department.id) {
          departmentsMap[course.department.id] = {
            id: course.department.id,
            name: course.department.name || `Department ${course.department.id}`
          };
        } else if (course.department_name) {
          departmentsMap[course.department] = {
            id: course.department,
            name: course.department_name
          };
        } else if (typeof course.department === 'number') {
          departmentsMap[course.department] = {
            id: course.department,
            name: `Department ${course.department}`
          };
        }
      }
    });

    return Object.values(departmentsMap);
  };

  const getUniqueYears = () => {
    return [1, 2, 3, 4, 5];
  };

  const getUniqueSemesters = () => {
    return semesters;
  };

  const getUniqueAcademicYears = () => {
    return academicYears;
  };

  // Get courses filtered by student's department
  const getCoursesForStudent = (studentId) => {
    if (!studentId) return courses;
    
    const student = students.find(s => s.id == studentId);
    if (!student) return courses;
    
    const studentDeptId = typeof student.department === 'object' 
      ? student.department.id 
      : student.department;
    
    return courses.filter(course => {
      const courseDeptId = typeof course.department === 'object' 
        ? course.department.id 
        : course.department;
      
      return courseDeptId == studentDeptId;
    });
  };
// Add this authentication helper function
// SIMPLIFIED Authentication Check
const ensureAuthenticated = async () => {
  try {
    // Use an existing endpoint that requires authentication to test
    const response = await axios.get('http://127.0.0.1:8000/api/course-slips/', {
      withCredentials: true
    });
    
    // If we get a response (even if empty), we're authenticated
    console.log('✅ Authentication confirmed');
    return true;
  } catch (error) {
    if (error.response?.status === 403 || error.response?.status === 401) {
      console.error('❌ Authentication failed:', error.response.data);
      throw new Error('Authentication failed. Please refresh the page and login again.');
    }
    
    // If it's a 404 or other error, we might still be authenticated but the endpoint doesn't exist
    console.warn('⚠️ Endpoint not available, but proceeding with assignment...');
    return true;
  }
};
 // SIMPLIFIED Individual course assignment
// SIMPLIFIED Individual course assignment
const assignCoursesToStudent = async () => {
  if (!selectedStudent || selectedCourses.length === 0 || !selectedSemester) {
    alert('Please select a student, semester, and at least one course.');
    return;
  }

  setLoading(true);
  try {
    // Ensure authentication
    await ensureAuthenticated();

    const response = await axios.post(
      'http://127.0.0.1:8000/api/create-student-course-slip/',
      {
        student_id: selectedStudent,
        course_ids: selectedCourses,
        semester_id: selectedSemester
      },
      {
        withCredentials: true,
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      }
    );

    if (response.data.success) {
      alert('✅ ' + response.data.message);
      setSelectedStudent('');
      setSelectedCourses([]);
      setSelectedSemester('');
      await fetchRegistrarData();
    } else {
      alert('❌ Failed: ' + response.data.message);
    }
  } catch (error) {
    console.error('Error assigning courses:', error);
    
    if (error.response?.status === 403) {
      if (error.response?.data?.detail?.includes('Authentication')) {
        alert('❌ Authentication failed. Please refresh the page and login again.');
      } else {
        alert('❌ Permission denied. Please make sure you have registrar privileges.');
      }
    } else if (error.response?.data?.error) {
      alert('❌ Error: ' + error.response.data.error);
    } else {
      alert('❌ Error assigning courses: ' + error.message);
    }
  } finally {
    setLoading(false);
  }
};
  // Handle course selection
  const handleCourseSelect = (courseId) => {
    setSelectedCourses(prev => {
      if (prev.includes(courseId)) {
        return prev.filter(id => id !== courseId);
      } else {
        return [...prev, courseId];
      }
    });
  };

  // Get students without registrations for current semester
  const getStudentsForAssignment = () => {
    const currentSemester = semesters.find(sem => sem.is_active) || semesters[0];
    if (!currentSemester) return students;

    return students.filter(student => {
      const hasRegistration = registrations.some(reg => {
        const studentMatch = reg.student === student.id || 
                            reg.student_id === student.student_id ||
                            (typeof reg.student === 'object' && reg.student.id === student.id);
        const semesterMatch = reg.semester === currentSemester.id ||
                             (typeof reg.semester === 'object' && reg.semester.id === currentSemester.id);
        return studentMatch && semesterMatch;
      });
      return !hasRegistration;
    });
  };

  // Approve registration
  const approveRegistration = async (registrationId) => {
    setLoading(true);
    try {
      const response = await axios.post(`http://127.0.0.1:8000/api/registrations/${registrationId}/approve_registration/`);
      
      if (response.data.success) {
        alert('Registration approved successfully!');
        await fetchRegistrarData();
      } else {
        alert('Failed to approve registration: ' + response.data.message);
      }
    } catch (error) {
      console.error('Error approving registration:', error);
      alert('Error approving registration: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Get students who don't have ANY registration
  const getStudentsWithoutAnyRegistration = () => {
    return students.filter(student => {
      return !registrations.some(reg => {
        return reg.student === student.id || 
               reg.student_id === student.student_id ||
               (typeof reg.student === 'object' && reg.student.id === student.id);
      });
    });
  };

  // Get student registration status
  const getStudentRegistrationStatus = (student) => {
    const studentRegs = registrations.filter(reg => {
      return reg.student === student.id || 
             reg.student_id === student.student_id ||
             (typeof reg.student === 'object' && reg.student.id === student.id);
    });
    
    if (studentRegs.length === 0) {
      return { status: 'not_registered', hasRegistration: false, hasApproved: false };
    }
    
    const hasApproved = studentRegs.some(reg => reg.is_approved === true);
    const hasPending = studentRegs.some(reg => reg.is_approved === false);
    
    if (hasApproved) {
      return { status: 'approved', hasRegistration: true, hasApproved: true };
    } else if (hasPending) {
      return { status: 'pending', hasRegistration: true, hasApproved: false };
    }
    
    return { status: 'not_registered', hasRegistration: false, hasApproved: false };
  };

  const getPendingRegistrations = () => {
    return filteredRegistrations.filter(reg => reg.is_approved === false);
  };

  const getApprovedRegistrations = () => {
    return filteredRegistrations.filter(reg => reg.is_approved === true);
  };

  const isLateRegistration = (registration) => {
    return registration.is_late_registration === true;
  };

  // Render registration status
  const renderRegistrationStatus = (student) => {
    const { status } = getStudentRegistrationStatus(student);
    
    switch (status) {
      case 'approved':
        return <span className="status-success">✅ Approved</span>;
      case 'pending':
        return <span className="status-warning">⏳ Pending</span>;
      case 'not_registered':
        return <span className="status-danger">❌ Not Registered</span>;
      default:
        return <span className="status-danger">❌ Not Registered</span>;
    }
  };

  // Get grade points display
  const getGradePointsDisplay = (gradeObj) => {
    if (!gradeObj.points) return 'N/A';
    return `${gradeObj.points} / 4.00`;
  };

  // Get GPA color based on value
  const getGPAColor = (gpa) => {
    if (gpa >= 3.5) return 'excellent';
    if (gpa >= 3.0) return 'very-good';
    if (gpa >= 2.5) return 'good';
    if (gpa >= 2.0) return 'satisfactory';
    return 'needs-improvement';
  };

  // Export grades to CSV
  const exportGradesToCSV = () => {
    const headers = ['Student ID', 'Student Name', 'Course Code', 'Course Name', 'Department', 'Semester', 'Grade', 'Points', 'Credits', 'Quality Points'];
    
    const csvData = filteredGrades.map(grade => {
      const student = students.find(s => s.id === (typeof grade.student === 'object' ? grade.student.id : grade.student));
      const course = courses.find(c => c.id === (typeof grade.course === 'object' ? grade.course.id : grade.course));
      const semesterObj = semesters.find(s => s.id === (typeof grade.semester === 'object' ? grade.semester.id : grade.semester));
      
      return [
        student?.student_id || 'N/A',
        student ? `${student.first_name} ${student.last_name}` : 'N/A',
        course?.code || 'N/A',
        course?.name || 'N/A',
        student?.department_name || 'N/A',
        semesterObj?.name || 'N/A',
        grade.grade || 'N/A',
        grade.grade_point || 'N/A',
        course?.credits || 'N/A',
        ((course?.credits || 0) * (grade.grade_point || 0)).toFixed(2)
      ];
    });

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `student-grades-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Export academic records to CSV
  const exportAcademicRecordsToCSV = () => {
    const headers = ['Student ID', 'Student Name', 'Department', 'Year', 'GPA', 'Total Credits', 'Total Courses'];
    
    const csvData = filteredAcademicRecords.map(record => [
      record.student_number,
      record.student_name,
      record.department,
      record.year,
      record.gpa,
      record.total_credits,
      record.total_courses
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `academic-records-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Get grade color for visualization
  const getGradeColor = (grade) => {
    const gradeColors = {
      'A+': '#27ae60', 'A': '#2ecc71', 'A-': '#3498db',
      'B+': '#9b59b6', 'B': '#34495e', 'B-': '#f39c12',
      'C+': '#e67e22', 'C': '#d35400', 'C-': '#c0392b',
      'D': '#e74c3c', 'F': '#c0392b', 'I': '#95a5a6'
    };
    return gradeColors[grade] || '#95a5a6';
  };

  // IMPROVED: Get students who don't have course slips for a specific semester
const getStudentsWithoutCourseSlips = (semesterId = null) => {
  if (!semesterId) return [];
  
  return students.filter(student => {
    // Check if student has ANY course slip for the given semester
    const hasCourseSlip = courseSlips.some(slip => {
      // Handle different data structures for student ID
      let slipStudentId;
      if (typeof slip.student === 'object') {
        slipStudentId = slip.student?.id;
      } else if (typeof slip.student === 'number') {
        slipStudentId = slip.student;
      } else {
        slipStudentId = slip.student_id || slip.student;
      }
      
      // Handle different data structures for semester ID
      let slipSemesterId;
      if (typeof slip.semester === 'object') {
        slipSemesterId = slip.semester?.id;
      } else if (typeof slip.semester === 'number') {
        slipSemesterId = slip.semester;
      } else {
        slipSemesterId = slip.semester_id || slip.semester;
      }
      
      // Match student and semester
      const studentMatch = slipStudentId == student.id;
      const semesterMatch = slipSemesterId == semesterId;
      
      return studentMatch && semesterMatch;
    });
    
    return !hasCourseSlip;
  });
};

// Add this function to filter students by department in auto-assignment
const getFilteredStudentsForAutoAssignment = (semesterId, departmentFilter = '') => {
  let studentsWithoutSlips = getStudentsWithoutCourseSlips(semesterId);
  
  // Apply department filter if provided
  if (departmentFilter) {
    studentsWithoutSlips = studentsWithoutSlips.filter(student => {
      const studentDeptId = typeof student.department === 'object' 
        ? student.department.id 
        : student.department;
      return studentDeptId == departmentFilter;
    });
  }
  
  return studentsWithoutSlips;
};

  // SMART COURSE SELECTION LOGIC
  const getAppropriateCoursesForStudent = (student) => {
    const studentDeptId = typeof student.department === 'object' ? student.department.id : student.department;
    const studentYear = student.year;
    
    // Filter courses that match the student's department and year
    const departmentCourses = courses.filter(course => {
      const courseDeptId = typeof course.department === 'object' ? course.department.id : course.department;
      
      // Match department
      const departmentMatch = courseDeptId == studentDeptId;
      
      // Match year level
      const yearMatch = course.year == studentYear;
      
      // Match semester
      const semesterMatch = !course.semester || course.semester == 1;
      
      return departmentMatch && yearMatch && semesterMatch;
    });

    // If no department courses found, try broader matching
    if (departmentCourses.length === 0) {
      console.warn(`No department-specific courses found for ${student.department_name}, Year ${student.year}`);
      
      // Fallback: return some general courses or empty array
      return courses.filter(course => course.year == studentYear).slice(0, 4);
    }

    // Return appropriate courses (limit to reasonable number)
    return departmentCourses.slice(0, 6);
  };

 /// Use existing endpoints that we know work
// Add this function to your RegistrarDashboard component
const checkLoginStatus = async () => {
  try {
    // Try to access an endpoint that exists and requires authentication
    const response = await axios.get('http://127.0.0.1:8000/api/course-slips/');
    console.log('✅ User is authenticated and can access protected endpoints');
    return true;
  } catch (error) {
    console.error('❌ Authentication check failed:', error.response?.status);
    
    if (error.response?.status === 403 || error.response?.status === 401) {
      alert('🔐 Please login first to access registrar features.');
      return false;
    } else if (error.response?.status === 404) {
      // Endpoint doesn't exist, but we might still be authenticated
      console.log('⚠️ Endpoint not found, but proceeding...');
      return true;
    }
    
    // For other errors, assume we're not authenticated
    alert('❌ Authentication failed. Please login again.');
    return false;
  }
};
const applyAutoAssignment = async () => {
  // STEP 1: Check authentication AND ensure CSRF token
  console.log('🔐 Checking authentication and CSRF status...');
  
  try {
    // Ensure CSRF token is available for POST requests
    await ensureCSRFToken();
    
    const isLoggedIn = await checkLoginStatus();
    if (!isLoggedIn) {
      alert('❌ Authentication required.');
      return;
    }
  } catch (error) {
    alert('❌ Authentication/CSRF setup failed. Please refresh the page.');
    return;
  }

  // STEP 2: Validate semester selection
  if (!autoAssignment.selectedSemester) {
    alert('Please select a semester for auto-assignment.');
    return;
  }

  const studentsWithoutSlips = getStudentsWithoutCourseSlips(autoAssignment.selectedSemester);
  
  console.log(`🎯 Auto-assignment starting for semester: ${autoAssignment.selectedSemester}`);
  console.log(`📊 Students without approved course slips: ${studentsWithoutSlips.length}`);

  if (studentsWithoutSlips.length === 0) {
    alert('🎉 All students already have APPROVED course slips for the selected semester!');
    return;
  }

  const confirmed = window.confirm(
    `Auto-assign courses to ${studentsWithoutSlips.length} students who don't have approved course slips?`
  );
  if (!confirmed) return;

  setAutoAssignment(prev => ({ 
    ...prev, 
    loading: true,
    progress: 0,
    currentStudent: ''
  }));

  try {
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < studentsWithoutSlips.length; i++) {
      const student = studentsWithoutSlips[i];

      setAutoAssignment(prev => ({
        ...prev,
        progress: Math.round((i / studentsWithoutSlips.length) * 100),
        currentStudent: `${student.first_name} ${student.last_name} (${student.student_id})`
      }));

      try {
        const appropriateCourses = getAppropriateCoursesForStudent(student);

        if (appropriateCourses.length === 0) {
          console.log(`❌ No appropriate courses found for ${student.student_id}`);
          errorCount++;
          continue;
        }

        console.log(`🔄 Assigning ${appropriateCourses.length} courses to ${student.student_id}`);
        
        // STEP 3: Make POST request with explicit CSRF headers
        const csrfToken = getCSRFToken();
        console.log('🔐 Using CSRF token for POST:', csrfToken ? 'Yes' : 'No');
        
        const response = await axios.post(
          'http://127.0.0.1:8000/api/create-student-course-slip/',
          {
            student_id: student.id,
            semester_id: autoAssignment.selectedSemester,
            course_ids: appropriateCourses.map(course => course.id)
          },
          {
            headers: {
              'X-CSRFToken': csrfToken,
              'X-Requested-With': 'XMLHttpRequest'
            }
          }
        );

        if (response.data.success) {
          successCount++;
          console.log(`✅ Successfully assigned courses to ${student.student_id}`);
        } else {
          errorCount++;
          console.log(`❌ API failed for ${student.student_id}:`, response.data.message);
        }
      } catch (error) {
        errorCount++;
        const errorData = error.response?.data;
        console.error(`❌ Error for ${student.student_id}:`, errorData);

        // Enhanced error handling
        if (i === 0) {
          if (error.response?.status === 403) {
            if (errorData?.detail?.includes('CSRF')) {
              alert('🔐 CSRF token issue! Please refresh the page completely and try again.');
              break;
            } else if (errorData?.detail?.includes('Authentication')) {
              alert('🔐 Session expired! Please login again and refresh the page.');
              break;
            } else if (errorData?.error) {
              alert(`❌ Permission error: ${errorData.error}`);
              break;
            }
          }
        }
      }

      // Small delay between requests
      if (i < studentsWithoutSlips.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // STEP 4: Show results
    setAutoAssignment(prev => ({
      ...prev,
      progress: 100,
      currentStudent: 'Complete'
    }));

    if (successCount > 0) {
      alert(`✅ Successfully assigned courses to ${successCount} students`);
      await fetchRegistrarData();
    }
    
    if (errorCount > 0) {
      if (successCount === 0) {
        alert(`❌ All ${errorCount} assignments failed.\n\nThis is likely a CSRF or session issue. Please:\n1. Refresh the page completely\n2. Ensure you're logged in as registrar\n3. Try again`);
      } else {
        alert(`⚠️ Partially completed:\n✅ ${successCount} students assigned\n❌ ${errorCount} students failed`);
      }
    }

  } catch (error) {
    console.error('Auto-assignment overall error:', error);
    alert('❌ Auto-assignment failed: ' + error.message);
  } finally {
    setAutoAssignment(prev => ({ 
      ...prev, 
      loading: false,
      currentStudent: ''
    }));
  }
};
  return (
    <div className="registrar-dashboard">
      <div className="dashboard-header">
        <h1>Registrar Dashboard</h1>
        <p>Manage student registrations, grades, and academic records</p>
        
        <div className="debug-info" style={{fontSize: '12px', color: '#666', marginTop: '10px'}}>
          Loaded: {students.length} students, {registrations.length} registrations, {courses.length} courses, {studentGrades.length} grades, {courseSlips.length} admin course slips
        </div>

        {getStudentsWithoutAnyRegistration().length > 0 && (
          <div className="info-banner">
            ℹ️ {getStudentsWithoutAnyRegistration().length} student(s) have accounts but haven't registered for courses yet.
          </div>
        )}
      </div>

      {/* Enhanced Statistics Overview */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Students</h3>
          <div className="stat-number">{stats.totalStudents || 0}</div>
          <div className="stat-subtitle">Accounts in system</div>
        </div>
        <div className="stat-card">
          <h3>Registered Students</h3>
          <div className="stat-number">{stats.studentsWithRegistrations || 0}</div>
          <div className="stat-subtitle">With course registrations</div>
        </div>
        <div className="stat-card warning">
          <h3>Pending Approval</h3>
          <div className="stat-number">{stats.pendingApprovals || 0}</div>
          <div className="stat-subtitle">Registrations</div>
        </div>
        <div className="stat-card success">
          <h3>Approved</h3>
          <div className="stat-number">{stats.approvedRegistrations || 0}</div>
          <div className="stat-subtitle">Registrations</div>
        </div>
        
        {/* GRADE STATS */}
        <div className="stat-card info">
          <h3>Grades Recorded</h3>
          <div className="stat-number">{stats.totalGrades || 0}</div>
          <div className="stat-subtitle">Total grade entries</div>
        </div>
        <div className="stat-card excellent">
          <h3>Average GPA</h3>
          <div className="stat-number">{stats.averageGPA || 0}</div>
          <div className="stat-subtitle">Across all students</div>
        </div>
        {/* NEW: Admin Course Slips Stat */}
        <div className="stat-card secondary">
          <h3>Admin Course Slips</h3>
          <div className="stat-number">{stats.adminCourseSlips || 0}</div>
          <div className="stat-subtitle">Assigned through admin</div>
        </div>
      </div>

      {/* Enhanced Tabs */}
      <div className="dashboard-tabs">
        <button className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
                onClick={() => setActiveTab('pending')}>
          ⏳ Pending Approval ({getPendingRegistrations().length})
        </button>
        <button className={`tab-btn ${activeTab === 'approved' ? 'active' : ''}`}
                onClick={() => setActiveTab('approved')}>
          ✅ Approved Registrations ({getApprovedRegistrations().length})
        </button>
        <button className={`tab-btn ${activeTab === 'assign' ? 'active' : ''}`}
                onClick={() => setActiveTab('assign')}>
          📚 Assign to Student
        </button>
        <button className={`tab-btn ${activeTab === 'auto-assign' ? 'active' : ''}`}
                onClick={() => setActiveTab('auto-assign')}>
          🤖 Auto Assign Courses
        </button>
        <button className={`tab-btn ${activeTab === 'course-slips' ? 'active' : ''}`}
                onClick={() => setActiveTab('course-slips')}>
          📋 Course Slips ({filteredCourseSlips.length})
        </button>
        <button className={`tab-btn ${activeTab === 'grades' ? 'active' : ''}`}
                onClick={() => setActiveTab('grades')}>
          📊 All Grades ({filteredGrades.length})
        </button>
        <button className={`tab-btn ${activeTab === 'academic-records' ? 'active' : ''}`}
                onClick={() => setActiveTab('academic-records')}>
          🎓 Academic Records ({filteredAcademicRecords.length})
        </button>
        <button className={`tab-btn ${activeTab === 'department-stats' ? 'active' : ''}`}
                onClick={() => setActiveTab('department-stats')}>
          📈 Department Stats
        </button>
        <button className={`tab-btn ${activeTab === 'students' ? 'active' : ''}`}
                onClick={() => setActiveTab('students')}>
          👥 All Students ({filteredStudents.length})
        </button>
        <button className={`tab-btn ${activeTab === 'unregistered' ? 'active' : ''}`}
                onClick={() => setActiveTab('unregistered')}>
          📋 Need Registration ({getStudentsWithoutAnyRegistration().length})
        </button>
      </div>

      <div className="tab-content">
        {/* PENDING REGISTRATIONS TAB */}
        {activeTab === 'pending' && (
          <div className="pending-section">
            <div className="section-header">
              <h2>Pending Registration Approvals</h2>
              <div className="filter-controls">
                <div className="filter-group">
                  <label>Semester:</label>
                  <select 
                    value={registrationFilters.semester} 
                    onChange={(e) => handleRegistrationFilterChange('semester', e.target.value)}
                  >
                    <option value="">All Semesters</option>
                    {getUniqueSemesters().map(semester => (
                      <option key={semester.id} value={semester.id}>
                        {semester.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="filter-group">
                  <label>Academic Year:</label>
                  <select 
                    value={registrationFilters.academicYear} 
                    onChange={(e) => handleRegistrationFilterChange('academicYear', e.target.value)}
                  >
                    <option value="">All Years</option>
                    {getUniqueAcademicYears().map(year => (
                      <option key={year.id} value={year.id}>
                        {year.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="filter-group">
                  <label>Registration Type:</label>
                  <select 
                    value={registrationFilters.registrationType} 
                    onChange={(e) => handleRegistrationFilterChange('registrationType', e.target.value)}
                  >
                    <option value="">All Types</option>
                    <option value="student">Student Self-Registration</option>
                    <option value="admin">Admin Assignment</option>
                  </select>
                </div>
                <div className="filter-group">
                  <label>Late Registration:</label>
                  <select 
                    value={registrationFilters.lateRegistration} 
                    onChange={(e) => handleRegistrationFilterChange('lateRegistration', e.target.value)}
                  >
                    <option value="">All</option>
                    <option value="late">Late Only</option>
                    <option value="ontime">On Time Only</option>
                  </select>
                </div>
                {(registrationFilters.semester || registrationFilters.academicYear || registrationFilters.registrationType || registrationFilters.lateRegistration) && (
                  <button className="clear-filters-btn" onClick={clearRegistrationFilters}>
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            <div className="filter-info">
              Showing {getPendingRegistrations().length} of {registrations.filter(reg => reg.is_approved === false).length} pending registrations
            </div>

            {getPendingRegistrations().length > 0 ? (
              <div className="registrations-list">
                {getPendingRegistrations().map(registration => (
                  <div key={registration.id} className="registration-card pending">
                    <div className="registration-header">
                      <h4>{registration.student_name || registration.student?.first_name} - {registration.semester_name || registration.semester?.name}</h4>
                      <span className="registration-date">
                        Submitted: {new Date(registration.registered_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="registration-details">
                      <p><strong>Student ID:</strong> {registration.student_id || registration.student?.student_id}</p>
                      <p><strong>Academic Year:</strong> {registration.academic_year_name || registration.academic_year?.name}</p>
                      <p><strong>Courses:</strong> {registration.courses_details?.length || registration.courses?.length || 0} courses</p>
                      <p><strong>Registration Type:</strong> 
                        <span className={`status-badge ${registration.registration_type === 'admin' ? 'info' : 'secondary'}`}>
                          {registration.registration_type === 'admin' ? 'Admin Assignment' : 'Student Self-Registration'}
                        </span>
                      </p>
                      {isLateRegistration(registration) && (
                        <p className="late-warning">⚠️ Late Registration</p>
                      )}
                    </div>
                    <div className="registration-actions">
                      <button 
                        onClick={() => approveRegistration(registration.id)}
                        className="btn-success"
                        disabled={loading}
                      >
                        {loading ? 'Approving...' : 'Approve Registration'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-data">
                <p>No pending registrations for approval.</p>
                <p className="info-text">
                  All course registrations have been approved or no new registrations submitted.
                </p>
              </div>
            )}
          </div>
        )}

        {/* APPROVED REGISTRATIONS TAB */}
        {activeTab === 'approved' && (
          <div className="approved-section">
            <div className="section-header">
              <h2>Approved Course Registrations ({getApprovedRegistrations().length})</h2>
              <div className="filter-controls">
                <div className="filter-group">
                  <label>Semester:</label>
                  <select 
                    value={registrationFilters.semester} 
                    onChange={(e) => handleRegistrationFilterChange('semester', e.target.value)}
                  >
                    <option value="">All Semesters</option>
                    {getUniqueSemesters().map(semester => (
                      <option key={semester.id} value={semester.id}>
                        {semester.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="filter-group">
                  <label>Academic Year:</label>
                  <select 
                    value={registrationFilters.academicYear} 
                    onChange={(e) => handleRegistrationFilterChange('academicYear', e.target.value)}
                  >
                    <option value="">All Years</option>
                    {getUniqueAcademicYears().map(year => (
                      <option key={year.id} value={year.id}>
                        {year.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="filter-group">
                  <label>Registration Type:</label>
                  <select 
                    value={registrationFilters.registrationType} 
                    onChange={(e) => handleRegistrationFilterChange('registrationType', e.target.value)}
                  >
                    <option value="">All Types</option>
                    <option value="student">Student Self-Registration</option>
                    <option value="admin">Admin Assignment</option>
                  </select>
                </div>
                <div className="filter-group">
                  <label>Late Registration:</label>
                  <select 
                    value={registrationFilters.lateRegistration} 
                    onChange={(e) => handleRegistrationFilterChange('lateRegistration', e.target.value)}
                  >
                    <option value="">All</option>
                    <option value="late">Late Only</option>
                    <option value="ontime">On Time Only</option>
                  </select>
                </div>
                {(registrationFilters.semester || registrationFilters.academicYear || registrationFilters.registrationType || registrationFilters.lateRegistration) && (
                  <button className="clear-filters-btn" onClick={clearRegistrationFilters}>
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            <div className="filter-info">
              Showing {getApprovedRegistrations().length} of {registrations.filter(reg => reg.is_approved === true).length} approved registrations
            </div>

            {getApprovedRegistrations().length > 0 ? (
              <div className="registrations-list">
                {getApprovedRegistrations().map(registration => (
                  <div key={registration.id} className="registration-card approved">
                    <div className="registration-header">
                      <h4>{registration.student_name || registration.student?.first_name} - {registration.semester_name || registration.semester?.name}</h4>
                      <span className="status-badge approved">Approved</span>
                    </div>
                    <div className="registration-details">
                      <p><strong>Student ID:</strong> {registration.student_id || registration.student?.student_id}</p>
                      <p><strong>Academic Year:</strong> {registration.academic_year_name || registration.academic_year?.name}</p>
                      <p><strong>Approved by:</strong> {registration.approved_by_name || registration.approved_by?.get_full_name || 'System'}</p>
                      <p><strong>Courses:</strong> {registration.courses_details?.length || registration.courses?.length || 0}</p>
                      <p><strong>Registration Type:</strong> 
                        <span className={`status-badge ${registration.registration_type === 'admin' ? 'info' : 'secondary'}`}>
                          {registration.registration_type === 'admin' ? 'Admin Assignment' : 'Student Self-Registration'}
                        </span>
                      </p>
                      <p><strong>Late Registration:</strong> 
                        <span className={isLateRegistration(registration) ? 'status-warning' : 'status-success'}>
                          {isLateRegistration(registration) ? ' Yes' : ' No'}
                        </span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-data">
                <p>No approved registrations yet.</p>
              </div>
            )}
          </div>
        )}

        {/* INDIVIDUAL COURSE ASSIGNMENT TAB */}
        {activeTab === 'assign' && (
          <div className="assignment-section">
            <h2>Assign Courses to Individual Student</h2>
            
            <div className="assignment-form">
              <div className="form-group">
                <label>Select Student:</label>
                <select 
                  value={selectedStudent} 
                  onChange={(e) => {
                    setSelectedStudent(e.target.value);
                    setSelectedCourses([]);
                  }}
                  className="form-select"
                >
                  <option value="">Choose a student</option>
                  {getStudentsForAssignment().map(student => (
                    <option key={student.id} value={student.id}>
                      {student.student_id} - {student.first_name} {student.last_name} 
                      ({student.department_name || student.department?.name})
                    </option>
                  ))}
                </select>
                
                {selectedStudent && (
                  <div className="student-department-info">
                    <small>
                      Department: <strong>
                        {students.find(s => s.id == selectedStudent)?.department_name || 
                         students.find(s => s.id == selectedStudent)?.department?.name}
                      </strong>
                    </small>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Select Semester:</label>
                <select 
                  value={selectedSemester} 
                  onChange={(e) => setSelectedSemester(e.target.value)}
                  className="form-select"
                >
                  <option value="">Choose a semester</option>
                  {semesters.map(semester => (
                    <option key={semester.id} value={semester.id}>
                      {semester.name} - {semester.academic_year_name || semester.academic_year?.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <div className="filter-controls">
                  <h4>Filter Courses</h4>
                  <div className="filter-group">
                    <label>Year:</label>
                    <select 
                      value={courseFilters.year} 
                      onChange={(e) => handleCourseFilterChange('year', e.target.value)}
                    >
                      <option value="">All Years</option>
                      {[1, 2, 3, 4, 5].map(year => (
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
                      <option value="1">1st Semester</option>
                      <option value="2">2nd Semester</option>
                    </select>
                  </div>
                  {(courseFilters.year || courseFilters.semester) && (
                    <button className="clear-filters-btn" onClick={clearCourseFilters}>
                      Clear Filters
                    </button>
                  )}
                </div>

                <label>Select Courses (from student's department only):</label>
                
                {selectedStudent ? (
                  <div className="courses-checkbox-list">
                    {getCoursesForStudent(selectedStudent)
                      .filter(course => {
                        let include = true;
                        if (courseFilters.year && course.year != courseFilters.year) include = false;
                        if (courseFilters.semester && course.semester != courseFilters.semester) include = false;
                        return include;
                      })
                      .map(course => (
                        <div key={course.id} className="course-checkbox">
                          <label>
                            <input
                              type="checkbox"
                              checked={selectedCourses.includes(course.id)}
                              onChange={() => handleCourseSelect(course.id)}
                            />
                            {course.code} - {course.name} 
                            - Year {course.year}, Sem {course.semester}
                            - {course.credits} credits
                          </label>
                        </div>
                      ))
                    }
                  </div>
                ) : (
                  <div className="no-student-selected">
                    <p>Please select a student first to see available courses from their department.</p>
                  </div>
                )}
                
                <div className="selected-count">
                  {selectedCourses.length} course(s) selected
                </div>
              </div>

              <button 
                onClick={assignCoursesToStudent}
                className="btn-primary"
                disabled={loading || !selectedStudent || selectedCourses.length === 0 || !selectedSemester}
              >
                {loading ? 'Assigning...' : 'Assign Courses to Student'}
              </button>
            </div>

            {selectedStudent && (
              <div className="assignment-preview">
                <h4>Assignment Preview:</h4>
                <p><strong>Student:</strong> {
                  students.find(s => s.id == selectedStudent)?.first_name + ' ' + 
                  students.find(s => s.id == selectedStudent)?.last_name
                }</p>
                <p><strong>Department:</strong> {
                  students.find(s => s.id == selectedStudent)?.department_name || 
                  students.find(s => s.id == selectedStudent)?.department?.name
                }</p>
                <p><strong>Semester:</strong> {
                  semesters.find(s => s.id == selectedSemester)?.name
                }</p>
                <p><strong>Courses to assign:</strong></p>
                <ul>
                  {selectedCourses.map(courseId => {
                    const course = courses.find(c => c.id == courseId);
                    return course ? (
                      <li key={course.id}>
                        {course.code} - {course.name} 
                        (Year {course.year}, Sem {course.semester}, {course.credits} credits)
                      </li>
                    ) : null;
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* AUTO ASSIGNMENT TAB */}
{activeTab === 'auto-assign' && (
  <div className="auto-assignment-section">
    <div className="section-header">
      <h2>Auto-Assign Courses to Students</h2>
      <p>Automatically assign appropriate courses to students without course slips for the selected semester</p>
    </div>

    <div className="auto-assignment-form">
      <div className="form-row">
        <div className="form-group">
          <label>Select Semester:</label>
          <select 
            value={autoAssignment.selectedSemester} 
            onChange={(e) => setAutoAssignment(prev => ({...prev, selectedSemester: e.target.value}))}
            className="form-select"
          >
            <option value="">Choose a semester</option>
            {semesters.map(semester => (
              <option key={semester.id} value={semester.id}>
                {semester.name} - {semester.academic_year_name || semester.academic_year?.name}
              </option>
            ))}
          </select>
        </div>

        {/* ADD DEPARTMENT FILTER */}
        <div className="form-group">
          <label>Filter by Department:</label>
          <select 
            value={autoAssignment.departmentFilter || ''} 
            onChange={(e) => setAutoAssignment(prev => ({...prev, departmentFilter: e.target.value}))}
            className="form-select"
          >
            <option value="">All Departments</option>
            {getUniqueDepartments().map(dept => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Student Preview - NOW SHOWS ONLY STUDENTS WITHOUT COURSE SLIPS */}
      {autoAssignment.selectedSemester && (
        <div className="students-preview" style={{marginTop: '25px', padding: '15px', background: '#f5f5f5', borderRadius: '8px'}}>
          <div className="preview-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
            <h4>📋 Students Who Will Receive Course Slips:</h4>
            <div style={{fontSize: '14px', color: '#666'}}>
              {getFilteredStudentsForAutoAssignment(
                autoAssignment.selectedSemester, 
                autoAssignment.departmentFilter
              ).length} students found
            </div>
          </div>
          
          {getFilteredStudentsForAutoAssignment(
            autoAssignment.selectedSemester, 
            autoAssignment.departmentFilter
          ).length > 0 ? (
            <>
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px', marginTop: '10px'}}>
                {getFilteredStudentsForAutoAssignment(
                  autoAssignment.selectedSemester, 
                  autoAssignment.departmentFilter
                ).slice(0, 12).map(student => (
                  <div key={student.id} className="student-preview-item" style={{
                    padding: '10px', 
                    background: 'white', 
                    borderRadius: '5px', 
                    border: '1px solid #ddd',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                      <strong>{student.student_id}</strong>
                      <span style={{fontSize: '0.8em', color: '#666'}}>Year {student.year}</span>
                    </div>
                    <div>{student.first_name} {student.last_name}</div>
                    <div style={{fontSize: '0.9em', color: '#666'}}>
                      {student.department_name || student.department?.name}
                    </div>
                    <div style={{fontSize: '0.8em', color: '#28a745', fontWeight: 'bold'}}>
                      ✅ No course slip for {semesters.find(s => s.id == autoAssignment.selectedSemester)?.name}
                    </div>
                  </div>
                ))}
              </div>
              {getFilteredStudentsForAutoAssignment(
                autoAssignment.selectedSemester, 
                autoAssignment.departmentFilter
              ).length > 12 && (
                <div style={{textAlign: 'center', marginTop: '10px', color: '#666'}}>
                  ... and {getFilteredStudentsForAutoAssignment(
                    autoAssignment.selectedSemester, 
                    autoAssignment.departmentFilter
                  ).length - 12} more students
                </div>
              )}
            </>
          ) : (
            <div style={{textAlign: 'center', padding: '20px', color: '#666'}}>
              {autoAssignment.departmentFilter ? (
                <div>
                  <p>🎉 All students in this department already have course slips for this semester!</p>
                  <button 
                    className="clear-filters-btn" 
                    onClick={() => setAutoAssignment(prev => ({...prev, departmentFilter: ''}))}
                    style={{marginTop: '10px'}}
                  >
                    Clear Department Filter to See All Students
                  </button>
                </div>
              ) : (
                <p>🎉 All students already have course slips for this semester!</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Progress Display */}
      {autoAssignment.loading && (
        <div className="progress-section" style={{marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px'}}>
          <h4>🔄 Auto-Assignment in Progress</h4>
          <div style={{marginBottom: '10px'}}>
            <strong>Progress:</strong> {autoAssignment.progress}%
          </div>
          <div style={{width: '100%', background: '#e9ecef', borderRadius: '4px', overflow: 'hidden'}}>
            <div 
              style={{
                width: `${autoAssignment.progress}%`,
                height: '20px',
                background: '#28a745',
                transition: 'width 0.3s ease'
              }}
            ></div>
          </div>
          {autoAssignment.currentStudent && (
            <div style={{marginTop: '10px', fontStyle: 'italic'}}>
              Currently processing: {autoAssignment.currentStudent}
            </div>
          )}
        </div>
      )}

      <button 
        onClick={applyAutoAssignment}
        className="btn-success"
        disabled={autoAssignment.loading || !autoAssignment.selectedSemester || 
          getFilteredStudentsForAutoAssignment(
            autoAssignment.selectedSemester, 
            autoAssignment.departmentFilter
          ).length === 0}
        style={{width: '100%', padding: '12px', fontSize: '16px', marginTop: '20px'}}
      >
        {autoAssignment.loading ? '🔄 Auto-Assigning...' : '🤖 Start Auto-Assignment'}
      </button>
      
      <small style={{display: 'block', marginTop: '10px', color: '#666', textAlign: 'center'}}>
        The system will automatically assign appropriate courses based on student's department and year level
        {autoAssignment.departmentFilter && (
          <span> • Filtered by: {
            getUniqueDepartments().find(d => d.id == autoAssignment.departmentFilter)?.name
          }</span>
        )}
      </small>
    </div>
  </div>
)}
        {/* COURSE SLIPS TAB */}
        {activeTab === 'course-slips' && (
          <div className="course-slips-section">
            <div className="section-header">
              <h2>Admin-Assigned Course Slips ({filteredCourseSlips.length})</h2>
              <p>View all course slips assigned through admin across all departments</p>
              
              <div className="filter-controls">
                <div className="filter-group">
                  <label>Department:</label>
                  <select 
                    value={courseSlipFilters.department} 
                    onChange={(e) => handleCourseSlipFilterChange('department', e.target.value)}
                  >
                    <option value="">All Departments</option>
                    {getUniqueDepartments().map(dept => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label>Semester:</label>
                  <select 
                    value={courseSlipFilters.semester} 
                    onChange={(e) => handleCourseSlipFilterChange('semester', e.target.value)}
                  >
                    <option value="">All Semesters</option>
                    {getUniqueSemesters().map(semester => (
                      <option key={semester.id} value={semester.id}>
                        {semester.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label>Status:</label>
                  <select 
                    value={courseSlipFilters.status} 
                    onChange={(e) => handleCourseSlipFilterChange('status', e.target.value)}
                  >
                    <option value="">All Status</option>
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label>Student:</label>
                  <input 
                    type="text"
                    placeholder="Search by name or ID"
                    value={courseSlipFilters.student}
                    onChange={(e) => handleCourseSlipFilterChange('student', e.target.value)}
                  />
                </div>

                {(courseSlipFilters.department || courseSlipFilters.semester || courseSlipFilters.status || courseSlipFilters.student) && (
                  <button className="clear-filters-btn" onClick={clearCourseSlipFilters}>
                    Clear Filters
                  </button>
                )}

                <button className="export-btn" onClick={exportCourseSlipsToCSV}>
                  📥 Export CSV
                </button>
              </div>
            </div>

            <div className="filter-info">
              Showing {filteredCourseSlips.length} of {courseSlips.length} admin-assigned course slips
              {(courseSlipFilters.department || courseSlipFilters.semester || courseSlipFilters.status || courseSlipFilters.student) && (
                <span className="active-filters">
                  {courseSlipFilters.department && ` • Department: ${getUniqueDepartments().find(d => d.id == courseSlipFilters.department)?.name}`}
                  {courseSlipFilters.semester && ` • Semester: ${getUniqueSemesters().find(s => s.id == courseSlipFilters.semester)?.name}`}
                  {courseSlipFilters.status && ` • Status: ${courseSlipFilters.status}`}
                  {courseSlipFilters.student && ` • Student: ${courseSlipFilters.student}`}
                </span>
              )}
            </div>

            {filteredCourseSlips.length > 0 ? (
              <div className="course-slips-grid">
                {filteredCourseSlips.map(slip => (
                  <div key={slip.id} className="course-slip-card">
                    <div className="slip-header">
                      <div className="student-info">
                        <h4>{slip.student_name}</h4>
                        <p className="student-id">ID: {slip.student_id}</p>
                        <p className="department">Department: {slip.student_department}</p>
                      </div>
                      <div className="slip-meta">
                        <span className={`status-badge ${slip.is_approved ? 'approved' : 'pending'}`}>
                          {slip.is_approved ? '✅ Approved' : '⏳ Pending'}
                        </span>
                        <p className="semester">{slip.semester} • {slip.academic_year}</p>
                        <p className="credits">{slip.total_credits} total credits</p>
                      </div>
                    </div>

                    <div className="courses-list">
                      <h5>Assigned Courses ({slip.courses?.length || 0})</h5>
                      <div className="courses-grid">
                        {slip.courses?.map((course, index) => (
                          <div key={course.id || index} className="course-item">
                            <div className="course-code">{course.code || 'N/A'}</div>
                            <div className="course-name">{course.name || 'Unknown Course'}</div>
                            <div className="course-credits">{course.credits || 0} credits</div>
                            <div className="course-dept">Dept: {course.department_name || course.department || 'N/A'}</div>
                            <div className="course-year">Year {course.year || 'N/A'}, Sem {course.semester || 'N/A'}</div>
                          </div>
                        ))}
                        {(!slip.courses || slip.courses.length === 0) && (
                          <div className="no-courses">No courses assigned</div>
                        )}
                      </div>
                    </div>
                    <div className="slip-footer">
                      <div className="slip-details">
                        <p><strong>Assigned by:</strong> {slip.assigned_by_name || `User ${slip.assigned_by}` || 'System'}</p>
                        <p><strong>Assigned on:</strong> {new Date(slip.assigned_date).toLocaleDateString()}</p>
                        {slip.is_approved && slip.approved_by && (
                          <p><strong>Approved by:</strong> {slip.approved_by_name || `User ${slip.approved_by}`}</p>
                        )}
                      </div>
                      <div className="slip-actions">
                        <button 
                          className="btn-primary"
                          onClick={() => printCourseSlip(slip)}
                        >
                          🖨️ Print Slip
                        </button>
                        {!slip.is_approved && (
                          <button 
                            className="btn-success"
                            onClick={() => approveCourseSlip(slip.id)}
                            disabled={loading}
                          >
                            {loading ? 'Approving...' : 'Approve'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-data">
                {courseSlips.length === 0 ? (
                  <>
                    <p>No admin-assigned course slips found.</p>
                    <p className="info-text">
                      Course slips will appear here when admins assign courses to students.
                    </p>
                  </>
                ) : (
                  <>
                    <p>No course slips found matching your filters.</p>
                    <button className="clear-filters-btn" onClick={clearCourseSlipFilters}>
                      Clear Filters to Show All Course Slips
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

      {/* ALL GRADES TAB */}
        {activeTab === 'grades' && (
          <div className="grades-section">
            <div className="section-header">
              <h2>All Student Grades ({filteredGrades.length})</h2>
              <div className="filter-controls">
                <div className="filter-group">
                  <label>Department:</label>
                  <select 
                    value={gradeFilters.department} 
                    onChange={(e) => handleGradeFilterChange('department', e.target.value)}
                  >
                    <option value="">All Departments</option>
                    {getUniqueDepartments().map(dept => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="filter-group">
                  <label>Student:</label>
                  <select 
                    value={gradeFilters.student} 
                    onChange={(e) => handleGradeFilterChange('student', e.target.value)}
                  >
                    <option value="">All Students</option>
                    {students.map(student => (
                      <option key={student.id} value={student.id}>
                        {student.student_id} - {student.first_name} {student.last_name}
                      </option>
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
                      <option key={semester.id} value={semester.id}>
                        {semester.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="filter-group">
                  <label>Academic Year:</label>
                  <select 
                    value={gradeFilters.academicYear} 
                    onChange={(e) => handleGradeFilterChange('academicYear', e.target.value)}
                  >
                    <option value="">All Years</option>
                    {getUniqueAcademicYears().map(year => (
                      <option key={year.id} value={year.id}>
                        {year.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="filter-group">
                  <label>Course:</label>
                  <select 
                    value={gradeFilters.course} 
                    onChange={(e) => handleGradeFilterChange('course', e.target.value)}
                  >
                    <option value="">All Courses</option>
                    {courses.map(course => (
                      <option key={course.id} value={course.id}>
                        {course.code} - {course.name}
                      </option>
                    ))}
                  </select>
                </div>
                {(gradeFilters.department || gradeFilters.student || gradeFilters.semester || gradeFilters.academicYear || gradeFilters.course) && (
                  <button className="clear-filters-btn" onClick={clearGradeFilters}>
                    Clear Filters
                  </button>
                )}
                <button className="export-btn" onClick={exportGradesToCSV}>
                  📥 Export CSV
                </button>
              </div>
            </div>

            <div className="filter-info">
              Showing {filteredGrades.length} of {studentGrades.length} grades
            </div>

            {filteredGrades.length > 0 ? (
              <div className="grades-table-container">
                <table className="grades-table">
                  <thead>
                    <tr>
                      <th>Student ID</th>
                      <th>Student Name</th>
                      <th>Course</th>
                      <th>Department</th>
                      <th>Semester</th>
                      <th>Grade</th>
                      <th>Points</th>
                      <th>Credits</th>
                      <th>Quality Points</th>
                      <th>Entered By</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredGrades.map(grade => {
                      const student = students.find(s => s.id === (typeof grade.student === 'object' ? grade.student.id : grade.student));
                      const course = courses.find(c => c.id === (typeof grade.course === 'object' ? grade.course.id : grade.course));
                      const semesterObj = semesters.find(s => s.id === (typeof grade.semester === 'object' ? grade.semester.id : grade.semester));
                      
                      return (
                        <tr key={grade.id}>
                          <td>{student?.student_id || 'N/A'}</td>
                          <td>{student ? `${student.first_name} ${student.last_name}` : 'N/A'}</td>
                          <td>
                            <div className="course-info">
                              <strong>{course?.code || 'N/A'}</strong>
                              <div className="course-name">{course?.name || 'N/A'}</div>
                            </div>
                          </td>
                          <td>{student?.department_name || 'N/A'}</td>
                          <td>{semesterObj?.name || 'N/A'}</td>
                          <td>
                            <span className={`grade-badge grade-${grade.grade}`}>
                              {grade.grade || 'N/A'}
                            </span>
                          </td>
                          <td>{grade.grade_point || 'N/A'}</td>
                          <td>{course?.credits || 'N/A'}</td>
                          <td>{((course?.credits || 0) * (grade.grade_point || 0)).toFixed(2)}</td>
                          <td>{grade.entered_by || 'System'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="no-data">
                <p>No grades found matching your filters.</p>
                {studentGrades.length === 0 && (
                  <p className="info-text">
                    No grades have been recorded yet. Grades will appear here once instructors enter them.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ACADEMIC RECORDS TAB */}
        {activeTab === 'academic-records' && (
          <div className="academic-records-section">
            <div className="section-header">
              <h2>Student Academic Records ({filteredAcademicRecords.length})</h2>
              <div className="filter-controls">
                <div className="filter-group">
                  <label>Department:</label>
                  <select 
                    value={academicRecordFilters.department} 
                    onChange={(e) => handleAcademicRecordFilterChange('department', e.target.value)}
                  >
                    <option value="">All Departments</option>
                    {getUniqueDepartments().map(dept => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="filter-group">
                  <label>Year:</label>
                  <select 
                    value={academicRecordFilters.year} 
                    onChange={(e) => handleAcademicRecordFilterChange('year', e.target.value)}
                  >
                    <option value="">All Years</option>
                    {getUniqueYears().map(year => (
                      <option key={year} value={year}>Year {year}</option>
                    ))}
                  </select>
                </div>
                {(academicRecordFilters.department || academicRecordFilters.year) && (
                  <button className="clear-filters-btn" onClick={clearAcademicRecordFilters}>
                    Clear Filters
                  </button>
                )}
                <button className="export-btn" onClick={exportAcademicRecordsToCSV}>
                  📥 Export CSV
                </button>
              </div>
            </div>

            <div className="filter-info">
              Showing {filteredAcademicRecords.length} of {academicRecords.length} academic records
            </div>

            {filteredAcademicRecords.length > 0 ? (
              <div className="academic-records-list">
                {filteredAcademicRecords.map(record => (
                  <div key={record.student_number} className="academic-record-card">
                    <div className="record-header">
                      <div className="student-info">
                        <h4>{record.student_name}</h4>
                        <span className="student-id">{record.student_number}</span>
                      </div>
                      <div className="gpa-display">
                        <div className={`gpa-badge gpa-${getGPAColor(record.gpa)}`}>
                          <div className="gpa-value">{record.gpa}</div>
                          <div className="gpa-label">GPA</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="record-details">
                      <div className="detail-item">
                        <span className="label">Department:</span>
                        <span className="value">{record.department}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Year:</span>
                        <span className="value">Year {record.year}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Total Credits:</span>
                        <span className="value">{record.total_credits}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Total Courses:</span>
                        <span className="value">{record.total_courses}</span>
                      </div>
                    </div>

                    {record.grades && record.grades.length > 0 && (
                      <div className="grades-breakdown">
                        <h5>Recent Grades:</h5>
                        <div className="grades-list">
                          {record.grades.slice(0, 5).map((grade, index) => (
                            <div key={index} className="grade-item">
                              <span className="course-code">{grade.course_code}</span>
                              <span className={`grade grade-${grade.grade}`}>{grade.grade}</span>
                              <span className="credits">{grade.credits} credits</span>
                            </div>
                          ))}
                          {record.grades.length > 5 && (
                            <div className="more-grades">
                              +{record.grades.length - 5} more courses
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-data">
                <p>No academic records found matching your filters.</p>
                {academicRecords.length === 0 && (
                  <p className="info-text">
                    Academic records will appear here once students have grades recorded.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* DEPARTMENT STATISTICS TAB */}
        {activeTab === 'department-stats' && (
          <div className="department-stats-section">
            <h2>Department Grade Statistics</h2>
            
            {departmentStatistics.length > 0 ? (
              <div className="stats-cards">
                {departmentStatistics.map(dept => (
                  <div key={dept.department_id} className="department-stat-card">
                    <div className="dept-header">
                      <h3>{dept.department_name}</h3>
                      <div className="dept-gpa">
                        <span className="gpa-value">{dept.average_gpa}</span>
                        <span className="gpa-label">Avg GPA</span>
                      </div>
                    </div>
                    
                    <div className="dept-stats">
                      <div className="stat-item">
                        <span className="stat-label">Total Students:</span>
                        <span className="stat-value">{dept.total_students}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Total Grades:</span>
                        <span className="stat-value">{dept.total_grades}</span>
                      </div>
                    </div>

                    {dept.grade_distribution && Object.keys(dept.grade_distribution).length > 0 && (
                      <div className="grade-distribution">
                        <h4>Grade Distribution</h4>
                        <div className="distribution-bars">
                          {Object.entries(dept.grade_distribution).map(([grade, count]) => (
                            <div key={grade} className="distribution-item">
                              <div className="grade-label">{grade}</div>
                              <div className="distribution-bar">
                                <div 
                                  className="bar-fill"
                                  style={{ 
                                    width: `${dept.grade_percentages[grade]}%`,
                                    backgroundColor: getGradeColor(grade)
                                  }}
                                ></div>
                              </div>
                              <div className="distribution-count">
                                {count} ({dept.grade_percentages[grade]}%)
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-data">
                <p>No department statistics available.</p>
                <p className="info-text">
                  Department statistics will appear here once grades are recorded across departments.
                </p>
              </div>
            )}
          </div>
        )}

        {/* STUDENT MANAGEMENT TAB */}
        {activeTab === 'students' && (
          <div className="students-section">
            <div className="section-header">
              <h2>All Students ({filteredStudents.length})</h2>
              <div className="filter-controls">
                <div className="filter-group">
                  <label>Department:</label>
                  <select 
                    value={studentFilters.department} 
                    onChange={(e) => handleStudentFilterChange('department', e.target.value)}
                  >
                    <option value="">All Departments</option>
                    {getUniqueDepartments().map(dept => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
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
                <div className="filter-group">
                  <label>Registration:</label>
                  <select 
                    value={studentFilters.registrationStatus} 
                    onChange={(e) => handleStudentFilterChange('registrationStatus', e.target.value)}
                  >
                    <option value="">All</option>
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                    <option value="not_registered">Not Registered</option>
                  </select>
                </div>
                {(studentFilters.department || studentFilters.year || studentFilters.status || studentFilters.registrationStatus) && (
                  <button className="clear-filters-btn" onClick={clearStudentFilters}>
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            <div className="filter-info">
              Showing {filteredStudents.length} of {students.length} students
            </div>

            <div className="students-table-container">
              {filteredStudents.length > 0 ? (
                <table className="students-table">
                  <thead>
                    <tr>
                      <th>Student ID</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Department</th>
                      <th>Year</th>
                      <th>Status</th>
                      <th>Course Registration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map(student => (
                      <tr key={student.id}>
                        <td>{student.student_id}</td>
                        <td>{student.first_name} {student.last_name}</td>
                        <td>{student.email || 'N/A'}</td>
                        <td>{student.department_name || student.department?.name || `Department ${student.department}`}</td>
                        <td>Year {student.year}</td>
                        <td>
                          <span className={`status-badge ${student.is_active ? 'active' : 'inactive'}`}>
                            {student.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          {renderRegistrationStatus(student)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="no-data">
                  <p>No students found matching your filters.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STUDENTS NEEDING REGISTRATION TAB */}
        {activeTab === 'unregistered' && (
          <div className="unregistered-section">
            <h2>Students Needing Course Registration ({getStudentsWithoutAnyRegistration().length})</h2>
            {getStudentsWithoutAnyRegistration().length > 0 ? (
              <div className="students-list">
                {getStudentsWithoutAnyRegistration().map(student => (
                  <div key={student.id} className="student-card unregistered">
                    <div className="student-header">
                      <h4>{student.first_name} {student.last_name}</h4>
                      <span className="student-id">{student.student_id}</span>
                    </div>
                    <div className="student-details">
                      <p><strong>Email:</strong> {student.email}</p>
                      <p><strong>Department:</strong> {student.department_name || student.department?.name}</p>
                      <p><strong>Year:</strong> {student.year}</p>
                      <p><strong>Status:</strong> 
                        <span className={`status-badge ${student.is_active ? 'active' : 'inactive'}`}>
                          {student.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </p>
                    </div>
                    <div className="student-note">
                      <p>This student has an account but hasn't registered for any courses yet.</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-data">
                <p>All students have completed course registration.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RegistrarDashboard;