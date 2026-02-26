import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ProgressProvider } from "@/context/ProgressContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Layout from "@/components/layout/Layout";
import Lessons from "./pages/Lessons";
import Contribute from "./pages/Contribute";
import LessonViewer from "./pages/LessonViewer";
import SignUp from "./pages/SignUp";
import Login from "./pages/Login";
import ProtectedRoute from "@/components/ProtectedRoute";
import UserManagement from "./pages/UserManagement";
import AuditLogs from "./pages/AuditLogs";
import LessonUpload from "./pages/LessonUpload";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <ProgressProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
            <Route path="/signup" element={<SignUp />} />
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Index />} />
              <Route path="/lessons" element={<Lessons />} />
              <Route path="/contribute" element={<Contribute />} />
              <Route path="/lessons/upload" element={<LessonUpload />} />
              <Route path="/viewer" element={<LessonViewer />} />
              <Route path="/admin/users" element={<UserManagement />} />
              <Route path="/admin/audit-logs" element={<AuditLogs />} />
            </Route>
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ProgressProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
