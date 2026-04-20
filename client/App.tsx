import "./global.css";

import { lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { CustomRolesProvider } from "@/context/CustomRolesContext";
import { ProgressProvider } from "@/context/ProgressContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Layout from "@/components/layout/Layout";
import Lessons from "./pages/Lessons";
import Contribute from "./pages/Contribute";
import LessonViewer from "./pages/LessonViewer";
import Login from "./pages/Login";
import ProtectedRoute from "@/components/ProtectedRoute";
import UserManagement from "./pages/UserManagement";
import LessonUpload from "./pages/LessonUpload";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CourseListPage = lazy(() => import("./pages/CourseListPage"));
const CourseCreatePage = lazy(() => import("./pages/CourseCreatePage"));
const CourseDetailPage = lazy(() => import("./pages/CourseDetailPage"));
const CourseEditPage = lazy(() => import("./pages/CourseEditPage"));
const LessonBuilderPage = lazy(() => import("./pages/LessonBuilderPage"));
const LessonHistoryPage = lazy(() => import("./pages/LessonHistoryPage"));
const LessonBuilderHubPage = lazy(() => import("./pages/LessonBuilderHubPage"));
const EnrollmentListPage = lazy(() => import("./pages/EnrollmentListPage"));
const MyCoursesPage = lazy(() => import("./pages/MyCoursesPage"));
const ProgressDashboardPage = lazy(() => import("./pages/ProgressDashboardPage"));
const RolesPage = lazy(() => import("./pages/RolesPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const SessionExpired = lazy(() => import("./pages/SessionExpired"));

const queryClient = new QueryClient();

/** Unauthenticated users see login at `/`; deep links redirect to `/` with return state. */
function RootGate() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (location.pathname === "/") {
      return <Login />;
    }
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <CustomRolesProvider>
        <ProgressProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
                <Route path="/signup" element={<Navigate to="/" replace />} />
                <Route path="/login" element={<Navigate to="/" replace />} />
                <Route path="/session-expired" element={<SessionExpired />} />
                <Route element={<RootGate />}>
                  <Route
                    element={
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    }
                  >
                  <Route path="/" element={<Index />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/courses" element={<CourseListPage />} />
                  <Route path="/courses/new" element={<CourseCreatePage />} />
                  <Route path="/courses/:courseId" element={<CourseDetailPage />} />
                  <Route path="/courses/:courseId/edit" element={<CourseEditPage />} />
                  <Route path="/courses/:courseId/lessons/new" element={<LessonBuilderPage />} />
                  <Route path="/courses/:courseId/lessons/:lessonId/history" element={<LessonHistoryPage />} />
                  <Route path="/courses/:courseId/lessons/:lessonId" element={<LessonBuilderPage />} />
                  <Route path="/lesson-builder" element={<LessonBuilderHubPage />} />
                  <Route path="/my-courses" element={<MyCoursesPage />} />
                  <Route path="/lessons" element={<Lessons />} />
                  <Route path="/lessons/new" element={<LessonBuilderPage />} />
                  <Route path="/lessons/:lessonId/edit" element={<LessonBuilderPage />} />
                  <Route path="/contribute" element={<Contribute />} />
                  <Route path="/lessons/upload" element={<LessonUpload />} />
                  <Route path="/viewer" element={<LessonViewer />} />
                  <Route path="/enrollments" element={<EnrollmentListPage />} />
                  <Route path="/progress" element={<ProgressDashboardPage />} />
                  <Route path="/admin/users" element={<UserManagement />} />
                  <Route path="/admin/roles" element={<RolesPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  </Route>
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
          </BrowserRouter>
        </ProgressProvider>
        </CustomRolesProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
