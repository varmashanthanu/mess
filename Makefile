# ─────────────────────────────────────────────────────────────────
#  MESS Platform — Makefile
#  Usage: make <target>
# ─────────────────────────────────────────────────────────────────

DC        = docker compose
DC_PROD   = docker compose -f docker-compose.yml -f docker-compose.prod.yml
BACKEND   = $(DC) exec backend
MANAGE    = $(BACKEND) python manage.py

.PHONY: help build up down restart logs shell db-shell migrate makemigrations \
        createsuperuser test lint fmt seed collectstatic

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-22s\033[0m %s\n", $$1, $$2}'

# ─── Docker ──────────────────────────────────────────────────────
build:  ## Build all images
	$(DC) build

up:  ## Start all services (dev mode)
	$(DC) up -d

down:  ## Stop and remove containers
	$(DC) down

restart:  ## Restart a service: make restart s=backend
	$(DC) restart $(s)

logs:  ## Tail logs: make logs s=backend
	$(DC) logs -f $(s)

ps:  ## List running containers
	$(DC) ps

# ─── Django ──────────────────────────────────────────────────────
migrate:  ## Run pending migrations
	$(MANAGE) migrate

makemigrations:  ## Create migrations: make makemigrations app=orders
	$(MANAGE) makemigrations $(app)

createsuperuser:  ## Create admin superuser
	$(MANAGE) createsuperuser

shell:  ## Open Django shell_plus
	$(MANAGE) shell_plus

bash:  ## Open bash in backend container
	$(BACKEND) bash

collectstatic:  ## Collect static files
	$(MANAGE) collectstatic --noinput

seed:  ## Load seed/fixture data
	$(MANAGE) loaddata fixtures/initial_data.json

# ─── Database ────────────────────────────────────────────────────
db-shell:  ## Open psql shell
	$(DC) exec db psql -U $$POSTGRES_USER -d $$POSTGRES_DB

db-backup:  ## Dump database to ./backups/
	mkdir -p backups
	$(DC) exec db pg_dump -U $$POSTGRES_USER $$POSTGRES_DB > backups/backup_$$(date +%Y%m%d_%H%M%S).sql

# ─── Quality ─────────────────────────────────────────────────────
test:  ## Run test suite
	$(BACKEND) pytest --tb=short -q

lint:  ## Run flake8 + isort checks
	$(BACKEND) flake8 .
	$(BACKEND) isort --check-only .

fmt:  ## Auto-format with black + isort
	$(BACKEND) black .
	$(BACKEND) isort .

# ─── Production helpers ──────────────────────────────────────────
prod-up:  ## Start in production mode
	$(DC_PROD) up -d

prod-down:  ## Stop production
	$(DC_PROD) down
