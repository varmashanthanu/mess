# MESS Platform

**Freight brokerage & truck dispatching platform for Senegal.**
Connects shippers with carriers. Real-time GPS tracking, mobile money payments (Wave, Orange Money, Free Money), in-app messaging, and push notifications.

---

## Stack

| Layer | Technology |
|---|---|
| Backend API | Django 5.0 + Django REST Framework |
| Database | PostgreSQL 16 |
| Cache / Queues | Redis 7 + Celery |
| WebSockets | Django Channels 4 (over Redis) |
| Auth | JWT (djangorestframework-simplejwt) |
| Frontend (next) | Angular (PWA) |
| Containerization | Docker Compose |
| Payments | Wave, Orange Money, Free Money (XOF) |
| Maps | OpenStreetMap + Leaflet (abstracted) |

---

## Quick Start (Development)

### 1. Clone and configure

```bash
git clone <repo>
cd mess
cp .env.example .env
# Edit .env — at minimum set DJANGO_SECRET_KEY and POSTGRES_PASSWORD
```

### 2. Build and start

```bash
make build
make up
# Follow logs
make logs s=backend
```

The backend will:
- Wait for Postgres to be healthy
- Run all migrations
- Start Django's dev server on port 8000

### 3. Create superuser

```bash
make createsuperuser
```

### 4. Access

| URL | Description |
|---|---|
| `http://localhost:8000/api/docs/` | Swagger UI — all API endpoints |
| `http://localhost:8000/api/redoc/` | ReDoc documentation |
| `http://localhost:8000/admin/` | Django admin |

---

## Project Structure

```
mess/
├── backend/
│   ├── config/                  # Django project settings, urls, asgi, celery
│   │   └── settings/
│   │       ├── base.py          # Shared settings
│   │       ├── development.py   # Dev overrides
│   │       └── production.py    # Prod hardening + Sentry
│   ├── core/                    # Abstract models, permissions, pagination, utils
│   └── apps/
│       ├── accounts/            # Users, JWT auth, phone OTP, role profiles
│       ├── fleet/               # Vehicles, vehicle types, documents
│       ├── orders/              # Freight order lifecycle + bidding
│       ├── tracking/            # GPS pings, WebSocket driver stream
│       ├── payments/            # Transactions + Wave/OrangeMoney/FreeMoney
│       ├── messaging/           # Per-order chat (WebSocket + REST)
│       └── notifications/       # In-app, FCM push, SMS (Celery)
├── docker/
│   ├── backend/                 # Dockerfile + entrypoint.sh
│   ├── nginx/                   # Reverse proxy + static files
│   └── postgres/                # DB init script (extensions)
├── docker-compose.yml           # Production services
├── docker-compose.override.yml  # Development overrides (live reload)
├── .env.example
└── Makefile                     # make help for all commands
```

---

## Data Model Overview

```
User (phone-based auth)
  ├── ShipperProfile
  ├── DriverProfile       ← GPS location, availability
  └── BrokerProfile

Vehicle → VehicleType
  └── VehicleDocument (carte grise, insurance, etc.)

FreightOrder
  ├── OrderBid[]          ← Carriers compete with price bids
  ├── OrderAssignment     ← Accepted bid → driver assigned
  │     └── proof_photo, signature
  ├── GPSPing[]           ← Driver location stream
  ├── OrderRoute          ← Planned + actual GeoJSON routes
  ├── PaymentTransaction  ← Wave / Orange Money / Free Money
  └── Conversation
        └── Message[]     ← Text, voice, image

Notification
NotificationPreference
```

---

## Order Lifecycle

```
DRAFT → POSTED → BIDDING → ASSIGNED → PICKUP_PENDING
     → PICKED_UP → IN_TRANSIT → DELIVERED → COMPLETED
                                          → DISPUTED → RESOLVED/CANCELLED
```

---

## WebSocket Endpoints

| URL | Consumer | Auth |
|---|---|---|
| `ws://.../ws/tracking/driver/?token=<jwt>` | Driver streams GPS | JWT |
| `ws://.../ws/tracking/order/<order_id>/?token=<jwt>` | Watch order live | JWT |
| `ws://.../ws/messaging/<conversation_id>/?token=<jwt>` | Real-time chat | JWT |

---

## Payment Providers

All providers implement `BasePaymentProvider` in `apps/payments/providers/base.py`.

| Provider | Status | Notes |
|---|---|---|
| Wave | ✅ Implemented | Checkout redirect flow. Most popular in Senegal. |
| Orange Money | ✅ Implemented | Web Pay API. Good rural coverage. |
| Free Money | 🚧 Placeholder | Awaiting API documentation. |
| Cash on Delivery | ✅ Model only | No API needed. |

To add a new provider:
1. Create `apps/payments/providers/my_provider.py` extending `BasePaymentProvider`
2. Register it in `apps/payments/providers/__init__.py`
3. Add env vars to `.env.example` and `config/settings/base.py`

---

## API Reference (key endpoints)

### Auth
```
POST /api/v1/auth/register/           Register (triggers OTP)
POST /api/v1/auth/login/              Login → JWT pair
POST /api/v1/auth/token/refresh/      Refresh access token
POST /api/v1/auth/otp/verify/         Verify phone number
POST /api/v1/auth/logout/             Blacklist refresh token
```

### Orders
```
GET/POST /api/v1/orders/                   List / create orders
GET/PUT  /api/v1/orders/<id>/              Order detail / edit (DRAFT only)
POST     /api/v1/orders/<id>/post/         Publish draft to market
GET/POST /api/v1/orders/<id>/bids/         List bids / place bid
POST     /api/v1/orders/<id>/accept-bid/   Shipper accepts bid → assigns driver
POST     /api/v1/orders/<id>/proof-of-delivery/   Driver submits POD
POST     /api/v1/orders/<id>/confirm-delivery/    Shipper confirms receipt
POST     /api/v1/orders/<id>/rate/         Rate the delivery
```

### Tracking
```
GET  /api/v1/tracking/available-drivers/?lat=&lng=&radius_km=
GET  /api/v1/tracking/orders/<id>/pings/   GPS history for order
GET  /api/v1/tracking/orders/<id>/route/   Route GeoJSON
```

### Payments
```
POST /api/v1/payments/initiate/             Start mobile money payment
POST /api/v1/payments/webhook/<provider>/   Provider callback (public)
GET  /api/v1/payments/transactions/         Payment history
```

---

## Deployment (LXC / Proxmox staging)

The compose file is pre-tuned for 1 CPU / 2 GB RAM:
- PostgreSQL: `shared_buffers=256MB`, `max_connections=50`
- Redis: `maxmemory=256mb` with LRU eviction
- Gunicorn: 2 workers with `UvicornWorker` (ASGI for WebSocket support)
- Celery: 2 concurrent workers

```bash
# On the LXC container
git clone <repo>
cd mess
cp .env.example .env  # Fill in production values
docker compose up -d  # Uses production settings (no override file)
```

---

## Makefile Commands

```bash
make help          # Show all commands
make build         # Build images
make up            # Start dev environment
make down          # Stop everything
make logs s=backend
make migrate
make createsuperuser
make shell         # Django shell_plus
make test          # Run pytest
make lint          # flake8 + isort
make fmt           # black + isort
make db-backup     # Dump PostgreSQL to ./backups/
```
