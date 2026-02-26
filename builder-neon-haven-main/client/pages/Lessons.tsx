import React, { useMemo, useState } from "react";
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
import { Search, BookMarked } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import SAMPLE_LESSONS from "@/lib/sample-lessons";

type GradeBand = "K-2" | "3-5" | "6-8" | "9-12";

type Lesson = {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  gradeBands: GradeBand[];
  duration: string;
  format: "Unplugged" | "Hybrid" | string;
  file?: { name: string; type: string; dataUrl: string };
};

function loadCustomLessons(): Lesson[] {
  try {
    const raw = localStorage.getItem("custom_lessons");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    return [];
  }
}

export default function Lessons() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [band, setBand] = useState<GradeBand | "all">("all");
  const [format, setFormat] = useState<"all" | "Unplugged" | "Hybrid">("all");

  const ALL_LESSONS = useMemo(() => {
    return [...(SAMPLE_LESSONS as Lesson[]), ...loadCustomLessons()];
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_LESSONS.filter((l) => {
      const hay =
        `${l.title} ${l.summary} ${l.tags?.join(" ") ?? ""}`.toLowerCase();
      const matchesQuery = q === "" ? true : hay.includes(q);
      const matchesBand =
        band === "all" ? true : l.gradeBands?.includes(band as GradeBand);
      const matchesFormat = format === "all" ? true : l.format === format;
      return matchesQuery && matchesBand && matchesFormat;
    });
  }, [query, band, format, ALL_LESSONS]);

  return (
    <div className="container py-12">
      <div className="max-w-4xl">
        <div className="mb-2 flex items-center gap-2">
          <BookMarked className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Browse Lessons</h1>
        </div>
        <p className="text-muted-foreground mt-2">
          Explore our catalog of K-12 lessons. Use the search and filters below
          to find lessons by grade level and subject.
        </p>
      </div>

      <div className="mt-8 rounded-lg border p-6 bg-card">
        <div className="mb-6">
          <label
            htmlFor="lesson-search"
            className="block text-sm font-medium mb-3"
          >
            Search Lessons
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              id="lesson-search"
              placeholder="Search by lesson title, topic, or keyword..."
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search lessons by title, topic, or keyword"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium block mb-2">
              Filter by Grade Level
            </label>
            <div className="flex flex-wrap gap-2">
              {(["K-2", "3-5", "6-8", "9-12"] as GradeBand[]).map((g) => (
                <Button
                  key={g}
                  variant={band === g ? "default" : "secondary"}
                  size="sm"
                  onClick={() => setBand(band === g ? "all" : g)}
                >
                  {g}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-2">
              Filter by Format
            </label>
            <div className="flex flex-wrap gap-2">
              {(["All Formats", "Unplugged", "Hybrid"] as string[]).map((f) => {
                const key = f === "All Formats" ? "all" : f;
                return (
                  <Button
                    key={f}
                    variant={format === key ? "default" : "secondary"}
                    size="sm"
                    onClick={() =>
                      setFormat(
                        key === "all" ? "all" : (key as "Unplugged" | "Hybrid"),
                      )
                    }
                  >
                    {f}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">
            {query || band !== "all" || format !== "all"
              ? "Results"
              : "All Lessons"}
          </h2>
          <div className="text-sm text-muted-foreground">
            {results.length} lessons
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {results.map((l) => (
            <Card
              key={l.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate("/viewer")}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  {l.title}
                  <Badge
                    className="shrink-0"
                    variant={l.format === "Hybrid" ? "default" : "secondary"}
                  >
                    {l.format}
                  </Badge>
                </CardTitle>
                <CardDescription>{l.summary}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {l.tags?.map((t) => (
                    <Badge key={t} variant="outline">
                      {t}
                    </Badge>
                  ))}
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  Grades: {l.gradeBands?.join(", ")} • {l.duration}
                </div>
              </CardContent>
            </Card>
          ))}

          {results.length === 0 && (
            <div className="col-span-full text-center rounded-lg border p-8 bg-card text-muted-foreground">
              No lessons match your search. Try different keywords or clear
              filters.
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <div className="rounded-lg border p-8 bg-gradient-to-br from-secondary/30 to-primary/5 text-center">
          <p className="font-semibold text-lg mb-2">
            Can't find what you're looking for?
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Share a lesson to help grow our catalog.
          </p>
          <Button asChild>
            <Link to="/contribute">Share a Lesson</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
