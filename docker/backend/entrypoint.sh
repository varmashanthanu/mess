#!/bin/bash
set -e

echo "==> Waiting for database..."
until python -c "
import psycopg2, os, sys
try:
    psycopg2.connect(
        dbname=os.environ['POSTGRES_DB'],
        user=os.environ['POSTGRES_USER'],
        password=os.environ['POSTGRES_PASSWORD'],
        host=os.environ['POSTGRES_HOST'],
        port=os.environ.get('POSTGRES_PORT', 5432),
    )
    sys.exit(0)
except Exception:
    sys.exit(1)
"; do
    echo "   ...database not ready, retrying in 2s"
    sleep 2
done
echo "==> Database ready."

echo "==> Running migrations..."
python manage.py makemigrations
python manage.py migrate --noinput

echo "==> Collecting static files..."
python manage.py collectstatic --noinput

echo "==> Starting server..."
exec "$@"
