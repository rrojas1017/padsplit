import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { BookingsProvider } from "@/contexts/BookingsContext";
import { AgentsProvider } from "@/contexts/AgentsContext";
import { DisplayTokensProvider } from "@/contexts/DisplayTokensContext";
import { AgentStatusProvider } from "@/contexts/AgentStatusContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import MyPerformance from "./pages/MyPerformance";
import Leaderboard from "./pages/Leaderboard";
import Reports from "./pages/Reports";
import AddBooking from "./pages/AddBooking";
import EditBooking from "./pages/EditBooking";
import Wallboard from "./pages/Wallboard";
import UserManagement from "./pages/UserManagement";

import DisplayLinks from "./pages/DisplayLinks";
import PublicWallboard from "./pages/PublicWallboard";
import AuditLog from "./pages/AuditLog";
import Settings from "./pages/Settings";
import ImportBookings from "./pages/ImportBookings";
import CoachingHub from "./pages/CoachingHub";
import AgentStatus from "./pages/AgentStatus";

import MyQA from "./pages/MyQA";
import QADashboard from "./pages/QADashboard";
import AgentGoals from "./pages/AgentGoals";
import Billing from "./pages/Billing";
import CoachingEngagement from "./pages/CoachingEngagement";
import MyBookings from "./pages/MyBookings";
import MoveInCalculator from "./pages/MoveInCalculator";
import PromoCodeSettings from "./pages/PromoCodeSettings";
import CallInsights from "./pages/CallInsights";
import HistoricalImport from "./pages/HistoricalImport";
import BroadcastMessages from "./pages/BroadcastMessages";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Wrapper for protected routes that need data contexts
function DataProviders({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <BookingsProvider>
        <AgentsProvider>
          <DisplayTokensProvider>
            <AgentStatusProvider>
              {children}
            </AgentStatusProvider>
          </DisplayTokensProvider>
        </AgentsProvider>
      </BookingsProvider>
    </SidebarProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public routes - no data providers needed */}
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/display/:token" element={<PublicWallboard />} />
              
              {/* Protected routes - wrapped with data providers */}
              <Route path="/dashboard" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'supervisor']}>
                  <DataProviders>
                    <Dashboard />
                  </DataProviders>
                </ProtectedRoute>
              } />
              
              <Route path="/my-performance" element={
                <ProtectedRoute>
                  <DataProviders>
                    <MyPerformance />
                  </DataProviders>
                </ProtectedRoute>
              } />
              
              <Route path="/leaderboard" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'supervisor']}>
                  <DataProviders>
                    <Leaderboard />
                  </DataProviders>
                </ProtectedRoute>
              } />
              
              <Route path="/reports" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'supervisor']}>
                  <DataProviders>
                    <Reports />
                  </DataProviders>
                </ProtectedRoute>
              } />

              <Route path="/add-booking" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'supervisor', 'agent']}>
                  <DataProviders>
                    <AddBooking />
                  </DataProviders>
                </ProtectedRoute>
              } />

              <Route path="/edit-booking/:id" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'supervisor', 'agent']}>
                  <DataProviders>
                    <EditBooking />
                  </DataProviders>
                </ProtectedRoute>
              } />
              
              <Route path="/wallboard" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'supervisor']}>
                  <DataProviders>
                    <Wallboard />
                  </DataProviders>
                </ProtectedRoute>
              } />
              
              <Route path="/users" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'supervisor']}>
                  <DataProviders>
                    <UserManagement />
                  </DataProviders>
                </ProtectedRoute>
              } />

              <Route path="/display-links" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                  <DataProviders>
                    <DisplayLinks />
                  </DataProviders>
                </ProtectedRoute>
              } />
              
              <Route path="/audit-log" element={
                <ProtectedRoute allowedRoles={['super_admin']}>
                  <DataProviders>
                    <AuditLog />
                  </DataProviders>
                </ProtectedRoute>
              } />
              
              <Route path="/settings" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                  <DataProviders>
                    <Settings />
                  </DataProviders>
                </ProtectedRoute>
              } />

              <Route path="/import-bookings" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                  <DataProviders>
                    <ImportBookings />
                  </DataProviders>
                </ProtectedRoute>
              } />

              <Route path="/coaching-hub" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'supervisor']}>
                  <DataProviders>
                    <CoachingHub />
                  </DataProviders>
                </ProtectedRoute>
              } />

              <Route path="/agent-status" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'supervisor']}>
                  <DataProviders>
                    <AgentStatus />
                  </DataProviders>
                </ProtectedRoute>
              } />

              {/* Redirect old member-insights route to unified call-insights */}
              <Route path="/member-insights" element={<Navigate to="/call-insights?tab=bookings" replace />} />

              <Route path="/my-qa" element={
                <ProtectedRoute allowedRoles={['agent']}>
                  <DataProviders>
                    <MyQA />
                  </DataProviders>
                </ProtectedRoute>
              } />

              <Route path="/my-bookings" element={
                <ProtectedRoute allowedRoles={['agent']}>
                  <DataProviders>
                    <MyBookings />
                  </DataProviders>
                </ProtectedRoute>
              } />

              <Route path="/qa-dashboard" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'supervisor']}>
                  <DataProviders>
                    <QADashboard />
                  </DataProviders>
                </ProtectedRoute>
              } />

              <Route path="/agent-goals" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'supervisor']}>
                  <DataProviders>
                    <AgentGoals />
                  </DataProviders>
                </ProtectedRoute>
              } />

              <Route path="/billing" element={
                <ProtectedRoute allowedRoles={['super_admin']}>
                  <DataProviders>
                    <Billing />
                  </DataProviders>
                </ProtectedRoute>
              } />

              <Route path="/call-insights" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                  <DataProviders>
                    <CallInsights />
                  </DataProviders>
                </ProtectedRoute>
              } />

              <Route path="/coaching-engagement" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'supervisor']}>
                  <DataProviders>
                    <CoachingEngagement />
                  </DataProviders>
                </ProtectedRoute>
              } />

              <Route path="/tools/move-in-calculator" element={
                <ProtectedRoute>
                  <DataProviders>
                    <MoveInCalculator />
                  </DataProviders>
                </ProtectedRoute>
              } />

              <Route path="/settings/promo-codes" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                  <DataProviders>
                    <PromoCodeSettings />
                  </DataProviders>
                </ProtectedRoute>
              } />

              <Route path="/historical-import" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                  <DataProviders>
                    <HistoricalImport />
                  </DataProviders>
                </ProtectedRoute>
              } />

              <Route path="/broadcasts" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'supervisor']}>
                  <DataProviders>
                    <BroadcastMessages />
                  </DataProviders>
                </ProtectedRoute>
              } />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;