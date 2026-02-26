import { Link, NavLink, useNavigate } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Logo from "@/components/ui/Logo";
import { useAuth } from "@/context/AuthContext";
import { LogOut, User } from "lucide-react";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "px-3 py-2 text-sm font-medium rounded-md transition-colors",
    isActive
      ? "text-primary bg-secondary"
      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
  );

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/signup");
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3">
          <Logo size={36} />
          <span className="text-lg font-extrabold tracking-tight">Learning Lab</span>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          <NavLink to="/" className={navLinkClass} end>
            Home
          </NavLink>
          <NavLink to="/lessons" className={navLinkClass}>
            Lessons
          </NavLink>
          <NavLink to="/contribute" className={navLinkClass}>
            Contribute
          </NavLink>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="secondary" className="hidden sm:inline-flex">
            <Link to="/contribute">Share a Lesson</Link>
          </Button>
          {user && (
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <User className="h-4 w-4" />
                {user.name}
              </span>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1">
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          )}
          {user && (
            <Button variant="ghost" size="icon" onClick={handleLogout} className="sm:hidden">
              <LogOut className="h-4 w-4" />
            </Button>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
