FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Copy project
COPY . .

# Create directories
RUN mkdir -p staticfiles media

EXPOSE 8000

# Direct command - no entrypoint script
CMD ["python", "backend/manage.py", "runserver", "0.0.0.0:8000"]