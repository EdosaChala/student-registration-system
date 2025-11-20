from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register('users', views.UserViewSet)
router.register('user-roles', views.UserRoleViewSet)
router.register('departments', views.DepartmentViewSet)
router.register('academic-programs', views.AcademicProgramViewSet)
router.register('academic-years', views.AcademicYearViewSet)
router.register('students', views.StudentViewSet)
router.register('courses', views.CourseViewSet)
router.register('semesters', views.SemesterViewSet)
router.register('registrations', views.RegistrationViewSet)
router.register('grades', views.GradeViewSet)
router.register('course-slips', views.CourseSlipViewSet)

urlpatterns = [
    path('api/', include(router.urls)),
    
    # CSRF Endpoints - ADD THESE
    path('api/csrf-token/', views.get_csrf_token, name='get_csrf_token'),
    path('api/csrf/', views.CSRFTokenView.as_view(), name='csrf_token'),
    path('api/csrf-debug/', views.csrf_debug, name='csrf_debug'),
    
    # Existing endpoints...
    path('api/login/', views.login_view, name='login'),
    path('api/logout/', views.logout_view, name='logout'),
    path('api/register-student/', views.register_student, name='register-student'),
    path('api/academic-year-registration-status/', views.academic_year_registration_status, name='academic-year-registration-status'),
    path('api/assign-courses-to-student/', views.assign_courses_to_student, name='assign-courses-to-student'),
    
    # Registrar endpoints
    path('api/registrar/all-student-grades/', views.get_all_student_grades, name='all-student-grades'),
    path('api/registrar/student-academic-records/', views.get_student_academic_records, name='student-academic-records'),
    path('api/registrar/department-grade-statistics/', views.get_department_grade_statistics, name='department-grade-statistics'),
    
    # Course slip endpoints
    path('api/auto-assign-department-courses/', views.auto_assign_department_courses, name='auto-assign-department-courses'),
    path('api/create-student-course-slip/', views.create_student_course_slip, name='create-student-course-slip'),
   
    path('api/get-all-course-slips/', views.get_all_course_slips, name='get-all-course-slips'),
    path('api/students-without-course-slips/', views.get_students_without_course_slips, name='students-without-course-slips'),
    path('api/debug/auth-status/', views.debug_auth_status, name='debug_auth_status'),
    path('api/debug/student-test/', views.debug_student_test, name='debug_student_test'),
    # Student course slip endpoints
    path('api/student/course-slip/', views.get_student_course_slip, name='student_course_slip'),
    path('api/debug-student-course-data/', views.debug_student_course_data, name='debug-student-data'),

    # Instructor endpoints
    path('api/test/create-course-slip/', views.create_test_course_slip, name='test-create-course-slip'),
    path('api/instructor/courses/', views.instructor_courses, name='instructor-courses'),
]