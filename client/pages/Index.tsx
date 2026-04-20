import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BookOpen,
  Rocket,
  Search,
  Star,
  Zap,
  Filter,
  HelpCircle,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "@/components/ui/Logo";
import { useAuth } from "@/context/AuthContext";

type GradeBand = "K-2" | "3-5" | "6-8" | "9-12";

type Lesson = {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  gradeBands: GradeBand[];
  duration: string;
  format: "Unplugged" | "Hybrid";
};

const getCustomLessons = () => {
  try {
    const raw = localStorage.getItem("custom_lessons");
    if (!raw) return [] as Lesson[];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [] as Lesson[];
    return parsed as Lesson[];
  } catch (err) {
    return [] as Lesson[];
  }
};

const ALL_LESSONS: Lesson[] = [
  {
    id: "1",
    title: "Coding the Constellations",
    summary:
      "Learn sequencing by plotting constellations with grid coordinates.",
    tags: ["Computer Science", "Space", "Unplugged"],
    gradeBands: ["K-2", "3-5"],
    duration: "30–45 min",
    format: "Unplugged",
  },
  {
    id: "2",
    title: "Solar Storm Data Dive",
    summary: "Analyze solar flare data and chart patterns over time.",
    tags: ["Data Science", "Space Weather", "Hybrid"],
    gradeBands: ["6-8", "9-12"],
    duration: "45–60 min",
    format: "Hybrid",
  },
  {
    id: "3",
    title: "Magnetosphere Maze",
    summary:
      "Use algorithms to navigate a particle through Earth's magnetic field.",
    tags: ["Computer Science", "Space Weather"],
    gradeBands: ["3-5", "6-8"],
    duration: "30–45 min",
    format: "Unplugged",
  },
  {
    id: "4",
    title: "Planetary Patterns with Python",
    summary: "Intro to loops by modeling orbit patterns.",
    tags: ["Computer Science", "Hybrid"],
    gradeBands: ["6-8", "9-12"],
    duration: "60–90 min",
    format: "Hybrid",
  },
  {
    id: "5",
    title: "Space Weather Watch",
    summary: "Investigate how solar wind impacts satellites and power grids.",
    tags: ["Space Weather", "Data Science"],
    gradeBands: ["9-12"],
    duration: "45–60 min",
    format: "Hybrid",
  },
  {
    id: "6",
    title: "Binary Stars & Binary Numbers",
    summary: "Decode messages using binary inspired by star systems.",
    tags: ["Computer Science", "Unplugged"],
    gradeBands: ["3-5", "6-8"],
    duration: "30–45 min",
    format: "Unplugged",
  },
];

const CARD_BACKGROUNDS: Record<string, string> = {
  "1": "https://images.pexels.com/photos/6807016/pexels-photo-6807016.jpeg",
  "2": "https://images.pexels.com/photos/33931027/pexels-photo-33931027.png",
  "3": "https://images.pexels.com/photos/4826567/pexels-photo-4826567.png",
  "4": "https://images.pexels.com/photos/33931036/pexels-photo-33931036.png",
  "5": "https://images.pexels.com/photos/35378668/pexels-photo-35378668.png",
  "6": "https://images.pexels.com/photos/33931036/pexels-photo-33931036.png"
};

export default function Index() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [query, setQuery] = useState("");
  const [band, setBand] = useState<GradeBand | "all">("all");
  const [topic, setTopic] = useState<string | "all">("all");

  const ALL_AVAILABLE = useMemo(() => {
    return [...ALL_LESSONS, ...getCustomLessons()];
  }, []);

  const topics = useMemo(() => {
    const s = new Set<string>();
    ALL_AVAILABLE.forEach((l) => l.tags.forEach((t) => s.add(t)));
    return ["all", ...Array.from(s)];
  }, [ALL_AVAILABLE]);

  const results = useMemo(() => {
    return ALL_AVAILABLE.filter((l) => {
      const matchesQuery = `${l.title} ${l.summary} ${l.tags.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchesBand = band === "all" ? true : l.gradeBands.includes(band);
      const matchesTopic =
        topic === "all" ? true : l.tags.includes(topic as string);
      return matchesQuery && matchesBand && matchesTopic;
    });
  }, [query, band, topic, ALL_AVAILABLE]);

  return (
    <div className="container py-12">
      {isAuthenticated && (
        <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            You are signed in. Open the LMS dashboard for courses, lessons, and progress.
          </p>
          <Button variant="secondary" size="sm" asChild>
            <Link to="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      )}
      {/* New layout: compact hero + two-column content (main + sidebar) */}
      <header className="grid gap-6 md:grid-cols-3 md:items-center mb-8">
        <div className="flex items-center gap-4 md:col-span-2">
          <div className="rounded-md bg-card p-3 flex items-center justify-center">
            <Logo size={56} />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold">
              Learning Lab
            </h1>
            <p className="text-muted-foreground mt-1 max-w-2xl">
              Free K-12 lessons across STEM and beyond — unplugged and hybrid
              activities that spark curiosity.
            </p>
            <div className="mt-3 flex gap-3">
              <Button
                onClick={() => navigate("/lessons")}
                className="shadow-sm"
              >
                Explore Lessons
              </Button>
              <Button variant="outline" asChild>
                <Link to="/contribute">Share a Lesson</Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="md:col-span-1">
          <div className="rounded-lg border p-4 bg-card">
            <label className="text-sm font-medium mb-1 block">
              Quick Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-3 text-muted-foreground h-4 w-4" />
              <Input
                aria-label="Search lessons by title, topic, or subject"
                placeholder="Search by lesson name, topic..."
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Filter by Grade Level
                </label>
                <select
                  aria-label="Filter lessons by grade level"
                  value={band}
                  onChange={(e) => setBand(e.target.value as GradeBand | "all")}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="all">All Grades</option>
                  <option value="K-2">Kindergarten - 2nd Grade</option>
                  <option value="3-5">3rd - 5th Grade</option>
                  <option value="6-8">6th - 8th Grade</option>
                  <option value="9-12">9th - 12th Grade</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Filter by Subject
                </label>
                <select
                  aria-label="Filter lessons by subject or topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value as string | "all")}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  {topics.map((t) => (
                    <option key={t} value={t === "all" ? "all" : t}>
                      {t === "all" ? "All Subjects" : t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-8 md:grid-cols-3">
        {/* Main column: lesson grid */}
        <main className="md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">
              {query || band !== "all" || topic !== "all"
                ? "Results"
                : "Featured Lessons"}
            </h2>
            <div className="text-sm text-muted-foreground">
              {results.length} lessons
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {results.map((l) => {
              const bgImage = CARD_BACKGROUNDS[l.id];
              return (
                <Card
                  key={l.id}
                  className="relative overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                  style={bgImage ? {
                    backgroundImage: `url('${bgImage}')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundAttachment: "fixed"
                  } : undefined}
                  onClick={() => navigate("/viewer")}
                >
                  {bgImage && <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-black/35 to-black/40 rounded-lg pointer-events-none z-0" />}
                  <CardHeader className={bgImage ? "relative z-10" : ""}>
                    <CardTitle className={`flex items-center justify-between gap-2 ${bgImage ? "text-white" : ""}`}>
                      {l.title}
                      <Badge
                        className="shrink-0"
                        variant={l.format === "Hybrid" ? "default" : "secondary"}
                      >
                        {l.format}
                      </Badge>
                    </CardTitle>
                    <CardDescription className={bgImage ? "text-white/90" : ""}>{l.summary}</CardDescription>
                  </CardHeader>
                  <CardContent className={`pt-0 ${bgImage ? "relative z-10" : ""}`}>
                    <div className="flex flex-wrap gap-2">
                      {l.tags.map((t) => (
                        <Badge key={t} variant={bgImage ? "default" : "outline"} className={bgImage ? "bg-white/20 text-white border-white/30" : ""}>
                          {t}
                        </Badge>
                      ))}
                    </div>
                    <div className={`mt-3 text-xs ${bgImage ? "text-white/80" : "text-muted-foreground"}`}>
                      Grades: {l.gradeBands.join(", ")} • {l.duration}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </main>

        {/* Sidebar: quick tips and CTA */}
        <aside className="md:col-span-1 space-y-4">
          <div className="rounded-lg border p-4 bg-card">
            <div className="flex items-center gap-2 mb-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Getting Started</h3>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Tips and guides to help you find and adapt lessons for your
              classroom.
            </p>

            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-primary to-accent grid place-items-center flex-shrink-0">
                  <BookOpen className="text-white h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium text-sm">Unplugged Lessons</div>
                  <div className="text-sm text-muted-foreground">
                    No technology required — perfect for any learning
                    environment.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-accent to-primary grid place-items-center flex-shrink-0">
                  <Zap className="text-white h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium text-sm">Hybrid Lessons</div>
                  <div className="text-sm text-muted-foreground">
                    Blend hands-on and digital activities for flexible learning.
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <Button asChild className="w-full">
                <Link to="/contribute">Share Your Lesson</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-lg border p-4 bg-card">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Grade Level Quick Filter</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Click to filter by grade:
            </p>
            <div className="flex flex-wrap gap-2">
              {(["K-2", "3-5", "6-8", "9-12"] as GradeBand[]).map((g) => (
                <Button
                  key={g}
                  variant={band === g ? "default" : "secondary"}
                  onClick={() => setBand(band === g ? "all" : g)}
                  size="sm"
                  title={`Filter by ${g === "K-2" ? "Kindergarten-2nd" : g === "3-5" ? "3rd-5th" : g === "6-8" ? "6th-8th" : "9th-12th"} grade`}
                >
                  {g}
                </Button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Bottom CTA */}
      <section className="mt-12 rounded-2xl border p-8 bg-gradient-to-br from-secondary/60 to-primary/10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-2xl font-bold">
              Have a great lesson to share?
            </h3>
            <p className="text-muted-foreground mt-2">
              Join our community and help educators worldwide.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="secondary">
              <Link to="/lessons">Browse Lessons</Link>
            </Button>
            <Button asChild>
              <Link to="/contribute">Contribute</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
