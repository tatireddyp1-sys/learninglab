import { Outlet } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import Chatbot from "@/components/ui/Chatbot";

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-aurora bg-stars">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <Chatbot />
    </div>
  );
}
