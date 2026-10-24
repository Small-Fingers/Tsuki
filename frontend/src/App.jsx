import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import { AuthProvider, NotificationProvider, PropertyToolsProvider } from './app/shared.jsx';
import { Layout } from './app/Shell.jsx';
import { Home, Properties, PropertyDetail, SellerProfile, SavedHomes, SavedSearchAlerts, SellerLeads, NotificationsPage, ViewingsPage, CompareHomes, Account, ForgotPassword, Profile, Contact, Dashboard, ChatPage, MessagesInbox, ListingForm, Protected } from './pages/Pages.jsx';

function App() { return <AuthProvider><NotificationProvider><PropertyToolsProvider><BrowserRouter><Layout><Routes>
<Route path="/" element={<Home/>}/><Route path="/properties" element={<Properties/>}/><Route path="/properties/:id" element={<PropertyDetail/>}/><Route path="/sellers/:id" element={<SellerProfile/>}/>
<Route path="/saved" element={<Protected role="buyer"><SavedHomes/></Protected>}/><Route path="/alerts" element={<Protected role="buyer"><SavedSearchAlerts/></Protected>}/><Route path="/leads" element={<Protected role="seller"><SellerLeads/></Protected>}/><Route path="/notifications" element={<Protected><NotificationsPage/></Protected>}/><Route path="/viewings" element={<Protected><ViewingsPage/></Protected>}/><Route path="/compare" element={<CompareHomes/>}/>
<Route path="/login" element={<Account/>}/><Route path="/register" element={<Account register/>}/><Route path="/forgot-password" element={<ForgotPassword/>}/><Route path="/profile" element={<Protected allowPasswordChange><Profile/></Protected>}/><Route path="/contact" element={<Contact/>}/>
<Route path="/admin" element={<Protected role="admin"><AdminDashboard/></Protected>}/><Route path="/admin/users" element={<Protected role="admin"><AdminDashboard/></Protected>}/><Route path="/admin/properties" element={<Protected role="admin"><AdminDashboard/></Protected>}/><Route path="/admin/contacts" element={<Protected role="admin"><AdminDashboard/></Protected>}/><Route path="/admin/reports" element={<Protected role="admin"><AdminDashboard/></Protected>}/>
<Route path="/dashboard" element={<Protected role="seller"><Dashboard/></Protected>}/><Route path="/messages" element={<Protected roles={['buyer','seller']}><MessagesInbox/></Protected>}/><Route path="/messages/:id" element={<Protected roles={['buyer','seller']}><ChatPage/></Protected>}/><Route path="/new-listing" element={<Protected role="seller"><ListingForm/></Protected>}/><Route path="/edit-listing/:id" element={<Protected role="seller"><ListingForm edit/></Protected>}/><Route path="*" element={<Navigate to="/" replace/>}/>
</Routes></Layout></BrowserRouter></PropertyToolsProvider></NotificationProvider></AuthProvider>; }
export default App;
