import { Link } from "react-router-dom";
import Logo from "@/components/ui/Logo";
import { useAuth } from "@/context/AuthContext";

export default function Footer() {
  const { user } = useAuth();
  return (
    <footer className="border-t">
      <div className="container py-10 grid gap-6 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-6 w-6 rounded-md"><Logo size={24} /></div>
            <span className="font-bold">Learning Lab</span>
          </div>
          <p className="text-sm text-muted-foreground max-w-sm">
            Free K-12 lessons across science, technology, engineering, mathematics, and more.
            Unplugged and hybrid activities designed for classrooms of all kinds.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2">Explore</h3>
          <ul className="space-y-1 text-sm">
            <li><Link to="/lessons" className="hover:underline">Browse Lessons</Link></li>
            {(!user || user.role === "student") && (
              <li><Link to="/contribute" className="hover:underline">Contribute</Link></li>
            )}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2">Legal</h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>© {new Date().getFullYear()} Cosmic Classroom</li>
            <li>All content provided by contributors.</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
