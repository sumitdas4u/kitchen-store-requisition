# Restaurant Inventory Requisition System - Navigation Guide

## Overview

This is a comprehensive restaurant inventory requisition system integrated with ERPNext, featuring three distinct user roles with optimized interfaces.

## User Roles & Access

### 1. Kitchen Staff (Mobile-First)
**Entry Point:** `/kitchen/login`

**Navigation Flow:**
- Login → Kitchen Dashboard
- Dashboard Cards:
  - Create New Requisition → Item entry form
  - Pending Items → View and receive issued items
  - Received Today → History view

**Key Features:**
- Large touch-friendly controls
- Quick item requisition entry
- Closing stock & required quantity inputs
- Auto-calculated requested quantities
- Accept/Reject issued items

**Bottom Navigation:**
- Dashboard
- Requisitions
- History
- Profile

---

### 2. Store Manager (Mobile/Tablet)
**Entry Point:** `/store/login`

**Navigation Flow:**
- Login → Store Dashboard
- Dashboard Cards:
  - Pending Requisitions → List of all pending requests
  - Items Issued Today → Summary of issued items
  - Low Stock Items → Inventory alerts

**Key Features:**
- View requisitions by kitchen
- Issue items with quantity control
- Quick-issue or partial-issue capabilities
- Issue summary and tracking

**Bottom Navigation:**
- Dashboard
- Requisitions
- Issued
- Profile

---

### 3. Administrator (Desktop)
**Entry Point:** `/admin`

**Navigation Flow:**
- Sidebar Navigation:
  - Dashboard (Overview with charts)
  - Kitchens (Kitchen management)
  - Item Groups (Item group mapping)
  - Users (User management)
  - ERP Integration (ERPNext configuration)
  - Settings

**Key Features:**
- Analytics dashboard with charts
- Kitchen and item group mapping
- User role management
- ERPNext API configuration
- System settings

---

## Quick Start Guide

1. **Start on Landing Page:** Visit `/` to see all user type options
2. **Choose Your Role:**
   - Kitchen Staff → `/kitchen/login`
   - Store Manager → `/store/login`
   - Administrator → `/admin`

## Main Workflows

### Kitchen Workflow
1. Login as kitchen staff
2. Click "Create New Requisition"
3. Enter closing stock and required quantities
4. System auto-calculates request amounts
5. Submit requisition
6. Monitor pending items
7. Accept/reject issued items when ready

### Store Workflow
1. Login as store manager
2. View pending requisitions
3. Select a kitchen's requisition
4. Review requested items and available stock
5. Enter issue quantity (full or partial)
6. Issue items or skip
7. View daily issue summary

### Admin Workflow
1. Access admin dashboard
2. Configure kitchens and warehouses
3. Map item groups to kitchens
4. Manage users and roles
5. Configure ERPNext integration
6. Monitor system analytics

---

## Color Scheme

- **Primary (Orange):** `#FF6B00` - Kitchen actions, primary buttons
- **Accent (Green):** `#22C55E` - Store actions, success states
- **Status Colors:**
  - Pending/Waiting: Yellow
  - Issued: Blue
  - Completed: Green
  - Rejected: Red

---

## Key Components

### Reusable Components
- `StatusBadge` - Status indicators with color coding
- `QuantityInput` - Number input with unit labels
- `ItemInputRow` - Requisition item row with auto-calculation
- `KitchenCard` - Dashboard action cards
- `IssueCard` - Requisition item cards

### Layouts
- `MobileLayout` - Mobile interface with bottom navigation
- `DesktopLayout` - Desktop interface with sidebar

---

## Technical Notes

- Built with React, React Router, and Tailwind CSS
- Recharts for admin analytics
- Mobile-first responsive design
- Inter font family
- Progressive Web App (PWA) ready
- ERPNext integration ready

---

## Demo Data

The system includes mock data for demonstration:
- 3 Kitchens: Chinese, Tandoor, Italian
- Multiple item groups and items
- Sample requisitions and issues
- Mock users across all roles

---

## Future Integration Points

- ERPNext Material Request creation
- Real-time stock level sync
- User authentication system
- Push notifications for requisition updates
- Offline capability for PWA
