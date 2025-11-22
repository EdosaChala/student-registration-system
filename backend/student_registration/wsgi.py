import os 
import sys 
 
from django.core.wsgi import get_wsgi_application 
 
# Create superuser on startup 
from django.contrib.auth import get_user_model 
try: 
    User = get_user_model() 
    if not User.objects.filter(username='admin').exists(): 
        User.objects.create_superuser('admin', 'admin@example.com', 'admin123') 
        print("Superuser created!") 
except Exception as e: 
    print(f"Superuser creation failed: {e}") 
 
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'student_registration.settings') 
 
application = get_wsgi_application() 
