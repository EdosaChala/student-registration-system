from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, BasePermission, AllowAny
from django.db.models import Q, Count, Avg
from rest_framework.views import APIView 
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.utils import timezone
from .models import *
from .serializers import *
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator

# Custom Permissions
class IsDepartmentHead(BasePermission):
    def has_permission(self, request, view):
        return hasattr(request.user, 'userrole') and request.user.userrole.role == 'department_head'

class IsRegistrar(BasePermission):
    def has_permission(self, request, view):
        return hasattr(request.user, 'userrole') and request.user.userrole.role == 'registrar'

class IsAdministrator(BasePermission):
    def has_permission(self, request, view):
        return hasattr(request.user, 'userrole') and request.user.userrole.role == 'administrator'

class IsStudent(BasePermission):
    def has_permission(self, request, view):
        return hasattr(request.user, 'userrole') and request.user.userrole.role == 'student'

class IsInstructor(BasePermission):
    def has_permission(self, request, view):
        return hasattr(request.user, 'userrole') and request.user.userrole.role == 'instructor'

# Helper Functions
def get_academic_status(cgpa):
    """Helper function to determine academic status based on CGPA"""
    if cgpa >= 3.6:
        return 'Excellent'
    elif cgpa >= 3.0:
        return 'Very Good'
    elif cgpa >= 2.5:
        return 'Good'
    elif cgpa >= 2.0:
        return 'Satisfactory'
    else:
        return 'Needs Improvement'

# API Views
@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get('username')
    password = request.data.get('password')
    
    if not username:
        return Response({'error': 'Username is required'}, status=400)
    
    if not password:
        return Response({'error': 'Password is required'}, status=400)
    
    user = authenticate(request, username=username, password=password)
    
    if user is not None:
        if user.is_active:
            login(request, user)
            
            role_info = None
            try:
                if hasattr(user, 'userrole'):
                    role_info = {
                        'role': user.userrole.role,
                        'department': user.userrole.department.name if user.userrole.department else None,
                        'department_id': user.userrole.department.id if user.userrole.department else None
                    }
            except Exception:
                pass
            
            return Response({
                'message': 'Login successful',
                'user': {
                    'id': user.id, 
                    'username': user.username, 
                    'email': user.email, 
                    'first_name': user.first_name,
                    'last_name': user.last_name
                },
                'role': role_info
            })
        else:
            return Response({'error': 'User account is inactive'}, status=400)
    else:
        user_exists = User.objects.filter(username=username).exists()
        if user_exists:
            return Response({'error': 'Invalid password'}, status=400)
        else:
            return Response({'error': 'User does not exist'}, status=400)

@api_view(['POST'])
@permission_classes([AllowAny])
def logout_view(request):
    logout(request)
    return Response({'message': 'Logout successful'})

@api_view(['POST'])
@permission_classes([AllowAny])
def register_student(request):
    from django.contrib.auth.models import User
    data = request.data
    
    try:
        if User.objects.filter(username=data['username']).exists():
            return Response({'error': 'Username already exists'}, status=400)
        
        if User.objects.filter(email=data['email']).exists():
            return Response({'error': 'Email already exists'}, status=400)
        
        if Student.objects.filter(student_id=data['student_id']).exists():
            return Response({'error': 'Student ID already exists'}, status=400)
        
        user = User.objects.create_user(
            username=data['username'],
            password=data['password'],
            email=data['email'],
            first_name=data['first_name'],
            last_name=data['last_name']
        )
        
        UserRole.objects.create(
            user=user,
            role='student',
            department_id=data['department']
        )
        
        student = Student.objects.create(
            user=user,
            student_id=data['student_id'],
            first_name=data['first_name'],
            last_name=data['last_name'],
            email=data['email'],
            phone=data['phone'],
            gender=data['gender'],
            department_id=data['department'],
            academic_program_id=data['academic_program'],
            year=int(data['year'])
        )
        
        return Response(StudentSerializer(student).data, status=201)
        
    except KeyError as e:
        return Response({'error': f'Missing field: {str(e)}'}, status=400)
    except Exception as e:
        return Response({'error': str(e)}, status=400)

class UserViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.all().order_by('username')
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return User.objects.all().order_by('username')
        else:
            return User.objects.filter(id=user.id)

# ViewSets
class UserRoleViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]
    queryset = UserRole.objects.all()
    serializer_class = UserRoleSerializer

class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [AllowAny]
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        departments = Department.objects.annotate(student_count=Count('student'))
        total_students = Student.objects.count()
        total_courses = Course.objects.count()
        
        data = {
            'departments': DepartmentStatsSerializer(departments, many=True).data,
            'total_students': total_students,
            'total_courses': total_courses
        }
        return Response(data)

class AcademicProgramViewSet(viewsets.ModelViewSet):
    queryset = AcademicProgram.objects.all()
    serializer_class = AcademicProgramSerializer
    permission_classes = [AllowAny]
    
    def get_queryset(self):
        queryset = AcademicProgram.objects.all()
        department_id = self.request.query_params.get('department_id')
        if department_id:
            queryset = queryset.filter(department_id=department_id)
        return queryset

class AcademicYearViewSet(viewsets.ModelViewSet):
    queryset = AcademicYear.objects.all()
    serializer_class = AcademicYearSerializer
    permission_classes = [AllowAny]
    
    @action(detail=True, methods=['get'])
    def registration_status(self, request, pk=None):
        academic_year = self.get_object()
        status = academic_year.get_registration_status()
        
        return Response({
            'academic_year': academic_year.name,
            'status': status,
            'registration_start': academic_year.registration_start,
            'registration_deadline': academic_year.registration_deadline,
            'late_registration_deadline': academic_year.late_registration_deadline,
            'current_date': timezone.now().date(),
            'penalty_amount': self.get_penalty_amount(academic_year)
        })
    
    def get_penalty_amount(self, academic_year):
        penalty = RegistrationPenalty.objects.filter(
            academic_year=academic_year,
            is_active=True
        ).first()
        return penalty.penalty_amount if penalty else 500.00

class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.all()
    serializer_class = StudentSerializer
    permission_classes = [AllowAny]
    
    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'userrole'):
            if user.userrole.role == 'student':
                return Student.objects.filter(user=user)
            elif user.userrole.role == 'department_head':
                return Student.objects.filter(department=user.userrole.department)
            elif user.userrole.role == 'instructor':
                return Student.objects.filter(department=user.userrole.department)
            elif user.userrole.role == 'registrar':
                return Student.objects.all()
            elif user.userrole.role == 'administrator':
                return Student.objects.all()
        return Student.objects.all()
    
    @action(detail=True, methods=['get'], permission_classes=[IsDepartmentHead])
    def cgpa(self, request, pk=None):
        student = self.get_object()
        
        if student.department != request.user.userrole.department:
            return Response({'error': 'You can only view students in your department'}, status=403)
        
        published_grades = Grade.objects.filter(
            student=student,
            is_published=True,
            course__department=student.department
        )
        
        if published_grades.exists():
            cgpa = published_grades.aggregate(
                avg_grade=Avg('grade_point')
            )['avg_grade'] or 0.0
            
            total_credits = sum(grade.course.credits for grade in published_grades if hasattr(grade.course, 'credits'))
            total_courses = published_grades.count()
            
            return Response({
                'student_id': student.student_id,
                'student_name': f"{student.first_name} {student.last_name}",
                'department': student.department.name,
                'cgpa': round(cgpa, 2),
                'total_credits': total_credits,
                'total_courses': total_courses,
                'grades_breakdown': [
                    {
                        'course_code': grade.course.code,
                        'course_name': grade.course.name,
                        'grade': grade.grade,
                        'grade_point': grade.grade_point,
                        'credits': grade.course.credits if hasattr(grade.course, 'credits') else 0,
                        'semester': grade.semester.name if grade.semester else 'N/A',
                        'instructor': f"{grade.course.instructor.first_name} {grade.course.instructor.last_name}" if grade.course.instructor else 'N/A'
                    }
                    for grade in published_grades
                ]
            })
        else:
            return Response({
                'student_id': student.student_id,
                'student_name': f"{student.first_name} {student.last_name}",
                'department': student.department.name,
                'cgpa': 0.0,
                'total_credits': 0,
                'total_courses': 0,
                'message': 'No published grades available for courses in your department'
            })

class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [AllowAny]
    
    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'userrole'):
            if user.userrole.role == 'instructor':
                return Course.objects.filter(instructor=user)
            elif user.userrole.role == 'department_head':
                return Course.objects.filter(department=user.userrole.department)
        return Course.objects.all()

class SemesterViewSet(viewsets.ModelViewSet):
    queryset = Semester.objects.all()
    serializer_class = SemesterSerializer
    permission_classes = [AllowAny]

class RegistrationViewSet(viewsets.ModelViewSet):
    queryset = Registration.objects.all()
    serializer_class = RegistrationSerializer
    permission_classes = [AllowAny]
    
    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'userrole'):
            if user.userrole.role == 'student':
                try:
                    student = Student.objects.get(user=user)
                    return Registration.objects.filter(student=student)
                except Student.DoesNotExist:
                    return Registration.objects.none()
            elif user.userrole.role == 'department_head':
                return Registration.objects.filter(student__department=user.userrole.department)
            elif user.userrole.role == 'instructor':
                return Registration.objects.filter(student__department=user.userrole.department)
            elif user.userrole.role == 'registrar':
                return Registration.objects.all()
            elif user.userrole.role == 'administrator':
                return Registration.objects.all()
        return Registration.objects.all()
    
    def get_permissions(self):
        if self.action == 'approve_registration':
            permission_classes = [IsAuthenticated, IsRegistrar]
        else:
            permission_classes = [AllowAny]
        return [permission() for permission in permission_classes]
    
    @action(detail=True, methods=['post'], permission_classes=[IsRegistrar])
    def approve_registration(self, request, pk=None):
        registration = self.get_object()
        registration.is_approved = True
        registration.approved_by = request.user
        registration.save()
        return Response({'message': 'Registration approved successfully'})
    
    @action(detail=True, methods=['post'])
    def pay_penalty(self, request, pk=None):
        registration = self.get_object()
        
        if not registration.is_late_registration:
            return Response({'error': 'No penalty for this registration'}, status=400)
        
        if registration.penalty_paid:
            return Response({'error': 'Penalty already paid'}, status=400)
        
        registration.penalty_paid = True
        registration.is_approved = True
        registration.save()
        
        return Response({
            'message': 'Penalty paid successfully. Registration is now approved.',
            'registration': RegistrationSerializer(registration).data
        })

class GradeViewSet(viewsets.ModelViewSet):
    queryset = Grade.objects.all()
    serializer_class = GradeSerializer
    permission_classes = [AllowAny]
    
    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        
        if request.user.is_authenticated:
            data['entered_by'] = request.user.id
        
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=201, headers=headers)
    
    def perform_create(self, serializer):
        if self.request.user.is_authenticated:
            serializer.save(entered_by=self.request.user)
        else:
            serializer.save()
    
    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'userrole'):
            if user.userrole.role == 'student':
                student = Student.objects.get(user=user)
                return Grade.objects.filter(student=student, is_published=True)
            elif user.userrole.role == 'instructor':
                courses = Course.objects.filter(instructor=user)
                return Grade.objects.filter(course__in=courses)
            elif user.userrole.role == 'department_head':
                courses = Course.objects.filter(department=user.userrole.department)
                return Grade.objects.filter(course__in=courses)
        return Grade.objects.all()
    
    @action(detail=False, methods=['post'], permission_classes=[IsInstructor])
    def enter_grade(self, request):
        serializer = GradeEntrySerializer(data=request.data)
        if serializer.is_valid():
            course = serializer.validated_data['course']
            
            if course.instructor != request.user:
                return Response({'error': 'You can only enter grades for your own courses'}, status=403)
            
            student = serializer.validated_data['student']
            existing_grade = Grade.objects.filter(
                student=student,
                course=course
            ).first()
            
            if existing_grade:
                return Response({
                    'error': f'Grade already exists for {student.first_name} {student.last_name} in {course.name}',
                    'existing_grade': GradeSerializer(existing_grade).data
                }, status=400)
            
            grade = serializer.save(entered_by=request.user, is_published=False)
            return Response({
                'message': 'Grade entered successfully',
                'grade': GradeSerializer(grade).data
            }, status=201)
        return Response(serializer.errors, status=400)
    
    @action(detail=True, methods=['post'], permission_classes=[IsInstructor])
    def publish_grade(self, request, pk=None):
        grade = self.get_object()
        
        if grade.course.instructor != request.user:
            return Response({'error': 'You can only publish grades for your own courses'}, status=403)
        
        grade.is_published = True
        grade.published_by = request.user
        grade.save()
        
        return Response({
            'message': 'Grade published successfully',
            'grade': GradeSerializer(grade).data
        })
    
    @action(detail=False, methods=['get'], permission_classes=[IsDepartmentHead])
    def department_grades(self, request):
        user = request.user
        
        if not hasattr(user, 'userrole') or user.userrole.role != 'department_head':
            return Response({'error': 'Access denied'}, status=403)
        
        department = user.userrole.department
        
        department_grades = Grade.objects.filter(
            course__department=department
        ).select_related('student', 'course', 'semester')
        
        return Response({
            'department': department.name,
            'total_grades': department_grades.count(),
            'published_grades': department_grades.filter(is_published=True).count(),
            'unpublished_grades': department_grades.filter(is_published=False).count(),
            'grades': GradeSerializer(department_grades, many=True).data
        })
    
    @action(detail=False, methods=['get'], permission_classes=[IsDepartmentHead])
    def department_statistics(self, request):
        user = request.user
        
        if not hasattr(user, 'userrole') or user.userrole.role != 'department_head':
            return Response({'error': 'Access denied'}, status=403)
        
        department = user.userrole.department
        
        department_students = Student.objects.filter(department=department)
        
        statistics = []
        for student in department_students:
            published_grades = Grade.objects.filter(
                student=student,
                is_published=True,
                course__department=department
            )
            
            if published_grades.exists():
                cgpa = published_grades.aggregate(
                    avg_grade=Avg('grade_point')
                )['avg_grade'] or 0.0
                
                total_credits = sum(grade.course.credits for grade in published_grades if hasattr(grade.course, 'credits'))
                total_courses = published_grades.count()
                
                statistics.append({
                    'student_id': student.student_id,
                    'student_name': f"{student.first_name} {student.last_name}",
                    'year': student.year,
                    'cgpa': round(cgpa, 2),
                    'total_credits': total_credits,
                    'total_courses': total_courses,
                    'academic_status': get_academic_status(round(cgpa, 2))
                })
            else:
                statistics.append({
                    'student_id': student.student_id,
                    'student_name': f"{student.first_name} {student.last_name}",
                    'year': student.year,
                    'cgpa': 0.0,
                    'total_credits': 0,
                    'total_courses': 0,
                    'academic_status': 'No grades available'
                })
        
        if statistics:
            students_with_grades = [s for s in statistics if s['total_courses'] > 0]
            if students_with_grades:
                avg_cgpa = sum(s['cgpa'] for s in students_with_grades) / len(students_with_grades)
            else:
                avg_cgpa = 0.0
            total_students = len(statistics)
        else:
            avg_cgpa = 0.0
            total_students = 0
            students_with_grades = []
        
        return Response({
            'department': department.name,
            'total_students': total_students,
            'students_with_grades': len(students_with_grades),
            'average_cgpa': round(avg_cgpa, 2),
            'student_statistics': statistics
        })

# Additional API views
@api_view(['GET'])
@permission_classes([AllowAny])
def academic_year_registration_status(request):
    academic_years = AcademicYear.objects.all()
    data = []
    
    for ay in academic_years:
        status = ay.get_registration_status()
        penalty = RegistrationPenalty.objects.filter(academic_year=ay, is_active=True).first()
        
        data.append({
            'id': ay.id,
            'name': ay.name,
            'status': status,
            'registration_start': ay.registration_start,
            'registration_deadline': ay.registration_deadline,
            'late_registration_deadline': ay.late_registration_deadline,
            'penalty_amount': penalty.penalty_amount if penalty else 500.00,
            'is_active': ay.is_active
        })
    
    return Response(data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def assign_courses_to_student(request):
    if not hasattr(request.user, 'userrole'):
        return Response({
            'success': False,
            'message': 'User role not found. Please login again.'
        }, status=403)

    user_role = request.user.userrole.role
    allowed_roles = ['registrar', 'administrator', 'department_head']
    
    if user_role not in allowed_roles:
        return Response({
            'success': False,
            'message': f'Permission denied. Only {", ".join(allowed_roles)} can assign courses. Your role: {user_role}'
        }, status=403)

    student_id = request.data.get('student_id')
    course_ids = request.data.get('course_ids', [])
    semester_id = request.data.get('semester_id')
    
    if not student_id or not course_ids or not semester_id:
        return Response({
            'success': False,
            'message': 'Student ID, course IDs, and semester ID are required.'
        }, status=400)
    
    try:
        student = Student.objects.get(id=student_id)
        semester = Semester.objects.get(id=semester_id)
        
        # Filter courses by student's department
        valid_courses = Course.objects.filter(
            id__in=course_ids,
            department=student.department
        )
        
        if len(valid_courses) != len(course_ids):
            invalid_courses = set(course_ids) - set(valid_courses.values_list('id', flat=True))
            return Response({
                'success': False,
                'message': f'{len(invalid_courses)} course(s) not available for student\'s department',
                'invalid_courses': list(invalid_courses)
            }, status=400)
        
        # Create CourseSlip instead of Registration
        course_slip, created = CourseSlip.objects.get_or_create(
            student=student,
            semester=semester,
            academic_year=semester.academic_year,
            defaults={
                'assigned_by': request.user,
                'is_approved': True
            }
        )
        
        course_slip.courses.set(valid_courses)
        
        action = 'created' if created else 'updated'
        
        return Response({
            'success': True,
            'message': f'Course slip {action} successfully for {student.first_name} {student.last_name}',
            'course_slip_id': course_slip.id,
            'action': action,
            'courses_assigned': len(valid_courses)
        })
        
    except Student.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Student not found.'
        }, status=404)
    except Semester.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Semester not found.'
        }, status=404)
    except Exception as e:
        return Response({
            'success': False,
            'message': str(e)
        }, status=400)

# Registrar Grade Management Endpoints
@api_view(['GET'])
@permission_classes([IsRegistrar])
def get_all_student_grades(request):
    try:
        student_id = request.GET.get('student_id')
        department_id = request.GET.get('department_id')
        semester_id = request.GET.get('semester_id')
        academic_year_id = request.GET.get('academic_year_id')
        course_id = request.GET.get('course_id')
        
        grades = Grade.objects.select_related(
            'student', 
            'course', 
            'course__department',
            'semester',
            'semester__academic_year',
            'entered_by'
        ).filter(is_published=True)
        
        if student_id:
            grades = grades.filter(student_id=student_id)
        if department_id:
            grades = grades.filter(course__department_id=department_id)
        if semester_id:
            grades = grades.filter(semester_id=semester_id)
        if academic_year_id:
            grades = grades.filter(semester__academic_year_id=academic_year_id)
        if course_id:
            grades = grades.filter(course_id=course_id)
        
        grade_data = []
        for grade in grades:
            quality_points = 0.0
            if grade.points and grade.course.credits:
                quality_points = float(grade.points) * grade.course.credits
            
            grade_data.append({
                'id': grade.id,
                'student_id': grade.student.id,
                'student_name': f"{grade.student.first_name} {grade.student.last_name}",
                'student_number': grade.student.student_id,
                'course_id': grade.course.id,
                'course_code': grade.course.code,
                'course_name': grade.course.name,
                'department': grade.course.department.name,
                'department_id': grade.course.department.id,
                'semester': grade.semester.name,
                'semester_id': grade.semester.id,
                'academic_year': grade.semester.academic_year.name,
                'grade': grade.grade,
                'points': float(grade.points) if grade.points else 0.0,
                'credits': grade.course.credits,
                'quality_points': quality_points,
                'entered_by': f"{grade.entered_by.first_name} {grade.entered_by.last_name}" if grade.entered_by else 'System',
                'entered_at': grade.entered_at,
                'is_published': grade.is_published,
                'published_at': grade.published_at
            })
        
        return Response({
            'success': True,
            'grades': grade_data,
            'total_count': len(grade_data),
            'filters_applied': {
                'student_id': student_id,
                'department_id': department_id,
                'semester_id': semester_id,
                'academic_year_id': academic_year_id,
                'course_id': course_id
            }
        })
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=500)

@api_view(['GET'])
@permission_classes([IsRegistrar])
def get_student_academic_records(request):
    try:
        department_id = request.GET.get('department_id')
        year = request.GET.get('year')
        semester_id = request.GET.get('semester_id')
        
        students = Student.objects.select_related('department').all()
        
        if department_id:
            students = students.filter(department_id=department_id)
        if year:
            students = students.filter(year=year)
        
        academic_records = []
        
        for student in students:
            student_grades = Grade.objects.filter(
                student=student, 
                is_published=True
            ).select_related('course', 'semester', 'course__department')
            
            if semester_id:
                student_grades = student_grades.filter(semester_id=semester_id)
            
            total_credits = sum(grade.course.credits for grade in student_grades)
            total_courses = student_grades.count()
            
            total_quality_points = 0.0
            for grade in student_grades:
                if grade.points and grade.course.credits:
                    total_quality_points += float(grade.points) * grade.course.credits
            
            gpa = total_quality_points / total_credits if total_credits > 0 else 0.0
            gpa = round(gpa, 2)
            
            grade_distribution = {}
            for grade in student_grades:
                grade_letter = grade.grade
                grade_distribution[grade_letter] = grade_distribution.get(grade_letter, 0) + 1
            
            recent_grades = []
            for grade in student_grades.order_by('-semester__start_date')[:5]:
                recent_grades.append({
                    'course_code': grade.course.code,
                    'course_name': grade.course.name,
                    'semester': grade.semester.name,
                    'grade': grade.grade,
                    'points': float(grade.points) if grade.points else 0.0,
                    'credits': grade.course.credits
                })
            
            academic_records.append({
                'student_id': student.id,
                'student_number': student.student_id,
                'student_name': f"{student.first_name} {student.last_name}",
                'department': student.department.name,
                'department_id': student.department.id,
                'year': student.year,
                'gpa': gpa,
                'total_credits': total_credits,
                'total_courses': total_courses,
                'grade_distribution': grade_distribution,
                'grades': recent_grades
            })
        
        academic_records.sort(key=lambda x: x['gpa'], reverse=True)
        
        return Response({
            'success': True,
            'academic_records': academic_records,
            'total_students': len(academic_records),
            'filters_applied': {
                'department_id': department_id,
                'year': year,
                'semester_id': semester_id
            }
        })
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=500)

@api_view(['GET'])
@permission_classes([IsRegistrar])
def get_department_grade_statistics(request):
    try:
        departments = Department.objects.all()
        statistics = []
        
        for department in departments:
            department_courses = Course.objects.filter(department=department)
            
            department_grades = Grade.objects.filter(
                course__in=department_courses,
                is_published=True
            )
            
            total_grades = department_grades.count()
            total_students = Student.objects.filter(department=department).count()
            
            if total_grades > 0:
                total_quality_points = 0.0
                total_credits = 0
                
                for grade in department_grades:
                    if grade.points and grade.course.credits:
                        total_quality_points += float(grade.points) * grade.course.credits
                        total_credits += grade.course.credits
                
                average_gpa = total_quality_points / total_credits if total_credits > 0 else 0.0
                average_gpa = round(average_gpa, 2)
                
                grade_distribution = {}
                for grade in department_grades:
                    grade_letter = grade.grade
                    grade_distribution[grade_letter] = grade_distribution.get(grade_letter, 0) + 1
                
                grade_percentages = {}
                for grade_letter, count in grade_distribution.items():
                    grade_percentages[grade_letter] = round((count / total_grades) * 100, 1)
                
                statistics.append({
                    'department_id': department.id,
                    'department_name': department.name,
                    'total_students': total_students,
                    'total_grades': total_grades,
                    'average_gpa': average_gpa,
                    'grade_distribution': grade_distribution,
                    'grade_percentages': grade_percentages
                })
            else:
                statistics.append({
                    'department_id': department.id,
                    'department_name': department.name,
                    'total_students': total_students,
                    'total_grades': 0,
                    'average_gpa': 0.0,
                    'grade_distribution': {},
                    'grade_percentages': {},
                    'message': 'No grades recorded yet for this department'
                })
        
        return Response({
            'success': True,
            'statistics': statistics
        })
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=500)

# Add these debug endpoints to help troubleshoot
@api_view(['GET'])
@permission_classes([AllowAny])
def debug_auth_status(request):
    """Debug endpoint to check authentication status"""
    return Response({
        'user': {
            'is_authenticated': request.user.is_authenticated,
            'username': request.user.username if request.user.is_authenticated else 'Anonymous',
            'id': request.user.id if request.user.is_authenticated else None
        },
        'session': {
            'has_session': bool(request.session.session_key),
            'session_key': request.session.session_key
        },
        'cookies': dict(request.COOKIES)
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def debug_student_test(request):
    """Test if student can access their data"""
    try:
        if not hasattr(request.user, 'userrole'):
            return Response({
                'error': 'No UserRole found for this user'
            }, status=403)
        
        if request.user.userrole.role != 'student':
            return Response({
                'error': f'User role is {request.user.userrole.role}, expected student'
            }, status=403)
        
        try:
            student = Student.objects.get(user=request.user)
            return Response({
                'success': True,
                'student': {
                    'id': student.id,
                    'student_id': student.student_id,
                    'name': f"{student.first_name} {student.last_name}",
                    'department': student.department.name if student.department else None
                }
            })
        except Student.DoesNotExist:
            return Response({
                'error': 'Student profile not found'
            }, status=404)
            
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_student_course_slip(request):
    """Get current course slip for authenticated student - CORRECTED VERSION"""
    try:
        print(f"🔍 Course slip request from user: {request.user.username}")
        print(f"🔐 User authenticated: {request.user.is_authenticated}")
        
        # Get student profile
        student = None
        try:
            # First try to get student by user
            student = Student.objects.get(user=request.user)
            print(f"✅ Found student via user: {student.student_id}")
        except Student.DoesNotExist:
            # Alternative: try to find student by email
            student = Student.objects.filter(email=request.user.email).first()
            if student:
                print(f"✅ Found student via email: {student.student_id}")
            else:
                print("❌ No student found for user")
                return Response({
                    'error': 'Student profile not found for your account',
                    'user_info': {
                        'username': request.user.username,
                        'email': request.user.email
                    }
                }, status=404)
        
        # Get current active semester
        current_semester = Semester.objects.filter(is_active=True).first()
        
        if not current_semester:
            return Response({
                'message': 'No active semester found',
                'student': StudentSerializer(student).data
            })
        
        print(f"📅 Current semester: {current_semester.name}")
        
        # Get course slip for current semester
        course_slip = CourseSlip.objects.filter(
            student=student,
            semester=current_semester
        ).select_related('semester', 'academic_year').prefetch_related('courses').first()
        
        if course_slip:
            print(f"✅ Found course slip with {course_slip.courses.count()} courses")
            
            # Prepare response data
            response_data = {
                'id': course_slip.id,
                'student': {
                    'id': student.id,
                    'student_id': student.student_id,
                    'name': f"{student.first_name} {student.last_name}",
                    'department': student.department.name if student.department else None,
                    'year': student.year
                },
                'semester': {
                    'id': course_slip.semester.id,
                    'name': course_slip.semester.name,
                    'is_active': course_slip.semester.is_active
                },
                'academic_year': {
                    'id': course_slip.academic_year.id,
                    'name': course_slip.academic_year.name
                } if course_slip.academic_year else None,
                'courses': [
                    {
                        'id': course.id,
                        'code': course.code,
                        'name': course.name,
                        'credits': course.credits,
                        'department': course.department.name if course.department else None,
                        'year': course.year
                    }
                    for course in course_slip.courses.all()
                ],
                'total_credits': sum(course.credits for course in course_slip.courses.all()),
                'is_approved': course_slip.is_approved,
                'assigned_by': f"{course_slip.assigned_by.first_name} {course_slip.assigned_by.last_name}" if course_slip.assigned_by else None,
                'assigned_date': course_slip.assigned_date,
                'has_course_slip': True
            }
            
            return Response(response_data)
        else:
            print("❌ No course slip found for current semester")
            return Response({
                'message': 'No course slip found for current semester',
                'student': {
                    'id': student.id,
                    'student_id': student.student_id,
                    'name': f"{student.first_name} {student.last_name}",
                    'department': student.department.name if student.department else None,
                    'year': student.year
                },
                'current_semester': {
                    'id': current_semester.id,
                    'name': current_semester.name
                },
                'has_course_slip': False
            })
            
    except Exception as e:
        print(f"❌ Error in get_student_course_slip: {str(e)}")
        return Response({
            'error': f'Internal server error: {str(e)}'
        }, status=500)
            
    except Exception as e:
        print(f"❌ Error in get_student_course_slip: {str(e)}")
        return Response({
            'error': f'Internal server error: {str(e)}'
        }, status=500)
class CourseSlipViewSet(viewsets.ModelViewSet):
    queryset = CourseSlip.objects.all()
    serializer_class = CourseSlipSerializer
    permission_classes = [AllowAny]  # TEMPORARY
    
    def perform_create(self, serializer):
        # If user is authenticated, use them, otherwise use a default admin
        if self.request.user.is_authenticated:
            serializer.save(assigned_by=self.request.user)
        else:
            from django.contrib.auth.models import User
            admin_user = User.objects.filter(is_staff=True).first()
            if not admin_user:
                admin_user = User.objects.create_user(
                    username='system_admin',
                    password='temp_password123',
                    is_staff=True
                )
            serializer.save(assigned_by=admin_user)
    
    def get_queryset(self):
        return CourseSlip.objects.all().select_related(
            'student', 'semester', 'academic_year', 'assigned_by'
        ).prefetch_related('courses')
        
        # Users with specific roles
        if hasattr(user, 'userrole'):
            if user.userrole.role in ['registrar', 'administrator', 'department_head']:
                return CourseSlip.objects.all().select_related(
                    'student', 'semester', 'academic_year', 'assigned_by'
                ).prefetch_related('courses')
        
        # Students can only see their own
        if hasattr(user, 'userrole') and user.userrole.role == 'student':
            try:
                student = Student.objects.get(user=user)
                return CourseSlip.objects.filter(student=student).select_related(
                    'student', 'semester', 'academic_year', 'assigned_by'
                ).prefetch_related('courses')
            except Student.DoesNotExist:
                return CourseSlip.objects.none()
        
        return CourseSlip.objects.none()
    
    @action(detail=False, methods=['get'])
    def my_all_courses(self, request):
        try:
            student = Student.objects.get(user=request.user)
            course_slips = CourseSlip.objects.filter(student=student).order_by('-academic_year', '-semester')
            
            return Response({
                'student': StudentSerializer(student).data,
                'course_slips': CourseSlipSerializer(course_slips, many=True).data,
                'total_semesters': course_slips.count()
            })
            
        except Student.DoesNotExist:
            return Response({'error': 'Student profile not found'}, status=404)

# Course slip management endpoints
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def auto_assign_department_courses(request):
    try:
        current_semester = Semester.objects.filter(is_active=True).first()
        if not current_semester:
            return Response({'error': 'No active semester found'}, status=400)
        
        active_students = Student.objects.filter(is_active=True)
        
        created_count = 0
        updated_count = 0
        assignment_details = []
        
        for student in active_students:
            available_courses = Course.objects.filter(
                department=student.department,
                year=student.year,
                is_active=True
            )
            
            if available_courses.exists():
                course_slip, created = CourseSlip.objects.get_or_create(
                    student=student,
                    semester=current_semester,
                    academic_year=current_semester.academic_year,
                    defaults={
                        'assigned_by': request.user,
                        'is_approved': True
                    }
                )
                
                course_slip.courses.set(available_courses)
                
                assignment_details.append({
                    'student_id': student.student_id,
                    'student_name': f"{student.first_name} {student.last_name}",
                    'department': student.department.name,
                    'year': student.year,
                    'courses_assigned': available_courses.count(),
                    'action': 'Created' if created else 'Updated'
                })
                
                if created:
                    created_count += 1
                else:
                    updated_count += 1
        
        return Response({
            'message': f'Automatic course assignment completed! Created: {created_count}, Updated: {updated_count}',
            'created_count': created_count,
            'updated_count': updated_count,
            'total_students': active_students.count(),
            'assignment_details': assignment_details
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_student_course_slip(request):
    try:
        student_id = request.data.get('student_id')
        semester_id = request.data.get('semester_id')
        course_ids = request.data.get('course_ids', [])
        
        if not student_id or not semester_id or not course_ids:
            return Response({
                'error': 'Student ID, Semester ID, and Course IDs are required'
            }, status=400)
        
        student = Student.objects.get(id=student_id)
        semester = Semester.objects.get(id=semester_id)
        courses = Course.objects.filter(id__in=course_ids)
        
        invalid_courses = []
        for course in courses:
            if course.department != student.department:
                invalid_courses.append(f"{course.code} - Wrong department")
            elif course.year != student.year:
                invalid_courses.append(f"{course.code} - Wrong academic year")
        
        if invalid_courses:
            return Response({
                'error': 'Invalid courses selected',
                'invalid_courses': invalid_courses
            }, status=400)
        
        course_slip = CourseSlip.objects.create(
            student=student,
            semester=semester,
            academic_year=semester.academic_year,
            assigned_by=request.user,
            is_approved=True
        )
        course_slip.courses.set(courses)
        
        return Response({
            'success': True,
            'message': f'Course slip created for {student.first_name} {student.last_name}',
            'course_slip': CourseSlipSerializer(course_slip).data
        })
        
    except Student.DoesNotExist:
        return Response({'error': 'Student not found'}, status=404)
    except Semester.DoesNotExist:
        return Response({'error': 'Semester not found'}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_all_course_slips(request):
    """Get all course slips for registrar dashboard"""
    try:
        # Check UserRole
        if hasattr(request.user, 'userrole'):
            user_role = request.user.userrole.role
        else:
            return Response({
                'success': False,
                'error': 'User role not found'
            }, status=403)
        
        # Check if user has proper role
        user_has_permission = (
            request.user.is_staff or 
            user_role in ['registrar', 'administrator', 'department_head']
        )
        
        if not user_has_permission:
            return Response({
                'success': False,
                'error': f'Permission denied. Only registrar, administrator, or department head can access course slips. Your role: {user_role}'
            }, status=403)
        
        department_id = request.GET.get('department_id')
        semester_id = request.GET.get('semester_id')
        academic_year_id = request.GET.get('academic_year_id')
        student_search = request.GET.get('student')
        status = request.GET.get('status')
        
        course_slips = CourseSlip.objects.select_related(
            'student', 
            'student__department',
            'semester',
            'academic_year',
            'assigned_by',
            'approved_by'
        ).prefetch_related('courses').all().order_by('-assigned_date')
        
        # Apply filters
        if department_id:
            course_slips = course_slips.filter(student__department_id=department_id)
        if semester_id:
            course_slips = course_slips.filter(semester_id=semester_id)
        if academic_year_id:
            course_slips = course_slips.filter(academic_year_id=academic_year_id)
        if student_search:
            course_slips = course_slips.filter(
                Q(student__first_name__icontains=student_search) |
                Q(student__last_name__icontains=student_search) |
                Q(student__student_id__icontains=student_search)
            )
        if status == 'approved':
            course_slips = course_slips.filter(is_approved=True)
        elif status == 'pending':
            course_slips = course_slips.filter(is_approved=False)
        
        course_slip_data = []
        for slip in course_slips:
            course_data = []
            for course in slip.courses.all():
                course_data.append({
                    'id': course.id,
                    'code': course.code,
                    'name': course.name,
                    'credits': course.credits,
                    'department': course.department.name,
                    'semester': course.semester,
                    'year': course.year
                })
            
            course_slip_data.append({
                'id': slip.id,
                'student_id': slip.student.student_id,
                'student_name': f"{slip.student.first_name} {slip.student.last_name}",
                'student_department': slip.student.department.name if slip.student.department else 'No Department',
                'semester': slip.semester.name,
                'academic_year': slip.academic_year.name,
                'courses': course_data,
                'total_credits': slip.total_credits(),
                'is_approved': slip.is_approved,
                'approved_by': f"{slip.approved_by.first_name} {slip.approved_by.last_name}" if slip.approved_by else None,
                'assigned_by': f"{slip.assigned_by.first_name} {slip.assigned_by.last_name}" if slip.assigned_by else 'System',
                'assigned_date': slip.assigned_date,
                'registration_type': 'admin'
            })
        
        return Response({
            'success': True,
            'course_slips': course_slip_data,
            'total_count': len(course_slip_data),
            'approved_count': course_slips.filter(is_approved=True).count(),
            'pending_count': course_slips.filter(is_approved=False).count(),
            'filters_applied': {
                'department_id': department_id,
                'semester_id': semester_id,
                'academic_year_id': academic_year_id,
                'student': student_search,
                'status': status
            }
        })
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_students_without_course_slips(request):
    """Get students who don't have course slips for a specific semester"""
    try:
        semester_id = request.GET.get('semester_id')
        
        if not semester_id:
            return Response({
                'success': False,
                'message': 'Semester ID is required.'
            }, status=400)
        
        semester = Semester.objects.get(id=semester_id)
        
        # Get students who don't have registrations for this semester
        students_with_registrations = Registration.objects.filter(
            semester=semester
        ).values_list('student_id', flat=True)
        
        students_without_slips = Student.objects.filter(
            is_active=True
        ).exclude(
            id__in=students_with_registrations
        ).select_related('department')
        
        student_data = []
        for student in students_without_slips:
            student_data.append({
                'id': student.id,
                'student_id': student.student_id,
                'name': f"{student.first_name} {student.last_name}",
                'department': student.department.name,
                'department_id': student.department.id,
                'year': student.year,
                'email': student.email
            })
        
        return Response({
            'success': True,
            'students': student_data,
            'total_count': len(student_data),
            'semester': semester.name
        })
        
    except Semester.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Semester not found.'
        }, status=404)
    except Exception as e:
        return Response({
            'success': False,
            'message': str(e)
        }, status=500)

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def create_test_course_slip(request):
    """Temporary test function to create a course slip"""
    try:
        if request.method == 'GET':
            return Response({
                'instructions': 'Send a POST request to create a test course slip',
                'available_data': {
                    'students_count': Student.objects.count(),
                    'semesters_count': Semester.objects.count(),
                    'courses_count': Course.objects.count(),
                    'existing_course_slips': CourseSlip.objects.count()
                }
            })
        
        # POST request - create course slip
        student = Student.objects.first()
        semester = Semester.objects.first()
        courses = Course.objects.all()[:2]
        
        if not student or not semester:
            return Response({'error': 'No test data available'}, status=400)
        
        # Get or create a user for assignment
        from django.contrib.auth.models import User
        admin_user = User.objects.filter(is_staff=True).first()
        if not admin_user:
            # Create a temporary admin user if none exists
            admin_user = User.objects.create_user(
                username='temp_admin',
                password='temp_password',
                is_staff=True
            )
        
        course_slip = CourseSlip.objects.create(
            student=student,
            semester=semester,
            academic_year=semester.academic_year,
            assigned_by=admin_user,  # FIX: Provide a user
            is_approved=True
        )
        course_slip.courses.set(courses)
        
        return Response({
            'success': True,
            'message': 'Test course slip created successfully',
            'course_slip_id': course_slip.id,
            'student': f"{student.first_name} {student.last_name}",
            'semester': semester.name,
            'courses_assigned': courses.count(),
            'assigned_by': admin_user.username
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def get_csrf_token(request):
    """
    Get CSRF token and set it in cookies
    """
    token = get_token(request)
    return Response({
        'success': True,
        'csrfToken': token,
        'message': 'CSRF token retrieved successfully'
    })

@api_view(['GET'])
@permission_classes([AllowAny])
def csrf_debug(request):
    """
    Debug endpoint to check CSRF token status
    """
    token = get_token(request)
    cookies = request.COOKIES
    return Response({
        'csrf_token_from_get_token': token,
        'cookies_present': list(cookies.keys()),
        'csrftoken_in_cookies': 'csrftoken' in cookies,
        'sessionid_in_cookies': 'sessionid' in cookies,
        'user_authenticated': request.user.is_authenticated,
        'user': request.user.username if request.user.is_authenticated else 'Anonymous'
    })

class CSRFTokenView(APIView):
    permission_classes = [AllowAny]
    
    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        token = get_token(request)
        return Response({
            'success': True,
            'csrfToken': token,
            'message': 'CSRF token set in cookies'
        })

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsInstructor])
def instructor_courses(request):
    """Get courses assigned to the authenticated instructor"""
    try:
        user = request.user
        
        # Get instructor's courses
        courses = Course.objects.filter(instructor=user).select_related('department')
        
        # Get current semester
        current_semester = Semester.objects.filter(is_active=True).first()
        
        course_data = []
        for course in courses:
            # Get students registered for this course in current semester
            if current_semester:
                registered_students = Registration.objects.filter(
                    course=course,
                    semester=current_semester,
                    is_approved=True
                ).count()
                
                # Get grades entered for this course
                grades_entered = Grade.objects.filter(
                    course=course,
                    semester=current_semester,
                    entered_by=user
                ).count()
                
                # Get published grades
                published_grades = Grade.objects.filter(
                    course=course,
                    semester=current_semester,
                    is_published=True
                ).count()
            else:
                registered_students = 0
                grades_entered = 0
                published_grades = 0
            
            course_data.append({
                'id': course.id,
                'code': course.code,
                'name': course.name,
                'credits': course.credits,
                'department': course.department.name,
                'year': course.year,
                'semester_type': course.semester,
                'description': course.description,
                'is_active': course.is_active,
                'registered_students': registered_students,
                'grades_entered': grades_entered,
                'grades_published': published_grades,
                'current_semester': current_semester.name if current_semester else None
            })
        
        return Response({
            'success': True,
            'instructor': f"{user.first_name} {user.last_name}",
            'total_courses': courses.count(),
            'courses': course_data,
            'current_semester': current_semester.name if current_semester else 'No active semester'
        })
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def debug_student_course_data(request):
    """Debug endpoint to check student and course slip data - FIXED"""
    try:
        print(f"🔧 Debug endpoint called by: {request.user.username}")
        print(f"🔐 User authenticated: {request.user.is_authenticated}")
        
        # Check user authentication
        auth_info = {
            'is_authenticated': request.user.is_authenticated,
            'username': request.user.username,
            'email': request.user.email,
            'first_name': request.user.first_name,
            'last_name': request.user.last_name,
            'user_id': request.user.id
        }
        
        # Check user role
        role_info = None
        if hasattr(request.user, 'userrole'):
            role_info = {
                'role': request.user.userrole.role,
                'department': request.user.userrole.department.name if request.user.userrole.department else None
            }
        else:
            print("⚠️ No UserRole found for user")
        
        # Find student
        student = None
        student_query = None
        try:
            student_query = Student.objects.get(user=request.user)
            student = {
                'id': student_query.id,
                'student_id': student_query.student_id,
                'first_name': student_query.first_name,
                'last_name': student_query.last_name,
                'email': student_query.email,
                'department': student_query.department.name if student_query.department else None,
                'year': student_query.year,
                'is_active': student_query.is_active
            }
            print(f"✅ Found student: {student_query.student_id}")
        except Student.DoesNotExist:
            print("❌ Student.DoesNotExist - no student profile linked to user")
            # Try alternative lookup
            student_query = Student.objects.filter(email=request.user.email).first()
            if student_query:
                student = {
                    'id': student_query.id,
                    'student_id': student_query.student_id,
                    'first_name': student_query.first_name,
                    'last_name': student_query.last_name,
                    'email': student_query.email,
                    'department': student_query.department.name if student_query.department else None,
                    'year': student_query.year,
                    'is_active': student_query.is_active
                }
                print(f"✅ Found student via email: {student_query.student_id}")
        
        # Check current semester
        current_semester = Semester.objects.filter(is_active=True).first()
        semester_info = None
        if current_semester:
            semester_info = {
                'id': current_semester.id,
                'name': current_semester.name,
                'is_active': current_semester.is_active
            }
            print(f"📅 Current semester: {current_semester.name}")
        else:
            print("❌ No active semester found")
        
        # Check course slips
        course_slips = []
        if student_query:
            slips = CourseSlip.objects.filter(student=student_query)
            print(f"📋 Found {slips.count()} course slips for student")
            
            for slip in slips:
                course_slips.append({
                    'id': slip.id,
                    'semester': slip.semester.name if slip.semester else 'No semester',
                    'academic_year': slip.academic_year.name if slip.academic_year else None,
                    'courses_count': slip.courses.count(),
                    'is_approved': slip.is_approved,
                    'assigned_date': slip.assigned_date
                })
        else:
            print("❌ No student query available to check course slips")
        
        response_data = {
            'authentication': auth_info,
            'user_role': role_info,
            'student_profile': student,
            'current_semester': semester_info,
            'all_course_slips': course_slips,
            'total_course_slips': len(course_slips)
        }
        
        print(f"✅ Debug response prepared")
        return Response(response_data)
        
    except Exception as e:
        print(f"❌ Error in debug_student_course_data: {str(e)}")
        return Response({
            'error': f'Internal server error: {str(e)}'
        }, status=500)