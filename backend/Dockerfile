# Use a lightweight Python image
FROM python:3.9-slim-buster

# Set environment variables
ENV PYTHONUNBUFFERED 1
ENV DJANGO_SETTINGS_MODULE config.settings.production
ENV PORT 8000

# Set the working directory in the container
WORKDIR /app

# Install production dependencies
COPY backend/requirements/production.txt /app/backend/requirements/production.txt
COPY backend/requirements/base.txt /app/backend/requirements/base.txt
RUN pip install --no-cache-dir -r backend/requirements/production.txt

# Copy the entire backend application
COPY backend /app/backend

# Collect static files
RUN python backend/manage.py collectstatic --noinput

# Expose the port Gunicorn will listen on
EXPOSE 8000

# Add a healthcheck
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 CMD curl --fail http://localhost:$PORT/health/ || exit 1

# Run Gunicorn to serve the Django application
# Adjust the number of workers as per your server's CPU cores
# The `backend.config.wsgi` should match your project's WSGI file location
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "4", "backend.config.wsgi"]