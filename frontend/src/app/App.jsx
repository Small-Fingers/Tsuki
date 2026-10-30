import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AdminDashboard from '../features/admin/dashboard/admin-dashboard.jsx';
import { Protected } from '../features/access/protected-route.jsx';
import { Account } from '../features/account/pages/account-page.jsx';
import { Contact } from '../features/account/pages/contact-page.jsx';
import { Profile } from '../features/account/pages/profile-page.jsx';
import { CompareHomes } from '../features/buyer/pages/compare-homes.jsx';
import { SavedHomes } from '../features/buyer/pages/saved-homes.jsx';
import { SavedSearchAlerts } from '../features/buyer/pages/saved-search-alerts.jsx';
import { ChatPage } from '../features/interactions/pages/chat-page.jsx';
import { MessagesInbox } from '../features/interactions/pages/messages-inbox.jsx';
import { NotificationsPage } from '../features/interactions/pages/notifications-page.jsx';
import { SellerLeads } from '../features/interactions/pages/seller-leads.jsx';
import { ViewingsPage } from '../features/interactions/pages/viewings-page.jsx';
import { Home } from '../features/marketplace/pages/home.jsx';
import { PropertyDetail } from '../features/marketplace/pages/property-detail.jsx';
import { Properties } from '../features/marketplace/pages/property-search.jsx';
import { SellerProfile } from '../features/marketplace/pages/seller-profile.jsx';
import { Dashboard } from '../features/seller/dashboard/seller-dashboard.jsx';
import { ListingForm } from '../features/seller/pages/listing-form.jsx';
import { Layout } from './Shell.jsx';
import { AuthProvider } from './auth.jsx';
import { NotificationProvider } from './notifications.jsx';
import { PropertyToolsProvider } from './property-tools.jsx';

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <PropertyToolsProvider>
          <BrowserRouter>
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/properties" element={<Properties />} />
                <Route path="/properties/:id" element={<PropertyDetail />} />
                <Route path="/sellers/:id" element={<SellerProfile />} />
                <Route
                  path="/saved"
                  element={
                    <Protected requiredRole="buyer">
                      <SavedHomes />
                    </Protected>
                  }
                />
                <Route
                  path="/alerts"
                  element={
                    <Protected requiredRole="buyer">
                      <SavedSearchAlerts />
                    </Protected>
                  }
                />
                <Route
                  path="/leads"
                  element={
                    <Protected requiredRole="seller">
                      <SellerLeads />
                    </Protected>
                  }
                />
                <Route
                  path="/notifications"
                  element={
                    <Protected>
                      <NotificationsPage />
                    </Protected>
                  }
                />
                <Route
                  path="/viewings"
                  element={
                    <Protected>
                      <ViewingsPage />
                    </Protected>
                  }
                />
                <Route path="/compare" element={<CompareHomes />} />
                <Route path="/login" element={<Account />} />
                <Route path="/register" element={<Account register />} />
                <Route
                  path="/profile"
                  element={
                    <Protected allowPasswordChange>
                      <Profile />
                    </Protected>
                  }
                />
                <Route path="/contact" element={<Contact />} />
                <Route
                  path="/admin"
                  element={
                    <Protected requiredRole="admin">
                      <AdminDashboard />
                    </Protected>
                  }
                />
                <Route
                  path="/admin/users"
                  element={
                    <Protected requiredRole="admin">
                      <AdminDashboard />
                    </Protected>
                  }
                />
                <Route
                  path="/admin/properties"
                  element={
                    <Protected requiredRole="admin">
                      <AdminDashboard />
                    </Protected>
                  }
                />
                <Route
                  path="/admin/contacts"
                  element={
                    <Protected requiredRole="admin">
                      <AdminDashboard />
                    </Protected>
                  }
                />
                <Route
                  path="/admin/reports"
                  element={
                    <Protected requiredRole="admin">
                      <AdminDashboard />
                    </Protected>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <Protected requiredRole="seller">
                      <Dashboard />
                    </Protected>
                  }
                />
                <Route
                  path="/messages"
                  element={
                    <Protected requiredRoles={['buyer', 'seller']}>
                      <MessagesInbox />
                    </Protected>
                  }
                />
                <Route
                  path="/messages/:id"
                  element={
                    <Protected requiredRoles={['buyer', 'seller']}>
                      <ChatPage />
                    </Protected>
                  }
                />
                <Route
                  path="/new-listing"
                  element={
                    <Protected requiredRole="seller">
                      <ListingForm />
                    </Protected>
                  }
                />
                <Route
                  path="/edit-listing/:id"
                  element={
                    <Protected requiredRole="seller">
                      <ListingForm edit />
                    </Protected>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </BrowserRouter>
        </PropertyToolsProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}
export default App;
