from rest_framework import serializers
from django.contrib.auth.models import User
from .models import *

class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    role_details = serializers.SerializerMethodField()
    staff = serializers.BooleanField(source='is_staff')
    active = serializers.BooleanField(source='is_active')
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 
                 'role', 'role_details', 'staff', 'active']

    def get_role(self, obj):
        """Determine user role based on UserRole model and staff status"""
        try:
            if hasattr(obj, 'userrole'):
                role = obj.userrole.role
                # Format role names properly
                if role == 'department_head':
                    return 'Department Head'
                elif role == 'registrar':
                    return 'Registrar'
                elif role == 'administrator':
                    return 'Administrator'
                else:
                    return role.title()
        except UserRole.DoesNotExist:
            pass
        
        # Fallback based on username patterns and staff status
        if obj.is_staff:
            if obj.username == 'depthead001':
                return 'Department Head'
            elif obj.username == 'registrar001':
                return 'Registrar'
            elif obj.username == 'instructor001':
                return 'Instructor'
            else:
                return 'Staff'
        else:
            # Check if it's a student by username pattern or student association
            if hasattr(obj, 'student'):
                return 'Student'
            # Default to Student for non-staff users
            return 'Student'

    def get_role_details(self, obj):
        """Get detailed role information"""
        try:
            if hasattr(obj, 'userrole'):
                userrole = obj.userrole
                if userrole.role == 'student' and hasattr(obj, 'student'):
                    dept_name = obj.student.department.name if obj.student.department else 'Not assigned'
                    return f"Department: {dept_name}"
                elif userrole.role == 'instructor':
                    courses = Course.objects.filter(instructor=obj)
                    course_names = [f"{course.code}" for course in courses[:2]]  # Show first 2 courses
                    courses_str = ", ".join(course_names) if course_names else "No courses"
                    dept_name = userrole.department.name if userrole.department else 'Not assigned'
                    return f"Dept: {dept_name}, Courses: {courses_str}"
                elif userrole.role == 'department_head':
                    dept_name = userrole.department.name if userrole.department else 'Not assigned'
                    return f"Head of: {dept_name}"
                elif userrole.role == 'registrar':
                    return "Registration Department"
                elif userrole.role == 'administrator':
                    return "System Administrator"
                return f"Department: {userrole.department.name if userrole.department else 'Not assigned'}"
        except UserRole.DoesNotExist:
            pass
        
        # Fallback details for users without UserRole
        if obj.is_staff:
            if obj.username == 'depthead001':
                return "Head of: Computer Science"
            elif obj.username == 'registrar001':
                return "Registration Department"
            elif obj.username == 'instructor001':
                courses = Course.objects.filter(instructor=obj)
                course_names = [f"{course.code}" for course in courses[:2]]
                courses_str = ", ".join(course_names) if course_names else "No courses assigned"
                return f"Dept: Computer Science, Courses: {courses_str}"
            return "System Staff"
        else:
            if hasattr(obj, 'student'):
                dept_name = obj.student.department.name if obj.student.department else 'Not assigned'
                return f"Department: {dept_name}"
            return "Student (Department not assigned)"

class UserRoleSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    
    class Meta:
        model = UserRole
        fields = '__all__'

class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = '__all__'

class DepartmentStatsSerializer(serializers.ModelSerializer):
    student_count = serializers.IntegerField()
    class Meta:
        model = Department
        fields = ['id', 'name', 'code', 'student_count']

class AcademicProgramSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    class Meta:
        model = AcademicProgram
        fields = '__all__'

class AcademicYearSerializer(serializers.ModelSerializer):
    registration_status = serializers.SerializerMethodField()
    
    class Meta:
        model = AcademicYear
        fields = '__all__'
    
    def get_registration_status(self, obj):
        return obj.get_registration_status()

class StudentSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    program_name = serializers.CharField(source='academic_program.name', read_only=True)
    user = UserSerializer(read_only=True)
    cumulative_gpa = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Student
        fields = '__all__'
    
    def get_cumulative_gpa(self, obj):
        return obj.get_cumulative_gpa()
    
    def get_full_name(self, obj):
        return obj.get_full_name()

class CourseSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    instructor_name = serializers.CharField(source='instructor.get_full_name', read_only=True)
    
    class Meta:
        model = Course
        fields = '__all__'

class SemesterSerializer(serializers.ModelSerializer):
    academic_year_name = serializers.CharField(source='academic_year.name', read_only=True)
    
    class Meta:
        model = Semester
        fields = '__all__'

class RegistrationSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.first_name', read_only=True)
    semester_name = serializers.CharField(source='semester.name', read_only=True)
    academic_year_name = serializers.CharField(source='academic_year.name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True)
    courses_details = serializers.SerializerMethodField()
    
    class Meta:
        model = Registration
        fields = '__all__'
    
    def get_courses_details(self, obj):
        return CourseSerializer(obj.courses.all(), many=True).data

class GradeSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.first_name', read_only=True)
    student_full_name = serializers.SerializerMethodField(read_only=True)
    course_name = serializers.CharField(source='course.name', read_only=True)
    course_code = serializers.CharField(source='course.code', read_only=True)
    semester_name = serializers.CharField(source='semester.name', read_only=True)
    entered_by_name = serializers.CharField(source='entered_by.get_full_name', read_only=True)
    published_by_name = serializers.CharField(source='published_by.get_full_name', read_only=True)
    course_credits = serializers.IntegerField(source='course.credits', read_only=True)
    
    # Add grade_point field to match your views
    grade_point = serializers.DecimalField(
        source='points', 
        max_digits=3, 
        decimal_places=2, 
        read_only=True
    )
    
    class Meta:
        model = Grade
        fields = [
            'id', 'student', 'student_name', 'student_full_name', 
            'course', 'course_name', 'course_code', 'course_credits',
            'semester', 'semester_name', 'grade', 'points', 'grade_point',
            'entered_by', 'entered_by_name', 'entered_at', 
            'is_published', 'published_by', 'published_by_name', 'published_at'
        ]
        read_only_fields = ['entered_at', 'published_by', 'published_at']
    
    def get_student_full_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}"

class GradeEntrySerializer(serializers.ModelSerializer):
    """Serializer for instructors to enter grades"""
    student_name = serializers.CharField(source='student.first_name', read_only=True)
    student_full_name = serializers.SerializerMethodField(read_only=True)
    course_name = serializers.CharField(source='course.name', read_only=True)
    course_code = serializers.CharField(source='course.code', read_only=True)
    
    class Meta:
        model = Grade
        fields = [
            'id', 'student', 'student_name', 'student_full_name',
            'course', 'course_name', 'course_code', 
            'semester', 'grade', 'points'
        ]
    
    def get_student_full_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}"
    
    def validate(self, data):
        # Validate that the grade is provided
        if 'grade' not in data or not data['grade']:
            raise serializers.ValidationError("Grade is required.")
        
        # Validate that the grade is a valid choice
        valid_grades = [choice[0] for choice in Grade.GRADE_CHOICES]
        if data['grade'] not in valid_grades:
            raise serializers.ValidationError(f"Invalid grade. Must be one of: {', '.join(valid_grades)}")
        
        # Validate that student and course belong to the same department
        student = data.get('student')
        course = data.get('course')
        
        if student and course:
            if student.department != course.department:
                raise serializers.ValidationError("Student and course must be from the same department.")
        
        return data

class GradePublishSerializer(serializers.ModelSerializer):
    class Meta:
        model = Grade
        fields = ['is_published']

class AcademicYearRegistrationStatusSerializer(serializers.Serializer):
    """Serializer for academic year registration status API"""
    id = serializers.IntegerField()
    name = serializers.CharField()
    status = serializers.CharField()
    registration_start = serializers.DateField()
    registration_deadline = serializers.DateField()
    late_registration_deadline = serializers.DateField()
    penalty_amount = serializers.DecimalField(max_digits=8, decimal_places=2)
    is_active = serializers.BooleanField()

class StudentRegistrationSummarySerializer(serializers.ModelSerializer):
    """Serializer for student registration summary"""
    total_registrations = serializers.SerializerMethodField()
    late_registrations = serializers.SerializerMethodField()
    total_penalties = serializers.SerializerMethodField()
    paid_penalties = serializers.SerializerMethodField()
    
    class Meta:
        model = Student
        fields = ['id', 'student_id', 'first_name', 'last_name', 'total_registrations', 
                 'late_registrations', 'total_penalties', 'paid_penalties']
    
    def get_total_registrations(self, obj):
        return Registration.objects.filter(student=obj).count()
    
    def get_late_registrations(self, obj):
        return Registration.objects.filter(student=obj, is_late_registration=True).count()
    
    def get_total_penalties(self, obj):
        registrations = Registration.objects.filter(student=obj, is_late_registration=True)
        return sum(reg.penalty_amount for reg in registrations)
    
    def get_paid_penalties(self, obj):
        registrations = Registration.objects.filter(student=obj, is_late_registration=True, penalty_paid=True)
        return sum(reg.penalty_amount for reg in registrations)

class RegistrationAnalyticsSerializer(serializers.Serializer):
    """Serializer for registration analytics"""
    total_registrations = serializers.IntegerField()
    regular_registrations = serializers.IntegerField()
    late_registrations = serializers.IntegerField()
    total_penalty_revenue = serializers.DecimalField(max_digits=12, decimal_places=2)
    collected_penalty_revenue = serializers.DecimalField(max_digits=12, decimal_places=2)
    pending_penalty_revenue = serializers.DecimalField(max_digits=12, decimal_places=2)
    academic_year = serializers.CharField()

class CourseSlipSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.get_full_name', read_only=True)
    student_id = serializers.CharField(source='student.student_id', read_only=True)
    department_name = serializers.CharField(source='student.department.name', read_only=True)
    student_year = serializers.IntegerField(source='student.year', read_only=True)
    semester_name = serializers.CharField(source='semester.name', read_only=True)
    academic_year_name = serializers.CharField(source='academic_year.name', read_only=True)
    
    courses = serializers.PrimaryKeyRelatedField(
        many=True, 
        queryset=Course.objects.all(),
        required=False
    )
    
    course_details = CourseSerializer(source='courses', many=True, read_only=True)
    
    total_credits = serializers.SerializerMethodField()
    assigned_by_name = serializers.CharField(source='assigned_by.get_full_name', read_only=True)
    approved_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = CourseSlip
        fields = [
            'id', 'student', 'student_name', 'student_id', 'department_name', 'student_year',
            'semester', 'semester_name', 'academic_year', 'academic_year_name',
            'courses', 'course_details', 'total_credits', 'assigned_by', 'assigned_by_name',
            'assigned_date', 'is_approved', 'approved_by', 'approved_by_name'
        ]
        read_only_fields = ['assigned_by', 'assigned_date']
    
    def get_total_credits(self, obj):
        return obj.total_credits()
    
    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return f"{obj.approved_by.first_name} {obj.approved_by.last_name}"
        return None
    
    def validate_courses(self, value):
        """Validate courses when they are provided in the request"""
        if not value:
            return value
            
        student = None
        if 'student' in self.initial_data:
            try:
                student = Student.objects.get(id=self.initial_data['student'])
            except Student.DoesNotExist:
                pass
        elif self.instance and hasattr(self.instance, 'student'):
            student = self.instance.student
        
        semester = None
        if 'semester' in self.initial_data:
            try:
                semester = Semester.objects.get(id=self.initial_data['semester'])
            except Semester.DoesNotExist:
                pass
        elif self.instance and hasattr(self.instance, 'semester'):
            semester = self.instance.semester
        
        if student and semester:
            errors = []
            for course in value:
                course_errors = []
                
                # Check department match
                if course.department != student.department:
                    course_errors.append(f"Department mismatch: Course belongs to {course.department.name}, student is in {student.department.name}")
                
                # Check academic year match
                if course.year != student.year:
                    course_errors.append(f"Academic year mismatch: Course is for year {course.year}, student is in year {student.year}")
                
                if course_errors:
                    errors.append({
                        'course': f"{course.code} - {course.name}",
                        'errors': course_errors
                    })
            
            if errors:
                raise serializers.ValidationError({
                    'invalid_courses': errors,
                    'message': 'Some courses have validation errors'
                })
        
        return value
    
    def create(self, validated_data):
        courses_data = validated_data.pop('courses', [])
        
        student = validated_data.get('student')
        semester = validated_data.get('semester')
        academic_year = validated_data.get('academic_year')
        
        # Check if course slip already exists for this student, semester, and academic year
        if CourseSlip.objects.filter(
            student=student, 
            semester=semester, 
            academic_year=academic_year
        ).exists():
            raise serializers.ValidationError(
                "A course slip already exists for this student in the selected semester and academic year"
            )
        
        # Validate course assignments
        if student and semester and courses_data:
            self._validate_course_assignments(student, courses_data)
        
        course_slip = CourseSlip.objects.create(**validated_data)
        
        if courses_data:
            course_slip.courses.set(courses_data)
        
        return course_slip
    
    def update(self, instance, validated_data):
        courses_data = validated_data.pop('courses', None)
        
        student = instance.student
        semester = instance.semester
        
        # Validate course assignments if courses are being updated
        if courses_data is not None:
            self._validate_course_assignments(student, courses_data)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if courses_data is not None:
            instance.courses.set(courses_data)
        
        return instance
    
    def _validate_course_assignments(self, student, courses):
        """Helper method to validate course assignments"""
        validation_errors = []
        
        for course in courses:
            errors = []
            
            # Check department match
            if course.department != student.department:
                errors.append(f"Department mismatch: Course belongs to {course.department.name}, student is in {student.department.name}")
            
            # Check academic year match
            if course.year != student.year:
                errors.append(f"Academic year mismatch: Course is for year {course.year}, student is in year {student.year}")
            
            if errors:
                validation_errors.append({
                    'course_code': course.code,
                    'course_name': course.name,
                    'errors': errors
                })
        
        if validation_errors:
            raise serializers.ValidationError({
                'invalid_courses': validation_errors,
                'message': 'Cannot assign courses due to validation errors'
            })
            
class CourseSlipCreateSerializer(serializers.ModelSerializer):
    course_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=True
    )
    
    class Meta:
        model = CourseSlip
        fields = ['student', 'semester', 'academic_year', 'course_ids', 'is_approved']
    
    def validate(self, data):
        student = data['student']
        semester = data['semester']
        academic_year = data['academic_year']
        course_ids = data['course_ids']
        
        # Check if course slip already exists for this student, semester, and academic year
        if CourseSlip.objects.filter(
            student=student, 
            semester=semester, 
            academic_year=academic_year
        ).exists():
            raise serializers.ValidationError(
                "A course slip already exists for this student in the selected semester and academic year"
            )
        
        # Validate courses exist
        courses = Course.objects.filter(id__in=course_ids)
        if len(courses) != len(course_ids):
            found_ids = set(courses.values_list('id', flat=True))
            missing_ids = set(course_ids) - found_ids
            raise serializers.ValidationError({
                'course_ids': f"The following course IDs do not exist: {list(missing_ids)}"
            })
        
        # Validate each course for department and year compatibility
        validation_errors = []
        
        for course in courses:
            errors = []
            
            # Check department match
            if course.department != student.department:
                errors.append(f"Department mismatch: Course belongs to {course.department.name}, but student is in {student.department.name}")
            
            # Check academic year match
            if course.year != student.year:
                errors.append(f"Academic year mismatch: Course is for year {course.year}, but student is in year {student.year}")
            
            # Check if course is active
            if not course.is_active:
                errors.append("Course is not currently active")
            
            if errors:
                validation_errors.append({
                    'course_code': course.code,
                    'course_name': course.name,
                    'errors': errors
                })
        
        if validation_errors:
            raise serializers.ValidationError({
                'invalid_courses': validation_errors,
                'message': 'Some courses cannot be assigned due to validation errors'
            })
        
        # Check for duplicate courses in the same semester
        existing_courses = CourseSlip.objects.filter(
            student=student,
            semester=semester
        ).values_list('courses__id', flat=True)
        
        duplicate_courses = []
        for course in courses:
            if course.id in existing_courses:
                duplicate_courses.append(f"{course.code} - {course.name}")
        
        if duplicate_courses:
            raise serializers.ValidationError({
                'duplicate_courses': {
                    'message': 'The following courses are already assigned to this student for the selected semester',
                    'courses': duplicate_courses
                }
            })
        
        # Check total credits limit
        total_credits = sum(course.credits for course in courses)
        max_credits = 24
        
        if total_credits > max_credits:
            raise serializers.ValidationError({
                'credit_limit': f"Total credits ({total_credits}) exceed maximum allowed ({max_credits})"
            })
        
        return data
    
    def create(self, validated_data):
        course_ids = validated_data.pop('course_ids')
        course_slip = CourseSlip.objects.create(
            **validated_data,
            assigned_by=self.context['request'].user
        )
        course_slip.courses.set(course_ids)
        return course_slip