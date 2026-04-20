import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import Footer from "./Footer";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "./AppSidebar";
import TopBar from "./TopBar";
import { LmsProvider } from "@/context/LmsContext";
import { ApiLoader } from "@/components/ApiLoader";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

export default function Layout() {
  return (
    <LmsProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-aurora bg-stars">
          <AppSidebar />
          <SidebarInset className="flex flex-col min-w-0">
            <TopBar />
            <main className="flex-1 overflow-x-hidden">
              <div className="container py-6 md:py-8">
                <AppErrorBoundary>
                  <Suspense fallback={<ApiLoader fullPage label="Loading page" />}>
                    <Outlet />
                  </Suspense>
                </AppErrorBoundary>
              </div>
            </main>
            <Footer />
          </SidebarInset>
        </div>
      </SidebarProvider>
    </LmsProvider>
  );
}
