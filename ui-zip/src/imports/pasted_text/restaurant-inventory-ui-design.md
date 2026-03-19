Design a restaurant inventory requisition system UI integrated with ERPNext.

The system has three user roles:

Kitchen Staff (Mobile UI)

Store Manager (Mobile / Tablet UI)

Admin (Desktop Dashboard)

The application is a Progressive Web App (PWA).

The design should be clean, minimal, fast for staff usage, with large touch-friendly controls.

Use a modern SaaS dashboard style similar to Notion / Linear / Stripe dashboard.

Primary colors:

White background

Soft gray panels

Accent color: Orange (#FF6B00) or Green (#22C55E)

Typography:

Inter

Large readable buttons

Simple icons

Screens to Design

Create the following full UI screens and components.

1 Kitchen Mobile App

Mobile-first interface designed for fast daily inventory entry.

Kitchen Login Screen

Fields:

Email
Password

Button:

Login

Option:

Remember device

Kitchen Dashboard

Top section:

Kitchen Name

Example

Chinese Kitchen

Cards:

Create Requisition
Pending Items
Received Today

Bottom navigation:

Dashboard
Requisitions
History
Profile

Create Requisition Screen

Grouped item list.

Example layout:

Indian Vegetables

Onion
Closing Stock input
Required Today input

Tomato
Closing Stock input
Required Today input

Chicken

Chicken Breast
Closing Stock
Required

Each item row should include:

Item name
Closing stock input
Required quantity input
Auto calculated requested quantity

Calculation:

Requested = Required - Closing

Large submit button

Submit Requisition

Pending Requisition Screen

List of requests.

Example card:

Chicken

Requested 1 kg
Store Issued 500 g

Status

Waiting
Issued
Completed

Tap to open details.

Receive Items Screen

Example layout:

Item

Chicken

Requested

1 kg

Issued

500 g

Buttons

Accept
Reject

Large mobile buttons.

2 Store Mobile / Tablet App

Designed for quick issuing of stock items.

Store Dashboard

Cards

Pending Requisitions
Today Issued
Low Stock Items

Requisition List Screen

List view.

Example:

Chinese Kitchen

Chicken requested 1 kg
Stock available 500 g

Tap to open issue screen.

Issue Item Screen

Layout:

Kitchen Name

Chinese Kitchen

Item

Chicken

Requested

1 kg

Available in store

500 g

Input field

Issue Quantity

Buttons

Issue Item
Skip

Issue Summary Screen

List of items issued today.

Example:

Chicken → 500 g → Chinese Kitchen
Onion → 2 kg → Tandoor Kitchen

3 Admin Desktop Dashboard

Admin manages configuration and ERP integration.

Desktop SaaS dashboard layout with left sidebar.

Sidebar menu:

Dashboard
Kitchens
Item Groups
Users
ERP Integration
Settings

Admin Dashboard

Cards:

Total Kitchens
Today's Requisitions
Stock Transfers
Pending Issues

Graphs:

Daily consumption
Item usage trends

Kitchen Management Screen

Table:

Kitchen Name
Warehouse
Item Groups
Users

Buttons

Add Kitchen
Edit Kitchen

Item Group Mapping

Example:

Chinese Kitchen

Chicken
Sauces
Vegetables

Checkbox style selection.

ERP Integration Screen

Fields:

ERP URL

https://erp.food-studio.in

API Key
API Secret

Test Connection button

User Management Screen

Columns:

Name
Role
Kitchen
Status

Roles:

Kitchen User
Store User
Admin

Components to Design

Reusable UI components:

Item Input Row
Quantity Input Field
Issue Card
Kitchen Card
Status Badge

Status colors:

Pending → Yellow
Issued → Blue
Completed → Green
Rejected → Red

UX Requirements

The system must be:

Extremely fast to use
Large touch controls
Minimal typing
Optimized for kitchen environment

Inputs should support:

grams
kg
pieces

Style

Design should look similar to:

Stripe Dashboard
Linear
Notion
Shopify Admin

Minimalist and professional.

Output Requirements

Generate:

Full mobile UI flows
Full desktop admin dashboard
Reusable components
Auto-layout enabled
Responsive layouts