# Kitchen Store Requisition System

NestJS + Next.js inventory requisition app integrated with ERPNext/Frappe v15.

---

## Migrations

Migrations live in `apps/backend/src/database/migrations/` and run automatically on app startup (`migrationsRun: true`).

| # | File | Description |
|---|------|-------------|
| 0001 | `0001-init.ts` | Create core tables: users, user_warehouses, requisitions, requisition_items, warehouse_item_groups, app_settings |
| 0002 | `0002-warehouse-items-202603150915.ts` | Create warehouse_items table |
| 0003 | `0003-add-actual-closing-202603151100.ts` | Add actual_closing column to requisition_items |
| 0004 | `0004-add-store-note-202603151430.ts` | Add store_note column to requisitions |
| 0005 | `0005-store-vendor-202603161700.ts` | Create vendor order / receipt tables |
| 0006 | `0006-catalog-cache-20260317.ts` | Create supplier_list_cache and item_catalog_cache tables |
| 0007 | `0007-po-error-message-20260317.ts` | Add error_message column to vendor_order_po |
| 0008 | `0008-price-change-log-20260317.ts` | Create price_change_log table |
| 0009 | `0009-seed-fsrac-users-20260317.ts` | Seed FSRaC kitchen users and warehouse→item mappings (see below) |

---

## Migration 0009 — FSRaC Kitchen Users & Warehouse Items

### What it does

- Creates **10 Kitchen User accounts** whose source warehouse is `Stores - FSRaC`.
- Maps each user to their warehouse in `user_warehouses`.
- Seeds `warehouse_items` with the items each warehouse is allowed to request.
- All inserts use `ON CONFLICT DO NOTHING` — safe to re-run.
- Company is resolved at runtime from the `app_settings` table (falls back to `"Food Studio"`).

### Users created

| Username | Full Name | Warehouse | Email |
|---|---|---|---|
| `anybelly` | AnyBelly | AnyBelly - FSRaC | anybelly@foodstudio.local |
| `chinese-chinatown` | Chinese - China Town | Chinese - China Town - FSRaC | chinese-chinatown@foodstudio.local |
| `chinese-kitchen` | Chinese Kitchen | Chinese Kitchen - FSRaC | chinese-kitchen@foodstudio.local |
| `fb-raw-floor` | F&B Raw Material - FLOOR | F&B Raw Material - FLOOR - FSRaC | fb-raw-floor@foodstudio.local |
| `foodstudio-midnapore` | Food Studio Express Midnapore | Food Studio Express Midnapore - FSRaC | foodstudio-midnapore@foodstudio.local |
| `housekeeping` | House Keeping | House Keeping - FSRaC | housekeeping@foodstudio.local |
| `indian-kitchen` | Indian Kitchen | Indian Kitchen - FSRaC | indian-kitchen@foodstudio.local |
| `roll-chinatown` | Roll - China Town | Roll - China Town - FSRaC | roll-chinatown@foodstudio.local |
| `staff-foods` | Staff Foods | Staff Foods - FSRaC | staff-foods@foodstudio.local |
| `tandoor-kitchen` | Tandoor Kitchen | Tandoor Kitchen - FSRaC | tandoor-kitchen@foodstudio.local |

**Default password:** `Welcome@1234`
**Role:** `Kitchen User`
**Source warehouse:** `Stores - FSRaC`

> Change passwords after first login via the admin panel.

### Warehouse item coverage

| Warehouse | Items seeded | Status |
|---|---|---|
| AnyBelly - FSRaC | ~290 | Complete |
| Chinese - China Town - FSRaC | ~110 | Complete |
| Chinese Kitchen - FSRaC | ~180 | Complete |
| F&B Raw Material - FLOOR - FSRaC | ~85 | **Partial** — add remaining items via admin UI or follow-up migration |
| Food Studio Express Midnapore - FSRaC | 0 | **Pending** — add items via admin UI or follow-up migration |
| House Keeping - FSRaC | 0 | **Pending** |
| Indian Kitchen - FSRaC | 0 | **Pending** |
| Roll - China Town - FSRaC | 0 | **Pending** |
| Staff Foods - FSRaC | 0 | **Pending** |
| Tandoor Kitchen - FSRaC | 0 | **Pending** |

Items for the pending warehouses can be added at:
**Admin → Warehouse Items → select warehouse → add items**

---

## Default credentials

| Role | Username | Password |
|---|---|---|
| Admin | *(created via `/auth/bootstrap` on first run)* | *(set during bootstrap)* |
| Kitchen User (FSRaC) | see table above | `Welcome@1234` |


sers created (10 total) — all with:

Role: Kitchen User
Source warehouse: Stores - FSRaC
Default password: Welcome@1234 (bcrypt-hashed at runtime)
Company: resolved from app_settings table (falls back to "Food Studio")
Username	Full Name	Warehouse
anybelly	AnyBelly	AnyBelly - FSRaC
chinese-chinatown	Chinese - China Town	Chinese - China Town - FSRaC
chinese-kitchen	Chinese Kitchen	Chinese Kitchen - FSRaC
fb-raw-floor	F&B Raw Material - FLOOR	F&B Raw Material - FLOOR - FSRaC
foodstudio-midnapore	Food Studio Express Midnapore	Food Studio Express Midnapore - FSRaC
housekeeping	House Keeping	House Keeping - FSRaC
indian-kitchen	Indian Kitchen	Indian Kitchen - FSRaC
roll-chinatown	Roll - China Town	Roll - China Town - FSRaC
staff-foods	Staff Foods	Staff Foods - FSRaC
tandoor-kitchen	Tandoor Kitchen	Tandoor Kitchen - FSRaC
Warehouse items mapped:

AnyBelly - FSRaC: ~290 items ✅ complete
Chinese - China Town - FSRaC: ~110 items ✅ complete
Chinese Kitchen - FSRaC: ~180 items ✅ complete
F&B Raw Material - FLOOR - FSRaC: ~85 items ⚠️ partial (your message was truncated)
Food Studio Express Midnapore, House Keeping, Indian Kitchen, Roll - China Town, Staff Foods, Tandoor Kitchen: no items — the message was cut off before reaching these warehouses