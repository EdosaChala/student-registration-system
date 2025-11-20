from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User
from .models import *

# CUSTOM USER ADMIN
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'first_name', 'last_name', 'get_role', 'get_role_details', 'is_staff', 'is_active')
    list_filter = ('is_staff', 'is_active', 'userrole__role')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    
    def get_role(self, obj):
        """Get user role similar to API"""
        try:
            if hasattr(obj, 'userrole'):
                role = obj.userrole.role
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
            if hasattr(obj, 'student'):
                return 'Student'
            return 'Student'
    
    get_role.short_description = 'Role'
    
    def get_role_details(self, obj):
        """Get role details similar to API"""
        try:
            if hasattr(obj, 'userrole'):
                userrole = obj.userrole
                if userrole.role == 'student' and hasattr(obj, 'student'):
                    dept_name = obj.student.department.name if obj.student.department else 'Not assigned'
                    return f"Department: {dept_name}"
                elif userrole.role == 'instructor':
                    courses = Course.objects.filter(instructor=obj)
                    course_names = [f"{course.code}" for course in courses[:2]]
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
        
        # Fallback details
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
    
    get_role_details.short_description = 'Role Details'

# UNREGISTER THE DEFAULT USER ADMIN AND REGISTER CUSTOM ONE
admin.site.unregister(User)
admin.site.register(User, CustomUserAdmin)

@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ['user', 'role', 'department', 'created_at']
    list_filter = ['role', 'department']
    search_fields = ['user__username', 'user__first_name', 'user__last_name']
    list_editable = ['role', 'department']

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'created_at']
    search_fields = ['name', 'code']

@admin.register(AcademicProgram)
class AcademicProgramAdmin(admin.ModelAdmin):
    list_display = ['name', 'department', 'duration']
    list_filter = ['department']
    search_fields = ['name']

@admin.register(AcademicYear)
class AcademicYearAdmin(admin.ModelAdmin):
    list_display = ['name', 'start_date', 'end_date', 'registration_start', 'registration_deadline', 'late_registration_deadline', 'is_active']
    list_filter = ['is_active']
    list_editable = ['is_active']
    search_fields = ['name']

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ['student_id', 'first_name', 'last_name', 'department', 'year', 'registration_date', 'is_active']
    list_filter = ['department', 'year', 'is_active', 'gender']
    search_fields = ['student_id', 'first_name', 'last_name', 'email']
    list_editable = ['is_active']

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'department', 'credits', 'instructor', 'semester', 'year', 'is_active']
    list_filter = ['department', 'semester', 'year', 'is_active']
    search_fields = ['code', 'name']
    list_editable = ['is_active']
    raw_id_fields = ['instructor']

@admin.register(Semester)
class SemesterAdmin(admin.ModelAdmin):
    list_display = ['name', 'academic_year', 'semester_number', 'start_date', 'end_date', 'is_active', 'registration_open']
    list_filter = ['academic_year', 'is_active', 'registration_open']
    list_editable = ['is_active', 'registration_open']
    search_fields = ['name']

@admin.register(Registration)
class RegistrationAdmin(admin.ModelAdmin):
    list_display = ['student', 'semester', 'academic_year', 'is_approved', 'approved_by', 'is_late_registration', 'penalty_paid', 'registered_at']
    list_filter = ['semester', 'academic_year', 'is_approved', 'is_late_registration', 'penalty_paid']
    search_fields = ['student__student_id', 'student__first_name']
    raw_id_fields = ['student', 'approved_by']
    readonly_fields = ['registered_at']

@admin.register(Grade)
class GradeAdmin(admin.ModelAdmin):
    list_display = ['student', 'course', 'semester', 'grade', 'points', 'entered_by', 'is_published', 'published_by', 'published_at']
    list_filter = ['semester', 'grade', 'is_published', 'course__department']
    search_fields = ['student__student_id', 'student__first_name', 'course__code']
    readonly_fields = ['points', 'entered_by', 'entered_at', 'published_by', 'published_at']
    raw_id_fields = ['entered_by', 'published_by']
    
    def save_model(self, request, obj, form, change):
        # Auto-set entered_by if creating new grade
        if not obj.pk:  # If creating new grade
            obj.entered_by = request.user
        
        # UPDATED: Calculate points based on all grade options
        if obj.grade:
            grade_points_map = {
               'A+': 4.00, 'A': 4.00, 'A-': 3.75,
                'B+': 3.50, 'B': 3.00, 'B-': 2.75,
                'C+': 2.50, 'C': 2.00, 'C-': 1.75,
                'D': 1.00, 
                'F': 0.00, 'I': None,
            }
            obj.points = grade_points_map.get(obj.grade)
        
        # Set published_by and published_at if publishing
        if obj.is_published and not obj.published_at:
            obj.published_by = request.user
        
        super().save_model(request, obj, form, change)
    
    def get_queryset(self, request):
        # Show all grades to admin, but in real implementation you might want to filter
        return super().get_queryset(request)

@admin.register(RegistrationPenalty)
class RegistrationPenaltyAdmin(admin.ModelAdmin):
    list_display = ['academic_year', 'penalty_amount', 'is_active']
    list_filter = ['is_active', 'academic_year']
    list_editable = ['penalty_amount', 'is_active']
    search_fields = ['academic_year__name']

@admin.register(DepartmentHead)
class DepartmentHeadAdmin(admin.ModelAdmin):
    list_display = ['user', 'department', 'assigned_date']
    search_fields = ['user__username', 'user__first_name', 'department__name']
    raw_id_fields = ['user']

# Custom Admin Site Header
admin.site.site_header = "Wollega University Student Registration System"
admin.site.site_title = "University Admin Portal"
admin.site.index_title = "System Administration"
# In admin.py - Update the CourseSlipAdmin

@admin.register(CourseSlip)
class CourseSlipAdmin(admin.ModelAdmin):
    list_display = ['student', 'semester', 'academic_year', 'is_approved', 'assigned_by', 'assigned_date', 'courses_count', 'student_department', 'total_credits_display']
    list_filter = ['semester', 'academic_year', 'is_approved', 'student__department']
    search_fields = ['student__student_id', 'student__first_name', 'student__last_name']
    list_editable = ['is_approved']
    readonly_fields = ['assigned_date', 'courses_count_display', 'student_department_display', 'total_credits_display']
    filter_horizontal = ['courses']
    raw_id_fields = ['student', 'assigned_by', 'approved_by']
    
    # Custom form layout for better user experience
    fieldsets = (
        ('Student Information', {
            'fields': ('student', 'student_department_display')
        }),
        ('Academic Information', {
            'fields': ('semester', 'academic_year')
        }),
        ('Course Assignment', {
            'fields': ('courses', 'total_credits_display')
        }),
        ('Approval Status', {
            'fields': ('is_approved', 'approved_by', 'assigned_by', 'assigned_date')
        }),
    )
    
    def courses_count(self, obj):
        return obj.courses.count()
    courses_count.short_description = 'Courses'
    
    def student_department(self, obj):
        return obj.student.department.name if obj.student.department else 'No Department'
    student_department.short_description = 'Department'
    
    def courses_count_display(self, obj):
        return obj.courses.count()
    courses_count_display.short_description = 'Number of Courses'
    
    def student_department_display(self, obj):
        return obj.student.department.name if obj.student and obj.student.department else 'No Department'
    student_department_display.short_description = 'Department'
    
    def total_credits_display(self, obj):
        return obj.total_credits()
    total_credits_display.short_description = 'Total Credits'
    
    def get_readonly_fields(self, request, obj=None):
        readonly_fields = list(self.readonly_fields)
        if obj:  # Editing an existing object
            readonly_fields.extend(['student', 'semester', 'academic_year'])
        return readonly_fields
    
    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        # Filter courses based on student's department when creating new course slip
        if db_field.name == "courses" and hasattr(request, '_course_slip_student'):
            student = request._course_slip_student
            if student and student.department:
                kwargs["queryset"] = Course.objects.filter(department=student.department, is_active=True)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)
    
    def formfield_for_manytomany(self, db_field, request, **kwargs):
        # Filter courses based on student's department
        if db_field.name == "courses":
            # Try to get student from the form
            student_id = request.GET.get('student') or request.POST.get('student')
            if student_id:
                try:
                    student = Student.objects.get(id=student_id)
                    kwargs["queryset"] = Course.objects.filter(
                        department=student.department, 
                        is_active=True
                    ).order_by('code')
                except Student.DoesNotExist:
                    pass
        return super().formfield_for_manytomany(db_field, request, **kwargs)
    
    def save_model(self, request, obj, form, change):
        if not obj.pk:  # If creating new course slip
            obj.assigned_by = request.user
        
        # Auto-set academic year from semester if not set
        if obj.semester and not obj.academic_year:
            obj.academic_year = obj.semester.academic_year
            
        super().save_model(request, obj, form, change)
    
    # Custom actions for bulk operations
    actions = ['approve_course_slips']
    
    def approve_course_slips(self, request, queryset):
        updated = queryset.update(is_approved=True, approved_by=request.user)
        self.message_user(request, f'{updated} course slips were approved.')
    approve_course_slips.short_description = "Approve selected course slips"
    
    def get_form(self, request, obj=None, **kwargs):
        # Store student in request for filtering courses
        if obj:
            request._course_slip_student = obj.student
        elif request.method == 'POST' and 'student' in request.POST:
            try:
                student_id = request.POST.get('student')
                if student_id:
                    request._course_slip_student = Student.objects.get(id=student_id)
            except (Student.DoesNotExist, ValueError):
                pass
        return super().get_form(request, obj, **kwargs)