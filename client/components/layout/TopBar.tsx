import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import ThemeToggle from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LogOut } from "lucide-react";

export default function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-6" />
      <div className="flex flex-1 items-center justify-end gap-2">
        <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
          <Link to="/">Home</Link>
        </Button>
        <ThemeToggle />
        {user && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        )}
      </div>
    </header>
  );
}
