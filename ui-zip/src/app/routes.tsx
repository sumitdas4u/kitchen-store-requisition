import { createBrowserRouter, Navigate } from 'react-router';

// Landing
import { Landing } from './pages/Landing';

// Kitchen Pages
import { KitchenLogin } from './pages/KitchenLogin';
import { KitchenDashboard } from './pages/KitchenDashboard';
import { CreateRequisition } from './pages/CreateRequisition';
import { PendingRequisitions } from './pages/PendingRequisitions';
import { ReceiveItems } from './pages/ReceiveItems';

// Store Pages
import { StoreLogin } from './pages/StoreLogin';
import { StoreDashboard } from './pages/StoreDashboard';
import { StoreRequisitionList } from './pages/StoreRequisitionList';
import { IssueItem } from './pages/IssueItem';
import { IssueSummary } from './pages/IssueSummary';

// Admin Pages
import { AdminDashboard } from './pages/AdminDashboard';
import { KitchenManagement } from './pages/KitchenManagement';
import { ItemGroupMapping } from './pages/ItemGroupMapping';
import { ERPIntegration } from './pages/ERPIntegration';
import { UserManagement } from './pages/UserManagement';

// Placeholder
import { PlaceholderPage } from './pages/PlaceholderPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Landing />,
  },
  // Landing Routes
  {
    path: '/landing',
    element: <Landing />,
  },
  // Kitchen Routes
  {
    path: '/kitchen/login',
    element: <KitchenLogin />,
  },
  {
    path: '/kitchen',
    element: <KitchenDashboard />,
  },
  {
    path: '/kitchen/create-requisition',
    element: <CreateRequisition />,
  },
  {
    path: '/kitchen/pending',
    element: <PendingRequisitions />,
  },
  {
    path: '/kitchen/receive/:id',
    element: <ReceiveItems />,
  },
  {
    path: '/kitchen/requisitions',
    element: <PendingRequisitions />,
  },
  {
    path: '/kitchen/history',
    element: <PlaceholderPage title="History" description="View past requisitions" />,
  },
  {
    path: '/kitchen/profile',
    element: <PlaceholderPage title="Profile" description="Manage your profile" />,
  },
  // Store Routes
  {
    path: '/store/login',
    element: <StoreLogin />,
  },
  {
    path: '/store',
    element: <StoreDashboard />,
  },
  {
    path: '/store/requisitions',
    element: <StoreRequisitionList />,
  },
  {
    path: '/store/issue/:id',
    element: <IssueItem />,
  },
  {
    path: '/store/issued',
    element: <IssueSummary />,
  },
  {
    path: '/store/low-stock',
    element: <PlaceholderPage title="Low Stock Items" layout="mobile-store" />,
  },
  {
    path: '/store/profile',
    element: <PlaceholderPage title="Profile" description="Manage your profile" layout="mobile-store" />,
  },
  // Admin Routes
  {
    path: '/admin',
    element: <AdminDashboard />,
  },
  {
    path: '/admin/kitchens',
    element: <KitchenManagement />,
  },
  {
    path: '/admin/item-groups',
    element: <ItemGroupMapping />,
  },
  {
    path: '/admin/users',
    element: <UserManagement />,
  },
  {
    path: '/admin/erp',
    element: <ERPIntegration />,
  },
  {
    path: '/admin/settings',
    element: <PlaceholderPage title="Settings" description="System settings" layout="desktop" />,
  },
  // 404
  {
    path: '*',
    element: (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-4xl text-gray-900 mb-2">404</h1>
          <p className="text-gray-600 mb-4">Page not found</p>
          <a href="/kitchen/login" className="text-primary hover:underline">
            Go to Login
          </a>
        </div>
      </div>
    ),
  },
]);