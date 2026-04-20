import "./global.css";

import { lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
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
                <Route path="/signup" element={<Navigate to="/login" replace />} />
                <Route path="/login" element={<Login />} />
                <Route path="/session-expired" element={<SessionExpired />} />
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
