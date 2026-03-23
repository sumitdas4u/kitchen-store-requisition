# Kitchen Store Requisition System

A full-stack inventory requisition and procurement management system built with **NestJS** + **Next.js**, integrated with **ERPNext / Frappe v15**.

Kitchen staff create requisitions, store managers issue items and place purchase orders, and admins oversee everything with dashboards, reports, and price management.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS, TypeORM, PostgreSQL, BullMQ, Redis |
| Frontend | Next.js 14, React 18, Tailwind CSS, Recharts, Radix UI |
| ERP | ERPNext / Frappe v15 (REST API) |
| Auth | JWT (passport-jwt), bcrypt |
| Infra | Docker Compose (Postgres 16, Redis 7) |

---

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- An ERPNext instance if you want live ERP sync from your local environment

### 1. Clone & install

```bash
git clone https://github.com/sumitdas4u/kitchen-store-requisition.git
cd kitchen-store-requisition
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` at the project root.

The checked-in example is safe for local development:
- `JWT_SECRET` already has a local-only default.
- ERP and WhatsApp values are optional.
- Docker host ports default to `5433` for Postgres and `6380` for Redis to avoid conflicts with existing local services.

```env
# App DB
DATABASE_URL=postgresql://kitchen:kitchen_pass@localhost:5433/kitchen_app

# Host ports exposed by Docker Compose
POSTGRES_HOST_PORT=5433
REDIS_HOST_PORT=6380
FRONTEND_PORT=3000
BACKEND_PORT=3001

# ERPNext (optional for local development)
ERP_BASE_URL=
ERP_API_KEY=
ERP_API_SECRET=

# JWT
JWT_SECRET=local-dev-jwt-secret
JWT_EXPIRES_IN=24h

# Redis
REDIS_HOST=localhost
REDIS_PORT=6380

# WhatsApp (optional)
WHATSAPP_API_URL=
WHATSAPP_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ADMIN_NUMBERS=
WHATSAPP_STORE_NUMBERS=

# Frontend
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001

# App
NODE_ENV=development
PORT=3001
```

### 3. Start development

**Option A** - Run everything natively:

```bash
# Terminal 1: Start Postgres + Redis in Docker
npm run dev:infra

# Terminal 2: Start backend (port 3001)
npm run dev:backend

# Terminal 3: Start frontend (port 3000)
npm run dev:frontend
```

Or all at once:

```bash
npm run dev
```

**Option B** - Run everything in Docker (recommended for team setup and moving between machines):

```bash
npm run dev:docker
```

App URLs:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`
- Postgres from host: `localhost:5433`
- Redis from host: `localhost:6380`

For a full multi-developer workflow, see [TEAM_SETUP.md](./TEAM_SETUP.md).

### 4. Bootstrap admin account

On first run, create your admin account:

```bash
curl -X POST http://localhost:3001/auth/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","full_name":"Admin","email":"admin@example.com","password":"your_password","company":"Food Studio"}'
```

### 5. Sync ERP data

After logging in as admin, go to **Admin > Data Sync** and click **Sync All** to pull master data (items, warehouses, item groups, companies, suppliers) from ERPNext into the local cache.

---

## Architecture

```
kitchen-store-requisition/
├── apps/
│   ├── backend/          # NestJS API (port 3001)
│   │   └── src/
│   │       ├── admin/        # Admin dashboard, reports, price management
│   │       ├── auth/         # JWT authentication & bootstrap
│   │       ├── kitchen/      # Kitchen requisition workflows
│   │       ├── store/        # Store issuing, vendor orders, purchase receipts
│   │       ├── erp/          # ERPNext API integration layer
│   │       ├── sync/         # ERP data sync (admin-triggered)
│   │       ├── requisition/  # Core requisition CRUD & state machine
│   │       ├── queue/        # BullMQ async job processing
│   │       ├── notifications/# WhatsApp notification service
│   │       ├── users/        # User management
│   │       └── database/
│   │           ├── entities/     # 24 TypeORM entities
│   │           └── migrations/   # 14 auto-run migrations
│   └── frontend/         # Next.js app (port 3000)
│       └── app/
│           ├── admin/        # Admin pages (dashboard, requisitions, reports, sync, etc.)
│           ├── kitchen/      # Kitchen pages (dashboard, create requisition, receive)
│           └── store/        # Store pages (dashboard, issue, vendor orders, receipts)
├── docker-compose.dev.yml
└── .env
```

---

## User Roles

| Role | Access | Key Actions |
|------|--------|-------------|
| **Admin** | `/admin/*` | Dashboard, manage users, view reports, price management, ERP sync, low stock alerts |
| **Kitchen User** | `/kitchen/*` | Create requisitions, track requisition status, receive issued items |
| **Store User** | `/store/*` | View & issue requisitions, create vendor orders, manage purchase receipts, stock transfers |

---

## ERP Data Caching

Master data from ERPNext is cached in local PostgreSQL tables for fast access. Sync is **admin-triggered only** (no automatic background sync) since this is historical/reference data.

| Cache Table | Source | Purpose |
|-------------|--------|---------|
| `erp_items_cache` | Item | Item master (code, name, group, UOM) |
| `erp_item_groups_cache` | Item Group | Product categories |
| `erp_warehouses_cache` | Warehouse | Warehouse locations |
| `erp_companies_cache` | Company | Company master |
| `erp_bin_stock_cache` | Bin | Stock levels per warehouse |
| `supplier_list_cache` | Supplier | Vendor / supplier list |
| `sync_log` | - | Audit trail of sync operations |

**How to sync:** Admin > Data Sync > click "Sync All" or sync individual entities.

Kitchen and Store pages read from local cache first, with automatic fallback to live ERPNext if cache is empty (before first sync).

---

## Migrations

All migrations run automatically on startup (`migrationsRun: true`). No manual steps needed.

| # | File | Description |
|---|------|-------------|
| 0001 | `0001-init.ts` | Core tables: users, user_warehouses, requisitions, requisition_items, warehouse_item_groups, app_settings |
| 0002 | `0002-warehouse-items-*.ts` | warehouse_items table |
| 0003 | `0003-add-actual-closing-*.ts` | actual_closing column on requisition_items |
| 0004 | `0004-add-store-note-*.ts` | store_note column on requisitions |
| 0005 | `0005-store-vendor-*.ts` | Vendor order & receipt tables |
| 0006 | `0006-catalog-cache-*.ts` | supplier_list_cache, item_catalog_cache |
| 0007 | `0007-po-error-message-*.ts` | error_message on vendor_order_pos |
| 0008 | `0008-price-change-log-*.ts` | price_change_log table |
| 0009 | `0009-seed-fsrac-users-*.ts` | Seed 10 FSRaC kitchen users + warehouse mappings |
| 0010 | `0010-seed-fsrac-items-*.ts` | Seed warehouse-item mappings for FSRaC warehouses |
| 0011 | `0011-stock-entry-cache-*.ts` | stock_entry_line_cache table |
| 0012 | `0012-purchase-price-cache-*.ts` | purchase_price_cache table |
| 0013 | `0013-seed-remaining-fsrac-items-*.ts` | Additional item seeds for remaining warehouses |
| 0014 | `0014-erp-cache-tables-*.ts` | ERP cache tables + sync_log |

---

## Seeded Data (FSRaC)

The migrations automatically seed kitchen users and warehouse-item mappings for the **Food Studio (FSRaC)** deployment. All inserts use `ON CONFLICT DO NOTHING` — safe to re-run.

### Kitchen Users (10)

All users have role **Kitchen User**, source warehouse **Stores - FSRaC**, and default password **`Welcome@1234`**.

| Username | Full Name | Warehouse |
|----------|-----------|-----------|
| `anybelly` | AnyBelly | AnyBelly - FSRaC |
| `chinese-chinatown` | Chinese - China Town | Chinese - China Town - FSRaC |
| `chinese-kitchen` | Chinese Kitchen | Chinese Kitchen - FSRaC |
| `fb-raw-floor` | F&B Raw Material - FLOOR | F&B Raw Material - FLOOR - FSRaC |
| `foodstudio-midnapore` | Food Studio Express Midnapore | Food Studio Express Midnapore - FSRaC |
| `housekeeping` | House Keeping | House Keeping - FSRaC |
| `indian-kitchen` | Indian Kitchen | Indian Kitchen - FSRaC |
| `roll-chinatown` | Roll - China Town | Roll - China Town - FSRaC |
| `staff-foods` | Staff Foods | Staff Foods - FSRaC |
| `tandoor-kitchen` | Tandoor Kitchen | Tandoor Kitchen - FSRaC |

> Change passwords after first login via Admin > Users.

### Warehouse Items

| Warehouse | Items Seeded |
|-----------|-------------|
| AnyBelly - FSRaC | ~290 |
| Chinese - China Town - FSRaC | ~110 |
| Chinese Kitchen - FSRaC | ~180 |
| F&B Raw Material - FLOOR - FSRaC | ~85 |
| Roll - China Town - FSRaC | seeded |
| Staff Foods - FSRaC | seeded |
| Tandoor Kitchen - FSRaC | seeded |
| Food Studio Express Midnapore - FSRaC | add via Admin > Warehouse Items |
| House Keeping - FSRaC | add via Admin > Warehouse Items |
| Indian Kitchen - FSRaC | add via Admin > Warehouse Items |

Additional items for any warehouse can be added at **Admin > Item Groups** or **Admin > Warehouse Items**.

---

## Default Credentials

| Role | Username | Password | Notes |
|------|----------|----------|-------|
| Admin | *(your choice)* | *(your choice)* | Created via `POST /auth/bootstrap` on first run |
| Kitchen Users | see table above | `Welcome@1234` | 10 pre-seeded users |
| Store User | *(create via Admin > Users)* | *(set during creation)* | Role: Store User |

---

## API Endpoints

### Auth
- `POST /auth/bootstrap` — Create first admin account
- `POST /auth/login` — Login (returns JWT)
- `GET /auth/me` — Current user info

### Kitchen (`/kitchen/*`) — requires Kitchen User role
- `GET /kitchen/items` — Items available for requisition
- `GET /kitchen/item-groups` — Item group list
- `GET /kitchen/stock` — Current stock levels
- `GET /kitchen/requisitions` — My requisitions
- `POST /kitchen/requisition` — Create requisition

### Store (`/store/*`) — requires Store User role
- `GET /store/requisitions` — Pending requisitions
- `POST /store/requisition/:id/issue` — Issue items
- `GET /store/stock/:warehouse` — Stock by warehouse
- `POST /store/vendor-order/create` — Create vendor order
- `GET /store/purchase-receipts/open-pos` — Open purchase orders
- `POST /store/purchase-receipts/create` — Create purchase receipt

### Admin (`/admin/*`) — requires Admin role
- `GET /admin/dashboard` — Dashboard KPIs
- `GET /admin/requisitions/enhanced` — Filtered requisition list
- `GET /admin/low-stock` — Low stock alerts
- `GET /admin/reports/*` — Consumption, aging, wastage, vendor performance, cost reports
- `GET /admin/prices/*` — Price lists, history, vendor price history
- `PUT /admin/prices/:item_code` — Update item price
- `GET /admin/sync/status` — Cache sync status
- `POST /admin/sync/trigger` — Trigger ERP data sync
- `GET /admin/sync/log` — Sync history

---

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start everything (infra + backend + frontend) |
| `npm run dev:infra` | Start Postgres + Redis via Docker |
| `npm run dev:backend` | Start NestJS in watch mode (port 3001) |
| `npm run dev:frontend` | Start Next.js dev server (port 3000) |
| `npm run dev:docker` | Run entire stack in Docker containers |
| `npm run dev:down` | Stop Docker containers |
| `npm run dev:reset` | Stop containers and delete volumes |
| `npm run build:backend` | Production build of backend |

---

## License

Private / proprietary.

