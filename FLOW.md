# Food Studio — Kitchen Store Requisition System
# Complete Technical Flow Documentation

> Generated from codebase analysis · March 2026

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Authentication & Session Flow](#2-authentication--session-flow)
3. [Requisition Lifecycle — Full State Machine](#3-requisition-lifecycle--full-state-machine)
4. [Kitchen Flow — Step by Step](#4-kitchen-flow--step-by-step)
5. [Store Flow — Step by Step](#5-store-flow--step-by-step)
6. [Kitchen Acceptance & Finalize Flow](#6-kitchen-acceptance--finalize-flow)
7. [Vendor Order & Purchase Receipt Flow](#7-vendor-order--purchase-receipt-flow)
8. [Background Job Flows (BullMQ)](#8-background-job-flows-bullmq)
9. [ERPNext Integration Flow](#9-erpnext-integration-flow)
10. [Admin Operations Flow](#10-admin-operations-flow)
11. [WhatsApp Notification Flow](#11-whatsapp-notification-flow)
12. [Data Model Relationships](#12-data-model-relationships)
13. [API Endpoint Map](#13-api-endpoint-map)
14. [Critical Corrections vs README](#14-critical-corrections-vs-readme)

---

## 1. System Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser / PWA                                                    │
│  Next.js 14  ·  App Router  ·  Tailwind CSS                      │
│                                                                   │
│  /kitchen/*     /store/*     /admin/*                            │
└───────────────────────┬──────────────────────────────────────────┘
                        │  REST  +  JWT (8h)
                        ▼
┌──────────────────────────────────────────────────────────────────┐
│  NestJS Backend  (port 3001)                                      │
│                                                                   │
│  auth/  requisition/  store/  kitchen/  admin/                    │
│  erp/   queue/        notifications/                              │
└────────┬─────────────────────────────────┬────────────────────────┘
         │                                 │
         ▼                                 ▼
┌─────────────────┐            ┌────────────────────────┐
│  PostgreSQL 16  │            │  ERPNext (Frappe v15)  │
│                 │            │  erp.food-studio.in     │
│  users          │            │                         │
│  requisitions   │            │  Item  (read)           │
│  req_items      │            │  Bin   (read)           │
│  user_warehouses│            │  Warehouse (read)       │
│  vendor_orders  │            │  Stock Entry (write)    │
│  vendor_receipts│            │  Purchase Order (write) │
│  app_settings   │            │  Stock Reconciliation   │
└─────────────────┘            └────────────────────────┘
         │
         ▼
┌─────────────────┐
│  Redis 7        │
│  BullMQ queues  │
│                 │
│  create-stock-entry         │
│  create-stock-reconciliation│
│  erp-write                  │
│  send-whatsapp              │
│  sync-items                 │
└─────────────────┘
```

---

## 2. Authentication & Session Flow

### Login

```
Browser                         NestJS /auth/login
  │                                    │
  ├──POST { username, password }──────►│
  │                                    │  1. Look up user by username in Postgres
  │                                    │  2. bcrypt.compare(password, password_hash)
  │                                    │     [rounds = 12]
  │                                    │  3. If no match → 401 Unauthorized
  │                                    │  4. Sign JWT with payload:
  │                                    │     { user_id, role, company,
  │                                    │       full_name, default_warehouse,
  │                                    │       source_warehouse }
  │                                    │     expires: 8h
  │◄── { access_token, user{...} } ───│
  │                                    │
  │  Store token in localStorage/      │
  │  sessionStorage                    │
```

### Bootstrap (first-time setup only)

```
POST /auth/bootstrap
  → Allowed ONLY when users table is empty
  → Creates first Admin user
  → Returns 403 on all subsequent calls
```

### JWT Guard on every protected route

```
Request → JwtStrategy.validate(payload)
  → Attach { user_id, role, company, default_warehouse, source_warehouse }
    to request as CurrentUser
  → @Roles() decorator checks role enum
```

### Role Enum

```
Kitchen User  →  Role.Kitchen
Store User    →  Role.Store
Admin         →  Role.Admin
```

---

## 3. Requisition Lifecycle — Full State Machine

```
                    ┌──────────┐
                    │  Draft   │◄─── Kitchen creates requisition
                    └────┬─────┘
                         │ PUT /requisition/:id/submit  (Kitchen)
                         ▼
                    ┌──────────┐
                    │Submitted │◄─── Store sees it in pending list
                    └────┬─────┘
                    │         │
       partial issue │         │ full issue
                     ▼         ▼
             ┌────────────┐  ┌────────┐
             │ Partially  │  │ Issued │
             │  Issued    │  └───┬────┘
             └─────┬──────┘      │
                   │             │  PUT /requisition/:id/confirm  (Kitchen)
                   │             │  PUT /requisition/:id/finalize (Kitchen)
                   │             ▼
                   │        ┌───────────┐
                   └───────►│ Completed │──► Stock Entry created in ERPNext (draft)
                            └───────────┘         │
                                                   ▼
                                         Admin approves in ERPNext
                                         → Stock moves in Bin

             ┌───────────┐
             │ Rejected  │◄─── Store/Admin rejects  OR  Kitchen cancels
             └───────────┘     (status set to Rejected in both cases)

             ┌───────────┐
             │ Disputed  │   (status enum exists, not yet wired to an endpoint)
             └───────────┘
```

### Item-level status (requisition_items.item_status)

```
Pending
  ├─ issued_qty == requested_qty  →  Issued
  ├─ issued_qty > 0               →  Partially Issued
  └─ issued_qty == 0              →  Rejected
```

### Requisition status after issue()

```
All items issued fully  →  Issued
Any item under-issued   →  Partially Issued
```

### Requisition status after confirm()

```
After kitchen confirms received_qty → status = Partially Issued
(stays in "work in progress" loop; finalize() moves it to Completed)
```

---

## 4. Kitchen Flow — Step by Step

### Step 1 — Create Requisition (Draft)

```
Kitchen User                          Backend                         ERPNext
     │                                    │                              │
     ├── Opens /kitchen/create-requisition│                              │
     │                                    │                              │
     │   (Page loads item list from       │                              │
     │    kitchen.service → warehouse     │                              │
     │    item groups filtered by         │                              │
     │    user.default_warehouse)         │                              │
     │                                    │                              │
     │   For each item, user enters:      │                              │
     │   • closing_stock   (ERP Bin qty)  │                              │
     │   • actual_closing  (real count)   │                              │
     │   • order_qty       (how much to   │                              │
     │                      request)      │                              │
     │                                    │                              │
     ├── POST /requisition ──────────────►│                              │
     │   { requested_date, shift,         │                              │
     │     notes, items[{item_code,       │                              │
     │     item_name, uom, closing_stock, │                              │
     │     actual_closing, order_qty}] }  │                              │
     │                                    │  buildItems():               │
     │                                    │  • requested_qty = order_qty │
     │                                    │  • issued_qty = 0            │
     │                                    │  • received_qty = 0          │
     │                                    │  • item_status = 'Pending'   │
     │                                    │  • filter: qty>0 OR          │
     │                                    │    actual_closing != null    │
     │                                    │                              │
     │                                    │  Save to Postgres:           │
     │                                    │  requisitions (status=Draft) │
     │                                    │  requisition_items           │
     │◄── { id, status:'Draft', items }──│                              │
```

### Step 2 — Edit Draft (optional)

```
PUT /requisition/:id  (Kitchen only, Draft status required)
  → Deletes existing items
  → Saves new items
  → Updates date/shift/notes
```

### Step 3 — Delete Draft (optional)

```
PUT /requisition/:id/delete  (Kitchen only, Draft status required)
  → Deletes all items
  → Deletes requisition record
```

### Step 4 — Submit Requisition

```
Kitchen User                          Backend                         ERPNext / Queue
     │                                    │                              │
     ├── PUT /requisition/:id/submit ────►│                              │
     │                                    │  Validate: status == Draft   │
     │                                    │  Set status = Submitted      │
     │                                    │  Set submitted_at = NOW()    │
     │                                    │  Save to Postgres            │
     │                                    │                              │
     │                                    │  Notify via WebSocket:       │
     │                                    │  notifyStatusChange(id,      │
     │                                    │  'Submitted')                │
     │                                    │                              │
     │                                    │  Check: any item where       │
     │                                    │  actual_closing != closing_  │
     │                                    │  stock?                      │
     │                                    │    YES → enqueue             │
     │                                    │    CreateStockReconciliation │
     │                                    │    job (see §8)              │
     │◄── { ok:true, status:'Submitted' }│                              │
```

---

## 5. Store Flow — Step by Step

### Store sees pending requisitions

```
GET /requisition  (Store User)
  → listForStore():
    Filter: status IN (Submitted, Partially Issued)
    Filter: req has items with requested_qty > 0
    Filter: req has items where requested_qty > received_qty
    Order: requested_date DESC
```

### Issue items (single requisition)

```
Store User                            Backend                         ERPNext
     │                                    │                              │
     │   Opens /store/issue/:id           │                              │
     │   Sees item list with:             │                              │
     │   • requested_qty (kitchen asked)  │                              │
     │   • issued_qty (already issued)    │                              │
     │   • bin stock (from ERP)           │                              │
     │                                    │                              │
     ├── PUT /requisition/:id/issue ─────►│                              │
     │   { store_note, items: [{          │                              │
     │     item_code, issued_qty }] }     │                              │
     │                                    │  Validate:                   │
     │                                    │  status IN (Submitted,       │
     │                                    │  Partially Issued)           │
     │                                    │                              │
     │                                    │  For each item:              │
     │                                    │  nextIssued = existing +     │
     │                                    │               delta          │
     │                                    │  nextIssued > requested_qty? │
     │                                    │    → 400 BadRequest          │
     │                                    │                              │
     │                                    │  item_status:                │
     │                                    │  • nextIssued == requested   │
     │                                    │    → 'Issued'                │
     │                                    │  • nextIssued > 0            │
     │                                    │    → 'Partially Issued'      │
     │                                    │  • nextIssued == 0           │
     │                                    │    → 'Rejected'              │
     │                                    │                              │
     │                                    │  Requisition status:         │
     │                                    │  allIssued? → Issued         │
     │                                    │  else → Partially Issued     │
     │                                    │                              │
     │                                    │  Save requisition + items    │
     │                                    │  Set issued_at = NOW()       │
     │                                    │  Set store_note              │
     │                                    │                              │
     │                                    │  Notify WebSocket            │
     │◄── { ok:true, status }────────────│                              │
```

### Get bin stock for store

```
GET /store/stock?warehouse=Main Store - FS
  → erpService.getBinStock(warehouse)
  → ERPNext: GET /api/resource/Bin
    ?fields=["item_code","actual_qty","valuation_rate","warehouse"]
    &filters=[["warehouse","=","Main Store - FS"]]
  → Missing Bin row = qty 0 (not an error)
```

### Reject a requisition

```
PUT /requisition/:id/reject  (Store User or Admin)
  Body: { reason? }
  → Sets status = Rejected
  → Sets notes = reason
```

---

## 6. Kitchen Acceptance & Finalize Flow

### Confirm received items

```
Kitchen User                          Backend                         Queue / ERPNext
     │                                    │                              │
     │   After store issues items,        │                              │
     │   kitchen opens /kitchen/receive/:id│                             │
     │                                    │                              │
     ├── PUT /requisition/:id/confirm ───►│                              │
     │   { items: [{                      │                              │
     │     item_code,                     │                              │
     │     received_qty,                  │                              │
     │     action: 'accept'|'reject'|null │                              │
     │   }] }                             │                              │
     │                                    │  Validate:                   │
     │                                    │  status IN (Submitted,       │
     │                                    │  Issued, Partially Issued)   │
     │                                    │                              │
     │                                    │  action == 'accept':         │
     │                                    │   desired = issued_qty       │
     │                                    │  action == 'reject':         │
     │                                    │   desired = existing         │
     │                                    │             received_qty     │
     │                                    │  action == null:             │
     │                                    │   desired = received_qty     │
     │                                    │   (from body)                │
     │                                    │                              │
     │                                    │  nextReceived = max(existing,│
     │                                    │                    desired)  │
     │                                    │                              │
     │                                    │  item_status recalc:         │
     │                                    │  • received <= 0 → Rejected  │
     │                                    │  • received < requested      │
     │                                    │    → Partially Issued        │
     │                                    │  • else → Issued             │
     │                                    │                              │
     │                                    │  Status → Partially Issued   │
     │                                    │  completed_at = null         │
     │◄── { ok:true, status }────────────│                              │
```

### Finalize (close the loop)

```
Kitchen User                          Backend                         Queue / ERPNext
     │                                    │                              │
     ├── PUT /requisition/:id/finalize ──►│                              │
     │                                    │  Validate:                   │
     │                                    │  status IN (Issued,          │
     │                                    │  Partially Issued)           │
     │                                    │                              │
     │                                    │  Status → Completed          │
     │                                    │  completed_at = NOW()        │
     │                                    │  Save to Postgres            │
     │                                    │                              │
     │                                    │  hasReceived = any item      │
     │                                    │  where received_qty > 0?     │
     │                                    │                              │
     │                                    │    YES → enqueue             │
     │                                    │    CreateStockEntry job      │
     │                                    │    (see §8)                  │
     │◄── { ok:true, status:'Completed' }│                              │
     │                                    │                              │
     │                             [BullMQ processes async]             │
     │                                    │                              │
     │                                    │──────────────────────────────►│
     │                                    │  POST /api/resource/         │
     │                                    │  Stock Entry                 │
     │                                    │  {                           │
     │                                    │    docstatus: 0 (DRAFT)      │
     │                                    │    stock_entry_type:         │
     │                                    │      "Material Transfer"     │
     │                                    │    from_warehouse: Main Store│
     │                                    │    to_warehouse: Kitchen     │
     │                                    │    remarks: "KR-{id} | ..."  │
     │                                    │    items: [received items]   │
     │                                    │    s_warehouse + t_warehouse │
     │                                    │    on each item              │
     │                                    │  }                           │
     │                                    │◄── { name: "STE-00001" } ───│
     │                                    │                              │
     │                                    │  Save stock_entry = STE-xxx  │
     │                                    │  on requisition record       │
```

### Cancel (kitchen side)

```
PUT /requisition/:id/cancel  (Kitchen User)
  Body: { reason? }
  Valid from: Submitted, Issued, Partially Issued
  → Sets status = Rejected
  → Sets notes = reason
```

---

## 7. Vendor Order & Purchase Receipt Flow

### Shortage Analysis

```
Store User                            Backend                         ERPNext
     │                                    │                              │
     ├── GET /store/shortage?warehouse=──►│                              │
     │                                    │  1. listForStore()           │
     │                                    │     → pending requisitions   │
     │                                    │                              │
     │                                    │  2. Build itemMap:           │
     │                                    │     needed_qty = Σ           │
     │                                    │     (requested - issued)     │
     │                                    │     across all pending reqs  │
     │                                    │                              │
     │                                    │  3. Parallel fetch:          │
     │                                    │     • getBinStock(warehouse) │
     │                                    │     • getItemSuppliers(codes)│
     │                                    │     • getItemDefaults(codes) │
     │                                    │     • vendorOverrides (DB)   │
     │                                    │     • getItemStatuses(codes) │
     │                                    │     • lastPurchasePriceMap   │
     │                                    │       (from PO receipts)     │
     │                                    │                              │
     │                                    │  4. Vendor priority:         │
     │                                    │     manual override          │
     │                                    │     > erp_receipt override   │
     │                                    │     > item default supplier  │
     │                                    │     > first linked supplier  │
     │                                    │                              │
     │                                    │  5. shortfall =              │
     │                                    │     max(0, needed - stock)   │
     │                                    │                              │
     │◄── [{ item_code, needed_qty,       │                              │
     │       stock_qty, shortfall,        │                              │
     │       price, vendor_id }]─────────│                              │
```

### Refresh Vendor Mapping from ERP Receipts

```
POST /store/vendor-mapping/refresh
  → Scans last 12 months of Purchase Receipts from ERPNext
  → Parallel fetch (max 5 concurrent) of receipt details
  → Counts supplier frequency per item_code
  → Picks most frequent supplier (tie-break: latest date → alpha name)
  → Filters out disabled items
  → Upserts vendor_item_overrides with source='erp_receipt'
  → Returns { updated: N }
```

### Create Vendor Order (with auto PO creation)

```
Store User                            Backend                         ERPNext
     │                                    │                              │
     ├── POST /store/vendor-orders ──────►│                              │
     │   { lines: [{ item_code,           │                              │
     │     vendor_id, qty, price,         │                              │
     │     is_manual }] }                 │                              │
     │                                    │  1. Create vendor_order      │
     │                                    │     record (status='draft')  │
     │                                    │                              │
     │                                    │  2. Save vendor_order_lines  │
     │                                    │                              │
     │                                    │  3. Group lines by vendor_id │
     │                                    │                              │
     │                                    │  4. For each vendor:         │
     │                                    │────────────────────────────►  │
     │                                    │  POST /api/resource/         │
     │                                    │  Purchase Order              │
     │                                    │  { supplier, company,        │
     │                                    │    set_warehouse,            │
     │                                    │    transaction_date,         │
     │                                    │    schedule_date, items[] }  │
     │                                    │◄── { name: "PO-xxxxx" } ────│
     │                                    │                              │
     │                                    │  PUT /api/resource/          │
     │                                    │  Purchase Order/PO-xxxxx     │
     │                                    │  { docstatus: 1 }  ← SUBMIT  │
     │                                    │────────────────────────────►  │
     │                                    │                              │
     │                                    │  5. Save vendor_order_pos    │
     │                                    │  6. Update vendor_order      │
     │                                    │     status = 'po_created'    │
     │◄── { vendor_order_id, POs[] } ────│                              │
```

### Create Purchase Receipt

```
Store User                            Backend                         ERPNext
     │                                    │                              │
     ├── POST /store/purchase-receipts ──►│                              │
     │   { po_id, vendor_id,              │                              │
     │     lines: [{item_code, qty}] }    │                              │
     │                                    │  1. GET Purchase Order       │
     │                                    │     from ERPNext             │
     │                                    │                              │
     │                                    │  2. POST Purchase Receipt    │
     │                                    │     { supplier, purchase_    │
     │                                    │       order, items[] }       │
     │                                    │◄── { name: "GRNI-xxxxx" }───│
     │                                    │                              │
     │                                    │  3. PUT docstatus:1 (SUBMIT) │
     │                                    │                              │
     │                                    │  4. Save vendor_receipt +    │
     │                                    │     vendor_receipt_lines     │
     │                                    │     in local DB              │
     │◄── { receipt_id } ────────────────│                              │
```

### WhatsApp share for vendor orders (client-side)

```
After PO created → frontend builds message:
  "*Purchase Order — Food Studio*
   PO No: *PO-20250316-142*
   Vendor: *Poultry House*
   Date: 16 Mar, 2025

   Items:
   • Chicken Breast: *6 Kg* @ ₹280 = *₹1,680*
   ...
   *Total: ₹2,340*"

navigator.share(msg) OR window.open("https://wa.me/?text="+encodeURIComponent(msg))
  ← client-side only, no server API call
```

---

## 8. Background Job Flows (BullMQ)

### Queue Names (from constants.ts)

```
CreateStockEntry          → creates draft Stock Entry in ERPNext
CreateStockReconciliation → creates + submits Stock Reconciliation in ERPNext
ErpWrite                  → generic ERP write jobs
SendWhatsapp              → WhatsApp Business API notifications
SyncItems                 → item synchronization
```

### CreateStockEntry Job

```
Trigger: finalize() when any item has received_qty > 0

Job data: { requisitionId: string }

Process:
  1. Load requisition + items from Postgres
  2. Build ERPNext payload:
     {
       doctype: "Stock Entry",
       stock_entry_type: "Material Transfer",
       company: requisition.company,
       docstatus: 0,                         ← ALWAYS DRAFT
       from_warehouse: source_warehouse,
       to_warehouse: warehouse (kitchen),
       remarks: "KR-{id} | {kitchen} | {date}",
       items: [
         ...items.filter(received_qty > 0).map({
           item_code, item_name, qty: received_qty,
           uom, stock_uom, conversion_factor: 1,
           s_warehouse: source_warehouse,     ← REQUIRED on item level
           t_warehouse: kitchen_warehouse     ← REQUIRED on item level
         })
       ]
     }
  3. POST to ERPNext → get Stock Entry name (STE-xxxxx)
  4. Save stock_entry = STE-xxxxx on requisition

Retry strategy: 5 attempts, exponential backoff starting 2s
```

### CreateStockReconciliation Job

```
Trigger: submit() when any item has actual_closing != closing_stock

Job data: { requisitionId: string }

Process:
  1. Load requisition + items from Postgres
  2. Filter items where:
     • actual_closing is not null
     • actual_closing != closing_stock
  3. Build payload:
     {
       doctype: "Stock Reconciliation",
       company: requisition.company,
       docstatus: 0,
       purpose: "Stock Reconciliation",
       items: [{ item_code, warehouse: kitchen, qty: actual_closing }]
     }
  4. POST to ERPNext → draft Stock Reconciliation
  5. PUT docstatus:1 → SUBMIT immediately (unlike Stock Entry)
     ^ This is auto-submitted, not left as draft

Retry strategy: 5 attempts, exponential backoff starting 2s
```

---

## 9. ERPNext Integration Flow

### Connection & Auth

```
Axios client (singleton per service start):
  baseURL = ERP_BASE_URL (from .env or overridden by app_settings.erp_base_url)
  Authorization = "token {ERP_API_KEY}:{ERP_API_SECRET}"
  ← NOT "Bearer" — the keyword is literally "token"
  timeout = 15000ms
  axiosRetry: 3 retries, exponential delay, network/idempotent errors only
```

### Key ERPNext reads (ErpService methods)

| Method | ERPNext endpoint | Notes |
|--------|-----------------|-------|
| `listCompanies()` | GET /api/resource/Company | |
| `listWarehouses(company)` | GET /api/resource/Warehouse | filter by company |
| `listItems(itemGroup?)` | GET /api/resource/Item | fetch all, filter disabled in JS |
| `getBinStock(warehouse)` | GET /api/resource/Bin | missing row = qty 0 |
| `listSuppliers()` | GET /api/resource/Supplier | |
| `getItemSuppliers(codes)` | GET /api/resource/Item Supplier | |
| `getItemDefaults(codes)` | GET /api/resource/Item Default | default_supplier field |
| `searchItems(query)` | GET /api/resource/Item | name/item_name search |
| `listPurchaseReceipts()` | GET /api/resource/Purchase Receipt | date range filter |
| `getPurchaseOrder(id)` | GET /api/resource/Purchase Order/{id} | |

### Key ERPNext writes

| Method | ERPNext endpoint | docstatus |
|--------|-----------------|-----------|
| `createStockEntryDraft()` | POST /api/resource/Stock Entry | 0 (draft) |
| `createPurchaseOrder()` | POST /api/resource/Purchase Order | 0 then PUT docstatus:1 |
| `submitPurchaseOrder()` | PUT /api/resource/Purchase Order/:id | docstatus: 1 |
| `createPurchaseReceipt()` | POST /api/resource/Purchase Receipt | 0 then submit |
| `submitPurchaseReceipt()` | PUT /api/resource/Purchase Receipt/:id | docstatus: 1 |
| `createStockReconciliationDraft()` | POST /api/resource/Stock Reconciliation | 0 then submit |
| `submitStockReconciliation()` | PUT /api/resource/Stock Reconciliation/:id | docstatus: 1 |

### Error handling patterns

```
isFilterFieldError()
  Detects: "Field not permitted in query" / "Unknown column" / "Invalid field"
  Used to fall back to fetching all records and filtering in JS
  (e.g. disabled field cannot be used in ERPNext filters)

isPermissionError()
  Detects: 403 / "PermissionError"
  Logged + empty array returned

throwErpError()
  Extracts detail from exception/message/error fields
  Throws BadGatewayException with ERP error text
```

### ERPNext API Coding Standards

#### Always paginate with a while loop

ERPNext REST API returns at most `limit_page_length` records per request (default 20,
max 500). A single request silently truncates results. **All list fetches must use a
pagination loop.**

```typescript
// ✅ CORRECT — paginate until ERPNext returns fewer records than the page size
const PAGE_SIZE = 500;
const results: T[] = [];
let start = 0;

while (true) {
  const { data } = await this.client.get('/api/resource/SomeDoctype', {
    params: {
      fields: JSON.stringify(['name', 'field_a', 'field_b']),
      filters: JSON.stringify([/* your filters */]),
      limit_start: start,
      limit_page_length: PAGE_SIZE,
    },
  });

  const page: T[] = data?.data ?? [];
  results.push(...page);

  if (page.length < PAGE_SIZE) break;   // last page reached
  start += PAGE_SIZE;
}

return results;

// ❌ WRONG — single request, silently loses records beyond the limit
const { data } = await this.client.get('/api/resource/SomeDoctype', {
  params: { fields: '["name"]' },
});
return data.data;
```

---

## 10. Admin Operations Flow

### User Management

```
GET    /admin/users           → list all users with warehouses
POST   /admin/users           → create user (bcrypt hash password, rounds 12)
PUT    /admin/users/:id       → update user (role, warehouses, company, etc.)
DELETE /admin/users/:id       → soft delete (is_active = false)
```

### Warehouse Item Group Mapping

```
GET /admin/item-groups?warehouse=   → warehouse_item_groups for warehouse
POST /admin/item-groups             → assign item group to warehouse
DELETE /admin/item-groups/:id       → remove mapping
```

### Stock Entry Management (ERPNext draft approvals)

```
GET  /admin/stock-entries           → list draft Stock Entries from ERPNext
POST /admin/stock-entries/:name/approve
  → PUT docstatus:1 on ERPNext
  → Stock physically moves in Bin
```

### App Settings

```
GET /admin/settings             → erp_base_url, company list
PUT /admin/settings             → update erp_base_url
  → Overrides the client.defaults.baseURL in ErpService (ensureBaseUrl())
```

### Resolve disputed requisition

```
PUT /requisition/:id/resolve  (Admin only)
  → Sets status = Completed
  → Sets completed_at = NOW()
  (skips the finalize/stock-entry creation step)
```

---

## 11. WhatsApp Notification Flow

### Server-side (NestJS → Meta Cloud API)

```
POST https://graph.facebook.com/v18.0/{WHATSAPP_PHONE_NUMBER_ID}/messages
Headers: Authorization: Bearer {WHATSAPP_API_TOKEN}
Body: {
  messaging_product: "whatsapp",
  to: "91{phone}",          ← 91 prefix added server-side
  type: "text",
  text: { body: message }
}
```

### Client-side vendor orders

```
navigator.share({ title, text: message })
  OR
window.open("https://wa.me/?text=" + encodeURIComponent(message), "_blank")
  ← Opens user's own WhatsApp (no server API)
  ← Phone numbers stored without country code; wa.me link prepends 91
```

### Notification triggers

| Event | Who | Channel |
|-------|-----|---------|
| Requisition submitted | Store team group | Server-side API |
| Stock issued | Kitchen user | Server-side API |
| Stock Entry approved | Store user | Server-side API |
| Vendor order placed | Vendor (per vendor) | Client-side wa.me |

---

## 12. Data Model Relationships

```
users (1) ──────────────── (*) user_warehouses
  │                              warehouse VARCHAR
  │
  │ (1)
  │
  ▼ (*)
requisitions
  id, user_id, warehouse (kitchen),
  source_warehouse (Main Store),
  company, requested_date, shift,
  status, store_note,
  stock_entry (STE-xxxxx),
  submitted_at, issued_at, completed_at
  │
  │ (1)
  │
  ▼ (*)
requisition_items
  item_code, item_name, uom,
  closing_stock,      ← ERP Bin qty at time of creation
  actual_closing,     ← Real physical count (kitchen entered)
  required_qty,
  requested_qty,      ← What kitchen asked for (order_qty)
  issued_qty,         ← What store issued
  received_qty,       ← What kitchen confirmed receiving
  item_status

warehouse_item_groups
  warehouse, item_group, company
  → Controls which items appear on kitchen requisition form

vendor_orders (1) ─────── (*) vendor_order_lines
  status: 'draft' | 'po_created'    item_code, vendor_id, qty, price
  created_by (user_id)

vendor_orders (1) ─────── (*) vendor_order_pos
                               vendor_id, po_id, status

vendor_receipts (1) ──── (*) vendor_receipt_lines
  vendor_id, po_id, receipt_id    item_code, qty

vendor_item_overrides
  item_code, vendor_id, vendor_name,
  source: 'manual' | 'erp_receipt'
  → Priority: manual > erp_receipt > ERP item default > ERP supplier link

app_settings
  id=1 (always single row),
  erp_base_url (overrides ERP_BASE_URL env var if set)
```

---

## 13. API Endpoint Map

### Auth

```
POST /auth/login              Public
POST /auth/bootstrap          Public (403 after first use)
```

### Requisition

```
POST   /requisition                Kitchen  → createDraft
PUT    /requisition/:id            Kitchen  → updateDraft
PUT    /requisition/:id/delete     Kitchen  → deleteDraft
PUT    /requisition/:id/submit     Kitchen  → submit
PUT    /requisition/:id/confirm    Kitchen  → confirm (received qty)
PUT    /requisition/:id/finalize   Kitchen  → finalize → triggers Stock Entry
PUT    /requisition/:id/cancel     Kitchen  → cancelByKitchen → Rejected
PUT    /requisition/:id/issue      Store    → issue items
PUT    /requisition/:id/reject     Store/Admin → reject
PUT    /requisition/:id/resolve    Admin    → resolve → Completed
GET    /requisition                All      → list (filtered by role)
GET    /requisition/:id            All      → getOne
```

### Store

```
GET  /store/requisitions               Store  → pending reqs
GET  /store/stock?warehouse=           Store  → ERPNext bin stock
GET  /store/shortage?warehouse=        Store  → shortage analysis
GET  /store/suppliers                  Store  → ERPNext suppliers
GET  /store/vendor-overrides           Store  → vendor_item_overrides
POST /store/vendor-overrides           Store  → save manual override
POST /store/vendor-mapping/refresh     Store  → refresh from ERP receipts
POST /store/vendor-orders              Store  → create order + POs in ERP
GET  /store/vendor-orders/history      Store  → past orders
GET  /store/purchase-orders/open       Store  → open POs from ERP
POST /store/purchase-receipts          Store  → receive goods + submit in ERP
```

### Admin

```
GET    /admin/users                    Admin  → list users
POST   /admin/users                    Admin  → create user
PUT    /admin/users/:id                Admin  → update user
DELETE /admin/users/:id                Admin  → soft delete
GET    /admin/item-groups?warehouse=   Admin  → warehouse item groups
POST   /admin/item-groups              Admin  → add item group
DELETE /admin/item-groups/:id          Admin  → remove item group
GET    /admin/stock-entries            Admin  → draft STE list
POST   /admin/stock-entries/:name/approve  Admin → submit in ERP
GET    /admin/settings                 Admin  → app settings
PUT    /admin/settings                 Admin  → update settings
```

---

## 14. Critical Corrections vs README

The following details differ between the README and the actual code:

| README says | Code actually does |
|-------------|-------------------|
| Stock Entry created at Store Issue | Stock Entry created at `finalize()` (after kitchen confirms) |
| Shift: 'Morning' \| 'Night' | Shift enum: `Morning` \| `Evening` |
| Status: Draft→Submitted→Partially Issued→Issued→Completed | Same PLUS `Disputed` status exists in enum |
| `confirm()` → Completed | `confirm()` → stays at Partially Issued; `finalize()` → Completed |
| Schema shows no `actual_closing` field | `actual_closing` field exists on req_items; triggers Stock Reconciliation |
| Schema shows no `store_note` field | `store_note` field exists on requisitions |
| No `vendor_receipts` tables | vendor_receipt + vendor_receipt_lines tables in migration 0005 |
| No `warehouse_items` table | warehouse_items table in migration 0002 |
| Stock Reconciliation not mentioned | Created + auto-submitted when actual_closing differs from closing_stock |
| Purchase Orders created as draft | POs created AND immediately submitted (docstatus:1) |
| Purchase Receipts not documented | Full PR flow: create draft → submit → save locally |
| `cancelByKitchen` not documented | Kitchen can cancel Submitted/Issued/Partially Issued → sets to Rejected |
| No `resolve` endpoint | Admin can resolve any req → Completed (bypasses normal flow) |

---

*End of Flow Documentation*
