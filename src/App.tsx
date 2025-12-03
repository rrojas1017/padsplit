import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { BookingsProvider } from "@/contexts/BookingsContext";
import { AgentsProvider } from "@/contexts/AgentsContext";
import { DisplayTokensProvider } from "@/contexts/DisplayTokensContext";
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
import AgentManagement from "./pages/AgentManagement";
import DisplayLinks from "./pages/DisplayLinks";
import PublicWallboard from "./pages/PublicWallboard";
import AuditLog from "./pages/AuditLog";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <SidebarProvider>
            <BookingsProvider>
            <AgentsProvider>
            <DisplayTokensProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              
              <Route path="/dashboard" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'supervisor']}>
                  <Dashboard />
                </ProtectedRoute>
              } />
              
              <Route path="/my-performance" element={
                <ProtectedRoute>
                  <MyPerformance />
                </ProtectedRoute>
              } />
              
              <Route path="/leaderboard" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'supervisor']}>
                  <Leaderboard />
                </ProtectedRoute>
              } />
              
              <Route path="/reports" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'supervisor']}>
                  <Reports />
                </ProtectedRoute>
              } />

              <Route path="/add-booking" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'supervisor', 'agent']}>
                  <AddBooking />
                </ProtectedRoute>
              } />

              <Route path="/edit-booking/:id" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'supervisor', 'agent']}>
                  <EditBooking />
                </ProtectedRoute>
              } />
              
              <Route path="/wallboard" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'supervisor']}>
                  <Wallboard />
                </ProtectedRoute>
              } />
              
              <Route path="/users" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                  <UserManagement />
                </ProtectedRoute>
              } />

              <Route path="/agents" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                  <AgentManagement />
                </ProtectedRoute>
              } />

              <Route path="/display-links" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                  <DisplayLinks />
                </ProtectedRoute>
              } />

              <Route path="/display/:token" element={<PublicWallboard />} />
              
              <Route path="/audit-log" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                  <AuditLog />
                </ProtectedRoute>
              } />
              
              <Route path="/settings" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                  <Settings />
                </ProtectedRoute>
              } />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
            </DisplayTokensProvider>
            </AgentsProvider>
            </BookingsProvider>
            </SidebarProvider>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
