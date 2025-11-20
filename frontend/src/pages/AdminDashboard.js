import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/AdminDashboard.css';

const AdminDashboard = () => {
  const [stats, setStats] = useState({ departments: [], total_students: 0, total_courses: 0 });
  const [students, setStudents] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedYear, setSelectedYear] = useState('all'); // New state for year filter
  const [yearStats, setYearStats] = useState({}); // New state for year-wise statistics

  useEffect(() => {
    fetchStatistics();
    fetchStudents();
  }, []);

  const fetchStatistics = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/departments/statistics/');
      setStats(response.data);
      
      // Calculate year-wise statistics
      calculateYearStats(response.data.departments);
    } catch (error) {
      console.error('Error fetching statistics:', error);
      // Mock data for demonstration
      const mockStats = {
        departments: [
          { 
            id: 1, name: 'Computer Science', code: 'CS', student_count: 150,
            years: { 1: 50, 2: 40, 3: 35, 4: 25 } // Year-wise breakdown
          },
          { 
            id: 2, name: 'Electrical Engineering', code: 'EE', student_count: 120,
            years: { 1: 45, 2: 35, 3: 25, 4: 15 }
          },
          { 
            id: 3, name: 'Mechanical Engineering', code: 'ME', student_count: 100,
            years: { 1: 40, 2: 30, 3: 20, 4: 10 }
          }
        ],
        total_students: 370,
        total_courses: 45
      };
      setStats(mockStats);
      calculateYearStats(mockStats.departments);
    }
  };

  // Calculate year-wise statistics
  const calculateYearStats = (departments) => {
    const yearData = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    
    departments.forEach(dept => {
      if (dept.years) {
        Object.entries(dept.years).forEach(([year, count]) => {
          yearData[year] = (yearData[year] || 0) + count;
        });
      }
    });
    
    setYearStats(yearData);
  };

  const fetchStudents = async (year = 'all') => {
    try {
      const url = year === 'all' 
        ? 'http://localhost:8000/api/students/'
        : `http://localhost:8000/api/students/?year=${year}`;
      
      const response = await axios.get(url);
      setStudents(response.data);
    } catch (error) {
      console.error('Error fetching students:', error);
      // Mock data filtered by year
      const allStudents = [
        {
          id: 1, student_id: 'WU001', first_name: 'John', last_name: 'Doe',
          email: 'john.doe@wollega.edu.et', department_name: 'Computer Science',
          program_name: 'BSc Computer Science', year: 3, registration_date: '2022-09-01'
        },
        {
          id: 2, student_id: 'WU002', first_name: 'Alice', last_name: 'Smith',
          email: 'alice.smith@wollega.edu.et', department_name: 'Electrical Engineering',
          program_name: 'BSc Electrical Engineering', year: 2, registration_date: '2023-09-01'
        },
        {
          id: 3, student_id: 'WU003', first_name: 'Bob', last_name: 'Johnson',
          email: 'bob.johnson@wollega.edu.et', department_name: 'Computer Science',
          program_name: 'BSc Computer Science', year: 1, registration_date: '2024-09-01'
        },
        {
          id: 4, student_id: 'WU004', first_name: 'Emma', last_name: 'Wilson',
          email: 'emma.wilson@wollega.edu.et', department_name: 'Mechanical Engineering',
          program_name: 'BSc Mechanical Engineering', year: 4, registration_date: '2021-09-01'
        }
      ];

      if (year === 'all') {
        setStudents(allStudents);
      } else {
        setStudents(allStudents.filter(student => student.year == year));
      }
    }
  };

  const handleYearFilter = (year) => {
    setSelectedYear(year);
    fetchStudents(year);
  };

  // Filter students by selected year for display
  const filteredStudents = selectedYear === 'all' 
    ? students 
    : students.filter(student => student.year == selectedYear);

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>Admin Dashboard</h1>
        <p>Wollega University Student Registration System</p>
      </div>

      <div className="admin-tabs">
        <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
        <button className={`tab-btn ${activeTab === 'students' ? 'active' : ''}`} onClick={() => setActiveTab('students')}>Students</button>
        <button className={`tab-btn ${activeTab === 'departments' ? 'active' : ''}`} onClick={() => setActiveTab('departments')}>Departments</button>
        <button className={`tab-btn ${activeTab === 'years' ? 'active' : ''}`} onClick={() => setActiveTab('years')}>Year Analysis</button>
      </div>

      <div className="tab-content">
        {activeTab === 'overview' && (
          <>
            <div className="stats-overview">
              <div className="stat-card total-students">
                <h3>Total Students</h3>
                <div className="stat-number">{stats.total_students}</div>
              </div>
              <div className="stat-card total-courses">
                <h3>Total Courses</h3>
                <div className="stat-number">{stats.total_courses}</div>
              </div>
              <div className="stat-card total-departments">
                <h3>Departments</h3>
                <div className="stat-number">{stats.departments.length}</div>
              </div>
            </div>
            
            {/* Year-wise Statistics in Overview */}
            <div className="year-stats">
              <h3>Students by Year</h3>
              <div className="stats-grid">
                {[1, 2, 3, 4, 5].map(year => (
                  <div key={year} className="stat-card year">
                    <h4>Year {year}</h4>
                    <div className="stat-number">{yearStats[year] || 0}</div>
                    <div className="stat-percentage">
                      {stats.total_students > 0 ? 
                        Math.round(((yearStats[year] || 0) / stats.total_students) * 100) : 0}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="department-stats">
              <h3>Students by Department</h3>
              <div className="stats-grid">
                {stats.departments.map(dept => (
                  <div key={dept.id} className="stat-card department">
                    <h4>{dept.name}</h4>
                    <div className="stat-number">{dept.student_count}</div>
                    <div className="stat-percentage">
                      {stats.total_students > 0 ? 
                        Math.round((dept.student_count / stats.total_students) * 100) : 0}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'students' && (
          <div className="students-management">
            <div className="students-header">
              <h3>All Students</h3>
              <div className="year-filters">
                <span>Filter by Year:</span>
                <button 
                  className={`year-filter-btn ${selectedYear === 'all' ? 'active' : ''}`}
                  onClick={() => handleYearFilter('all')}
                >
                  All Years
                </button>
                {[1, 2, 3, 4, 5].map(year => (
                  <button
                    key={year}
                    className={`year-filter-btn ${selectedYear == year ? 'active' : ''}`}
                    onClick={() => handleYearFilter(year)}
                  >
                    Year {year}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="filter-info">
              {selectedYear !== 'all' && (
                <p>Showing {filteredStudents.length} students from Year {selectedYear}</p>
              )}
            </div>

            <div className="students-table">
              <table>
                <thead>
                  <tr>
                    <th>Student ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Department</th>
                    <th>Program</th>
                    <th>Year</th>
                    <th>Registration Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map(student => (
                    <tr key={student.id}>
                      <td>{student.student_id}</td>
                      <td>{student.first_name} {student.last_name}</td>
                      <td>{student.email}</td>
                      <td>{student.department_name}</td>
                      <td>{student.program_name}</td>
                      <td>Year {student.year}</td>
                      <td>{new Date(student.registration_date).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredStudents.length === 0 && (
                <div className="no-data">No students found for the selected year.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'departments' && (
          <div className="departments-management">
            <h3>Department Statistics</h3>
            <div className="departments-grid">
              {stats.departments.map(dept => (
                <div key={dept.id} className="department-card">
                  <h4>{dept.name}</h4>
                  <div className="dept-code">{dept.code}</div>
                  <div className="dept-stats">
                    <div className="dept-stat">
                      <span className="label">Total Students:</span>
                      <span className="value">{dept.student_count}</span>
                    </div>
                    {/* Year breakdown for each department */}
                    {dept.years && (
                      <div className="year-breakdown">
                        <h5>Year-wise Distribution:</h5>
                        {Object.entries(dept.years).map(([year, count]) => (
                          <div key={year} className="year-stat">
                            <span>Year {year}:</span>
                            <span>{count} students</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="dept-stat">
                      <span className="label">Percentage:</span>
                      <span className="value">
                        {stats.total_students > 0 ? 
                          Math.round((dept.student_count / stats.total_students) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'years' && (
          <div className="years-analysis">
            <h3>Year-wise Student Analysis</h3>
            <div className="years-grid">
              {[1, 2, 3, 4, 5].map(year => (
                <div key={year} className="year-analysis-card">
                  <h4>Year {year}</h4>
                  <div className="year-total">{yearStats[year] || 0} Students</div>
                  <div className="department-breakdown">
                    <h5>By Department:</h5>
                    {stats.departments.map(dept => (
                      <div key={dept.id} className="dept-year-stat">
                        <span>{dept.name}:</span>
                        <span>{dept.years?.[year] || 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;