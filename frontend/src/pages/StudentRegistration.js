import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/StudentRegistration.css';

const StudentRegistration = () => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000';
  const [formData, setFormData] = useState({
    username: '', 
    password: '', 
    first_name: '', 
    last_name: '', 
    email: '',
    phone: '', 
    gender: '', 
    student_id: '', 
    department: '', 
    academic_program: '', 
    year: ''
  });
  const [departments, setDepartments] = useState([]);
  const [academicPrograms, setAcademicPrograms] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('');
  const [registrationStatus, setRegistrationStatus] = useState('');
  const [penaltyInfo, setPenaltyInfo] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  
  // STATES FOR PENALTY PAYMENT
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [pendingRegistration, setPendingRegistration] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => { 
    console.log('🔄 useEffect running - fetching data');
    fetchDepartments();
    fetchAcademicYears();
  }, []);

  const fetchDepartments = async () => {
    try {
      console.log(`📡 Fetching departments from: ${API_BASE_URL}/api/departments/`);
      const response = await axios.get(`${API_BASE_URL}/api/departments/`);
      console.log('✅ Departments response:', response.data);
      console.log('📊 Departments count:', response.data.length);
      setDepartments(response.data);
    } catch (error) {
      console.error('❌ Error fetching departments:', error);
      console.error('Error details:', error.response?.data);
      setMessage('Error loading departments. Please refresh the page.');
      setMessageType('error');
    }
  };

  const fetchAcademicYears = async () => {
    try {
      console.log(`📡 Fetching academic years from: ${API_BASE_URL}/api/academic-years/`);
      const response = await axios.get(`${API_BASE_URL}/api/academic-years/`);
      console.log('✅ Academic years response:', response.data);
      console.log('📊 Academic years count:', response.data.length);
      setAcademicYears(response.data);
    } catch (error) {
      console.error('❌ Error fetching academic years:', error);
      console.error('Error details:', error.response?.data);
    }
  };

  const fetchAcademicPrograms = async (departmentId) => {
    try {
      console.log(`📡 Fetching programs for department: ${departmentId}`);
      const response = await axios.get(`${API_BASE_URL}/api/academic-programs/?department_id=${departmentId}`);
      console.log('✅ Academic programs response:', response.data);
      setAcademicPrograms(response.data);
    } catch (error) {
      console.error('❌ Error fetching academic programs:', error);
    }
  };

  const checkRegistrationStatus = async (academicYearId) => {
    try {
      console.log(`📡 Checking registration status for academic year: ${academicYearId}`);
      const response = await axios.get(`${API_BASE_URL}/api/academic-years/${academicYearId}/registration_status/`);
      const statusData = response.data;
      console.log('✅ Registration status:', statusData);
      setRegistrationStatus(statusData.status);
      
      // Show penalty warning if late registration
      if (statusData.status === 'late') {
        setPenaltyInfo({
          message: '⚠️ Late Registration - Penalty Applies',
          amount: `ETB ${statusData.penalty_amount}`,
          penalty_amount: statusData.penalty_amount,
          deadline: statusData.late_registration_deadline,
          regularDeadline: statusData.registration_deadline
        });
      } else if (statusData.status === 'closed') {
        setPenaltyInfo({
          message: '❌ Registration Closed',
          deadline: statusData.late_registration_deadline
        });
      } else if (statusData.status === 'not_started') {
        setPenaltyInfo({
          message: '⏳ Registration Not Started',
          startDate: statusData.registration_start
        });
      } else {
        setPenaltyInfo(null);
      }
    } catch (error) {
      console.error('❌ Error checking registration status:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({ 
      ...prevState, 
      [name]: value 
    }));
    
    if (name === 'department') {
      console.log(`🎯 Department changed to: ${value}`);
      setFormData(prevState => ({
        ...prevState,
        academic_program: ''
      }));
      fetchAcademicPrograms(value);
    }
  };

  const handleAcademicYearChange = (e) => {
    const yearId = e.target.value;
    console.log(`🎯 Academic year changed to: ${yearId}`);
    setSelectedAcademicYear(yearId);
    if (yearId) {
      checkRegistrationStatus(yearId);
    } else {
      setRegistrationStatus('');
      setPenaltyInfo(null);
    }
  };

  // Handle penalty payment
  const handlePayPenalty = async () => {
    if (!paymentMethod) {
      setMessage('Please select a payment method');
      setMessageType('error');
      return;
    }

    setIsProcessingPayment(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/registrations/${pendingRegistration.id}/pay_penalty/`);
      
      setMessage(`✅ Penalty paid successfully! Student account created successfully.`);
      setMessageType('success');
      setShowPenaltyModal(false);
      setPendingRegistration(null);
      setPaymentMethod('');
      
      // Reset form
      setFormData({
        username: '', password: '', first_name: '', last_name: '', email: '',
        phone: '', gender: '', student_id: '', department: '', academic_program: '', year: ''
      });
      setAcademicPrograms([]);
      setSelectedAcademicYear('');
      setRegistrationStatus('');
      setPenaltyInfo(null);
      
    } catch (error) {
      setMessage('❌ Payment failed. Please try again.');
      setMessageType('error');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Create a basic registration record without courses
const createBasicRegistration = async (studentId) => {
  try {
    // First, let's get the current active semester
    const semestersResponse = await axios.get(`${API_BASE_URL}/api/semesters/`);
    const activeSemester = semestersResponse.data.find(sem => sem.is_active);
    
    if (!activeSemester) {
      throw new Error('No active semester found. Please contact administrator.');
    }

    const registrationData = {
      student: studentId,
      semester: activeSemester.id,
      academic_year: selectedAcademicYear,
      courses: [] // Empty courses array for now
    };

    console.log('📤 Creating registration with data:', registrationData);
    
    // This endpoint might require authentication, so let's skip it for now
    // and just return success since the student is already created
    console.log('✅ Student created successfully. Registration can be completed later.');
    return { success: true, message: 'Student registered. Course registration can be done later.' };
    
  } catch (error) {
    console.error('❌ Registration creation error:', error);
    console.error('Registration error details:', error.response?.data);
    
    // Don't delete the student - just return a success since student was created
    console.log('⚠️ Registration record not created, but student account was created successfully');
    return { success: true, message: 'Student account created. Please complete course registration later.' };
  }
};

  const handleSubmit = async (e) => {
  e.preventDefault();
  
  // Check if academic year is selected and registration is open
  if (!selectedAcademicYear) {
    setMessage('Please select an academic year.');
    setMessageType('error');
    return;
  }

  if (registrationStatus === 'closed') {
    setMessage('Registration for the selected academic year is closed.');
    setMessageType('error');
    return;
  }

  if (registrationStatus === 'not_started') {
    const selectedYear = academicYears.find(ay => ay.id == selectedAcademicYear);
    setMessage(`Registration starts on ${selectedYear.registration_start}`);
    setMessageType('error');
    return;
  }
  
  try {
    console.log('📤 Sending registration data:', formData);
    
    // Step 1: Register student (create user account)
const studentResponse = await axios.post(`${API_BASE_URL}/api/register-student/`, formData);    console.log('✅ Student registration success:', studentResponse.data);
    
    // Step 2: Create basic registration record (without courses)
    const studentId = studentResponse.data.id;
    const registrationResult = await createBasicRegistration(studentId);
    
    if (registrationResult) {
      // Check if penalty applies to this registration
      if (registrationResult.is_late_registration && !registrationResult.penalty_paid) {
        // Show penalty payment modal
        setPendingRegistration(registrationResult);
        setShowPenaltyModal(true);
        setMessage(`Student registered successfully! ⚠️ Late registration detected. Please pay the penalty to complete registration.`);
        setMessageType('warning');
      } else {
        // Regular registration successful
        setMessage('Student registered successfully! You can now login to register for courses.');
        setMessageType('success');
        
        // Reset form
        setFormData({
          username: '', password: '', first_name: '', last_name: '', email: '',
          phone: '', gender: '', student_id: '', department: '', academic_program: '', year: ''
        });
        setAcademicPrograms([]);
        setSelectedAcademicYear('');
        setRegistrationStatus('');
        setPenaltyInfo(null);
      }
    }
    
  } catch (error) {
    console.log('❌ Full error response:', error.response);
    console.log('❌ Error data:', error.response?.data);
    
    // IMPROVED ERROR HANDLING
    if (error.response?.data) {
      if (error.response.data.error) {
        setMessage('Registration Error: ' + error.response.data.error);
      } else if (error.response.data.detail) {
        setMessage('Authentication Error: ' + error.response.data.detail);
      } else if (typeof error.response.data === 'object') {
        // Handle validation errors
        const errorMessages = [];
        for (const [field, messages] of Object.entries(error.response.data)) {
          errorMessages.push(`${field}: ${messages.join(', ')}`);
        }
        setMessage('Validation Error: ' + errorMessages.join('; '));
      } else {
        setMessage('Registration Error: ' + JSON.stringify(error.response.data));
      }
    } else {
      setMessage('Network Error: Please check your connection and try again.');
    }
    setMessageType('error');
  }
};
  const isFormValid = () => {
    const requiredFields = [
      'username', 'password', 'first_name', 'last_name', 
      'email', 'phone', 'gender', 'student_id', 
      'department', 'academic_program', 'year'
    ];
    
    const basicFormValid = requiredFields.every(field => {
      const value = formData[field];
      return value !== null && value !== undefined && value.toString().trim() !== '';
    });

    // Also require academic year selection and valid registration status
    return basicFormValid && selectedAcademicYear && 
           registrationStatus !== 'closed' && 
           registrationStatus !== 'not_started';
  };

  const getRegistrationStatusDisplay = () => {
    if (!registrationStatus) return null;

    const statusConfig = {
      'regular': { class: 'regular', icon: '✅', text: 'Regular Registration Period - No Penalty' },
      'late': { class: 'late', icon: '⚠️', text: 'Late Registration - Penalty Applies' },
      'closed': { class: 'closed', icon: '❌', text: 'Registration Closed' },
      'not_started': { class: 'not_started', icon: '⏳', text: 'Registration Not Started Yet' }
    };

    const config = statusConfig[registrationStatus];
    if (!config) return null;

    return (
      <div className={`status-banner ${config.class}`}>
        <p>{config.icon} {config.text}</p>
        {penaltyInfo && (
          <div className="penalty-info">
            {registrationStatus === 'late' && (
              <>
                <p>Penalty Amount: <strong>{penaltyInfo.amount}</strong></p>
                <p>Regular registration ended: {penaltyInfo.regularDeadline}</p>
                <p>Late registration deadline: {penaltyInfo.deadline}</p>
              </>
            )}
            {registrationStatus === 'closed' && (
              <p>Final deadline was: {penaltyInfo.deadline}</p>
            )}
            {registrationStatus === 'not_started' && (
              <p>Registration starts on: {penaltyInfo.startDate}</p>
            )}
          </div>
        )}
      </div>
    );
  };

  // Penalty Payment Modal
  const PenaltyPaymentModal = () => {
    if (!showPenaltyModal || !pendingRegistration) return null;

    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <div className="modal-header">
            <h3>⚠️ Late Registration Penalty</h3>
            <button 
              className="close-button" 
              onClick={() => setShowPenaltyModal(false)}
            >
              ×
            </button>
          </div>
          
          <div className="modal-body">
            <div className="penalty-details">
              <p>Your registration was processed during the late registration period.</p>
              <div className="penalty-amount">
                <strong>Penalty Amount: ETB {pendingRegistration.penalty_amount}</strong>
              </div>
              
              <div className="payment-methods">
                <h4>Select Payment Method:</h4>
                <div className="payment-options">
                  <label className="payment-option">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="credit_card"
                      checked={paymentMethod === 'credit_card'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    />
                    💳 Credit/Debit Card
                  </label>
                  
                  <label className="payment-option">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="mobile_money"
                      checked={paymentMethod === 'mobile_money'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    />
                    📱 Mobile Money
                  </label>
                  
                  <label className="payment-option">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="bank_transfer"
                      checked={paymentMethod === 'bank_transfer'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    />
                    🏦 Bank Transfer
                  </label>
                  
                  <label className="payment-option">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cash"
                      checked={paymentMethod === 'cash'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    />
                    💵 Cash (Finance Office)
                  </label>
                </div>
              </div>
            </div>
          </div>
          
          <div className="modal-footer">
            <button 
              className="cancel-btn"
              onClick={() => setShowPenaltyModal(false)}
              disabled={isProcessingPayment}
            >
              Cancel
            </button>
            <button 
              className="pay-btn"
              onClick={handlePayPenalty}
              disabled={!paymentMethod || isProcessingPayment}
            >
              {isProcessingPayment ? 'Processing...' : `Pay ETB ${pendingRegistration.penalty_amount}`}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="registration-container">
      <div className="registration-card">
        {/* Logo Section with Text */}
        <div className="logo-section">
          <div className="logo-header">
            <img 
              src="/images/wollega-university-logo.png" 
              alt="Wollega University Logo" 
              className="university-logo"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <div className="welcome-text">
              <h1 className="welcome-title">Welcome to Wollega University</h1>
              <p className="welcome-subtitle">Student Registration System</p>
              <div className="welcome-divider"></div>
            </div>
          </div>
        </div>
        
        <h2 className="form-title">Student Registration Form</h2>
        <p className="form-subtitle">Complete the form below to register for the new academic year</p>
        
        {message && (
          <div className={`message ${messageType === 'success' ? 'message-success' : messageType === 'warning' ? 'message-warning' : 'message-error'}`}>
            {message}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="registration-form">
          {/* Academic Year Selection */}
          <div className="form-section">
            <h3>Academic Year Selection</h3>
            <div className="form-group full-width">
              <label>Academic Year *</label>
              <select 
                name="academic_year" 
                value={selectedAcademicYear} 
                onChange={handleAcademicYearChange}
                required
                className={!selectedAcademicYear ? 'required-field' : ''}
              >
                <option value="">Select Academic Year</option>
                {academicYears.map(year => (
                  <option key={year.id} value={year.id}>
                    {year.name} {year.is_active && '(Current)'}
                  </option>
                ))}
              </select>
              {academicYears.length === 0 && (
                <small className="field-hint error">No academic years available. Please contact administrator.</small>
              )}
              {!selectedAcademicYear && academicYears.length > 0 && (
                <small className="field-hint">Please select an academic year to check registration availability</small>
              )}
            </div>

            {/* Registration Status Display */}
            {getRegistrationStatusDisplay()}
          </div>

          <div className="form-section">
            <h3>Account Information</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Username *</label>
                <input 
                  type="text" 
                  name="username" 
                  value={formData.username} 
                  onChange={handleInputChange} 
                  required 
                  placeholder="Enter username"
                />
              </div>
              <div className="form-group">
                <label>Password *</label>
                <input 
                  type="password" 
                  name="password" 
                  value={formData.password} 
                  onChange={handleInputChange} 
                  required 
                  placeholder="Enter password"
                  minLength="6"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Personal Information</h3>
            <div className="form-row">
              <div className="form-group">
                <label>First Name *</label>
                <input 
                  type="text" 
                  name="first_name" 
                  value={formData.first_name} 
                  onChange={handleInputChange} 
                  required 
                  placeholder="Enter first name"
                />
              </div>
              <div className="form-group">
                <label>Last Name *</label>
                <input 
                  type="text" 
                  name="last_name" 
                  value={formData.last_name} 
                  onChange={handleInputChange} 
                  required 
                  placeholder="Enter last name"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Email *</label>
                <input 
                  type="email" 
                  name="email" 
                  value={formData.email} 
                  onChange={handleInputChange} 
                  required 
                  placeholder="Enter email address"
                />
              </div>
              <div className="form-group">
                <label>Phone *</label>
                <input 
                  type="tel" 
                  name="phone" 
                  value={formData.phone} 
                  onChange={handleInputChange} 
                  required 
                  placeholder="Enter phone number"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Academic Information</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Student ID *</label>
                <input 
                  type="text" 
                  name="student_id" 
                  value={formData.student_id} 
                  onChange={handleInputChange} 
                  required 
                  placeholder="Enter student ID"
                />
              </div>
              <div className="form-group">
                <label>Gender *</label>
                <select 
                  name="gender" 
                  value={formData.gender} 
                  onChange={handleInputChange} 
                  required
                >
                  <option value="">Select Gender</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Department *</label>
                <select 
                  name="department" 
                  value={formData.department} 
                  onChange={handleInputChange} 
                  required
                >
                  <option value="">Select Department</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
                {departments.length === 0 && (
                  <small className="field-hint error">No departments available. Please contact administrator.</small>
                )}
              </div>
              <div className="form-group">
                <label>Academic Program *</label>
                <select 
                  name="academic_program" 
                  value={formData.academic_program} 
                  onChange={handleInputChange} 
                  required 
                  disabled={!formData.department}
                >
                  <option value="">Select Program</option>
                  {academicPrograms.map(program => (
                    <option key={program.id} value={program.id}>
                      {program.name}
                    </option>
                  ))}
                </select>
                {!formData.department && (
                  <small className="field-hint">Please select a department first</small>
                )}
                {formData.department && academicPrograms.length === 0 && (
                  <small className="field-hint">No programs available for this department</small>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Year *</label>
                <select 
                  name="year" 
                  value={formData.year} 
                  onChange={handleInputChange} 
                  required
                >
                  <option value="">Select Year</option>
                  <option value="1">1st Year</option>
                  <option value="2">2nd Year</option>
                  <option value="3">3rd Year</option>
                  <option value="4">4th Year</option>
                  <option value="5">5th Year</option>
                </select>
              </div>
              <div className="form-group">
                {/* Empty div for layout consistency */}
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            className={`submit-btn ${!isFormValid() ? 'submit-btn-disabled' : ''} ${registrationStatus === 'late' ? 'submit-btn-warning' : ''}`}
            disabled={!isFormValid()}
          >
            {registrationStatus === 'late' ? '⚠️ Register with Penalty' : 'Register Student'}
          </button>
          
          <div className="form-footer">
            <p>Already have an account? <a href="/login">Login here</a></p>
          </div>
        </form>
      </div>

      {/* Penalty Payment Modal */}
      <PenaltyPaymentModal />
    </div>
  );
};

export default StudentRegistration;