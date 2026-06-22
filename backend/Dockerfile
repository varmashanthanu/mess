# Use a lightweight Python image
FROM python:3.12-slim

# Set environment variables
ENV PYTHONUNBUFFERED 1
ENV DJANGO_SETTINGS_MODULE config.settings.production
ENV ENV_FILENAME .env.prod
ENV PORT 8000

# Set the working directory in the container
WORKDIR /app/backend

# Install production dependencies
COPY requirements/production.txt /app/backend/requirements/production.txt
COPY requirements/base.txt /app/backend/requirements/base.txt
COPY .env.prod /app/backend/.env.prod
RUN pip install --no-cache-dir -r requirements/production.txt

# Copy the entire backend application
COPY . /app/backend

# Copy and set the entrypoint script
COPY docker-entrypoint.sh /app/backend/docker-entrypoint.sh
RUN chmod +x /app/backend/docker-entrypoint.sh

ENTRYPOINT ["/app/backend/docker-entrypoint.sh"]

# Collect static files
RUN python manage.py collectstatic --noinput

# Expose the port Gunicorn will listen on
EXPOSE 8000

# Add a healthcheck
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 CMD curl --fail http://localhost:$PORT/health/ || exit 1

# Run Gunicorn to serve the Django application
# Adjust the number of workers as per your server's CPU cores
# The `config.wsgi` should match your project's WSGI file location
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "4", "config.wsgi"]