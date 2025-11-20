from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.utils import timezone
from datetime import timedelta

class Department(models.Model):
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=10)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.name

class AcademicProgram(models.Model):
    name = models.CharField(max_length=200)
    department = models.ForeignKey(Department, on_delete=models.CASCADE)
    duration = models.IntegerField(help_text="Duration in years")
    
    def __str__(self):
        return f"{self.name} - {self.department.name}"

class AcademicYear(models.Model):
    name = models.CharField(max_length=50, unique=True)
    start_date = models.DateField()
    end_date = models.DateField()
    registration_start = models.DateField()
    registration_deadline = models.DateField()
    late_registration_deadline = models.DateField()
    is_active = models.BooleanField(default=False)
    
    def __str__(self):
        return self.name
    
    def clean(self):
        if self.registration_start and self.registration_deadline and self.late_registration_deadline:
            if self.registration_deadline <= self.registration_start:
                raise ValidationError('Registration deadline must be after start date.')
            if self.late_registration_deadline <= self.registration_deadline:
                raise ValidationError('Late registration deadline must be after regular deadline.')
    
    def get_registration_status(self):
        today = timezone.now().date()
        if today < self.registration_start:
            return 'not_started'
        elif today <= self.registration_deadline:
            return 'regular'
        elif today <= self.late_registration_deadline:
            return 'late'
        else:
            return 'closed'

# USER ROLES MODEL
class UserRole(models.Model):
    ROLE_CHOICES = [
        ('student', 'Student'),
        ('instructor', 'Instructor'),
        ('registrar', 'Registrar'),
        ('department_head', 'Department Head'),
        ('administrator', 'Administrator'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.user.username} - {self.role}"

class Student(models.Model):
    GENDER_CHOICES = [('M', 'Male'), ('F', 'Female')]
    YEAR_CHOICES = [(1, '1st Year'), (2, '2nd Year'), (3, '3rd Year'), (4, '4th Year'), (5, '5th Year')]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, null=True, blank=True)
    student_id = models.CharField(max_length=20, unique=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=15)
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES)
    department = models.ForeignKey(Department, on_delete=models.CASCADE)
    academic_program = models.ForeignKey(AcademicProgram, on_delete=models.CASCADE)
    year = models.IntegerField(choices=YEAR_CHOICES, default=1)
    registration_date = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    
    def get_full_name(self):
        return f"{self.first_name} {self.last_name}"
    
    def calculate_gpa(self, semester=None):
        try:
            grades = Grade.objects.filter(student=self, is_published=True)
            if semester:
                grades = grades.filter(semester=semester)
            
            if not grades.exists():
                return 0.00
            
            total_quality_points = 0
            total_credits = 0
            
            for grade in grades:
                if grade.points is not None and grade.course.credits:
                    # CAP points at 4.00 to prevent overflow
                    capped_points = min(float(grade.points), 4.00)
                    total_quality_points += capped_points * grade.course.credits
                    total_credits += grade.course.credits
            
            if total_credits == 0:
                return 0.00
            
            calculated_gpa = total_quality_points / total_credits
            # CAP final GPA at 4.00
            return min(round(calculated_gpa, 2), 4.00)
        except Exception:
            return 0.00
    
    def get_semester_gpa(self, semester):
        return self.calculate_gpa(semester)
    
    def get_cumulative_gpa(self):
        return self.calculate_gpa()
    
    def get_semester_grades(self, semester):
        return Grade.objects.filter(student=self, semester=semester, is_published=True)
    
    def get_all_grades(self):
        return Grade.objects.filter(student=self, is_published=True)
    
    def fix_and_recalculate_gpa(self):
        """Recalculate and fix GPA, ensuring it doesn't exceed 4.00"""
        return self.calculate_gpa()
    
    @classmethod
    def fix_all_student_gpas(cls):
        """Batch fix GPAs for all students"""
        for student in cls.objects.all():
            # This ensures all GPAs are recalculated with the 4.00 cap
            student.calculate_gpa()
    
    def __str__(self):
        gpa = self.calculate_gpa()
        return f"{self.first_name} {self.last_name} ({self.student_id}) - GPA: {gpa}/4.00"

class Course(models.Model):
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=200)
    credits = models.IntegerField(default=3)
    department = models.ForeignKey(Department, on_delete=models.CASCADE)
    semester = models.IntegerField(choices=[(1, '1st Semester'), (2, '2nd Semester')])
    year = models.IntegerField(choices=[(1, '1st Year'), (2, '2nd Year'), (3, '3rd Year'), (4, '4th Year'), (5, '5th Year')])
    instructor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, 
                                  limit_choices_to={'userrole__role__in': ['instructor', 'department_head']})
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return f"{self.code} - {self.name}"

class Semester(models.Model):
    name = models.CharField(max_length=50)
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE)
    semester_number = models.IntegerField(choices=[(1, '1st Semester'), (2, '2nd Semester')])
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=False)
    registration_open = models.BooleanField(default=False)
    
    def clean(self):
        if self.start_date and self.end_date:
            if self.end_date <= self.start_date:
                raise ValidationError({'end_date': 'End date must be after start date.'})
            
            duration = (self.end_date - self.start_date).days
            if duration < 90:
                raise ValidationError({'end_date': f'Semester must be at least 3 months long. Current duration: {duration} days.'})
            
            if duration > 210:
                raise ValidationError({'end_date': f'Semester cannot be longer than 7 months. Current duration: {duration} days.'})
    
    def __str__(self):
        return f"{self.name} {self.academic_year.name}"
    
    class Meta:
        ordering = ['-start_date']

class RegistrationPenalty(models.Model):
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE)
    penalty_amount = models.DecimalField(max_digits=8, decimal_places=2, default=500.00)
    penalty_description = models.TextField(default="Late registration penalty")
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return f"Penalty - {self.academic_year.name}"

class Registration(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    semester = models.ForeignKey(Semester, on_delete=models.CASCADE)
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE, null=True, blank=True)
    courses = models.ManyToManyField(Course)
    registered_at = models.DateTimeField(auto_now_add=True)
    is_approved = models.BooleanField(default=False)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_registrations')
    is_late_registration = models.BooleanField(default=False)
    penalty_paid = models.BooleanField(default=False)
    penalty_amount = models.DecimalField(max_digits=8, decimal_places=2, default=0.00)
    
    # ADD THIS FIELD
    registration_type = models.CharField(
        max_length=20,
        choices=[('student', 'Student Self-Registration'), ('admin', 'Admin Assignment')],
        default='student'
    )
    
    class Meta:
        unique_together = ['student', 'semester', 'academic_year']
    
    def __str__(self):
        return f"{self.student.student_id} - {self.semester.name} - {self.academic_year.name}"
    
    def clean(self):
        if self.academic_year and self.registered_at:
            today = timezone.now().date()
            academic_year = self.academic_year
            
            # Skip registration date validation for admin assignments
            if self.registration_type == 'student':
                if today > academic_year.late_registration_deadline:
                    raise ValidationError('Registration for this academic year is closed.')
                
                if today < academic_year.registration_start:
                    raise ValidationError('Registration for this academic year has not started yet.')
                
                if today > academic_year.registration_deadline:
                    self.is_late_registration = True
                    if not self.penalty_amount:
                        penalty_settings = RegistrationPenalty.objects.filter(
                            academic_year=academic_year,
                            is_active=True
                        ).first()
                        self.penalty_amount = penalty_settings.penalty_amount if penalty_settings else 500.00
    
    def save(self, *args, **kwargs):
        # Auto-approve admin assignments
        if self.registration_type == 'admin' and not self.is_approved:
            self.is_approved = True
        self.clean()
        super().save(*args, **kwargs)

class Grade(models.Model):
    GRADE_CHOICES = [
        ('A+', 'A+ (4.00)'),
        ('A', 'A (4.00)'),
        ('A-', 'A- (3.75)'),
        ('B+', 'B+ (3.50)'),
        ('B', 'B (3.00)'),
        ('B-', 'B- (2.75)'),
        ('C+', 'C+ (2.50)'),
        ('C', 'C (2.00)'),
        ('C-', 'C- (1.75)'),
        ('D', 'D (1.00)'),
        ('F', 'F (0.00)'),
        ('I', 'I (Incomplete)'),
    ]
    
    GRADE_POINTS_MAP = {
        'A+': 4.00, 'A': 4.00, 'A-': 3.75,
        'B+': 3.50, 'B': 3.00, 'B-': 2.75,
        'C+': 2.50, 'C': 2.00, 'C-': 1.75,
        'D': 1.00,
        'F': 0.00, 'I': None,
    }

    student = models.ForeignKey('Student', on_delete=models.CASCADE)
    course = models.ForeignKey('Course', on_delete=models.CASCADE)
    semester = models.ForeignKey('Semester', on_delete=models.CASCADE)
    grade = models.CharField(max_length=2, choices=GRADE_CHOICES, blank=True, null=True)
    points = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    entered_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='entered_grades')
    entered_at = models.DateTimeField(auto_now_add=True)
    is_published = models.BooleanField(default=False)
    published_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='published_grades')
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ['student', 'course', 'semester']

    def clean(self):
        """Validate that grade points don't exceed 4.00"""
        if self.points and float(self.points) > 4.00:
            raise ValidationError({
                'points': f'Grade points cannot exceed 4.00. Current value: {self.points}'
            })
        
        if self.grade and self.grade not in self.GRADE_POINTS_MAP:
            raise ValidationError({
                'grade': f'Invalid grade value: {self.grade}'
            })

    def save(self, *args, **kwargs):
        # Set points based on the updated grade options
        self.points = self.GRADE_POINTS_MAP.get(self.grade)
        
        # Validate before saving
        self.clean()
        
        # Set entered_at if not set
        if not self.entered_at:
            self.entered_at = timezone.now()
        
        # Set published info if being published
        if self.is_published and not self.published_at:
            self.published_at = timezone.now()
        
        super().save(*args, **kwargs)

    def get_grade_points(self):
        return self.GRADE_POINTS_MAP.get(self.grade)

    def get_grade_quality_points(self):
        if self.points is not None and self.course.credits:
            # Cap quality points calculation too
            capped_points = min(float(self.points), 4.00)
            return capped_points * self.course.credits
        return 0.0
    
    def __str__(self):
        points_display = self.points if self.points is not None else "N/A"
        return f"{self.student.student_id} - {self.course.code} - {self.grade} ({points_display})"

class DepartmentHead(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    department = models.OneToOneField(Department, on_delete=models.CASCADE)
    assigned_date = models.DateField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.user.get_full_name()} - {self.department.name}"

class CourseSlip(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    semester = models.ForeignKey(Semester, on_delete=models.CASCADE)
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE)
    courses = models.ManyToManyField(Course)
    assigned_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='assigned_course_slips')
    assigned_date = models.DateTimeField(auto_now_add=True)
    is_approved = models.BooleanField(default=False)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_course_slips')
    
    class Meta:
        unique_together = ['student', 'semester', 'academic_year']
    
    def __str__(self):
        return f"{self.student.student_id} - {self.semester.name} - {self.academic_year.name}"
    
    def total_credits(self):
        return sum(course.credits for course in self.courses.all())
    
    def department_courses(self):
        """Get courses that match student's department"""
        return self.courses.filter(department=self.student.department)
    
    def has_permission(self, user):
        """Check if user has permission to access this course slip"""
        if user.is_staff:
            return True
        # Students can only view their own course slips
        if hasattr(user, 'student') and user.student == self.student:
            return True
        # Department heads can view course slips from their department
        if hasattr(user, 'userrole') and user.userrole.role == 'department_head':
            return user.userrole.department == self.student.department
        return False
    
    @classmethod
    def has_list_permission(cls, user):
        """Check if user has permission to list course slips"""
        return user.is_authenticated and (user.is_staff or hasattr(user, 'student'))