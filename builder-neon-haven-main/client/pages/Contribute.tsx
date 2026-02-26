import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle } from "lucide-react";

type CustomLesson = {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  gradeBands: string[];
  duration: string;
  format: string;
  file?: { name: string; type: string; dataUrl: string };
};

export default function Contribute() {
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState("");
  const [duration, setDuration] = useState("");
  const [grades, setGrades] = useState<string[]>([]);
  const [topics, setTopics] = useState("");
  const [summary, setSummary] = useState("");
  const [materials, setMaterials] = useState("");
  const [extensions, setExtensions] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customLessons, setCustomLessons] = useState<CustomLesson[]>([]);

  function loadCustomLessons(): CustomLesson[] {
    try {
      const raw = localStorage.getItem("custom_lessons");
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as CustomLesson[];
    } catch (err) {
      return [];
    }
  }

  useEffect(() => {
    setCustomLessons(loadCustomLessons());
  }, []);

  function handleDeleteCustom(id: string) {
    if (!window.confirm("Delete this submission?")) return;
    const next = customLessons.filter((c) => c.id !== id);
    setCustomLessons(next);
    localStorage.setItem("custom_lessons", JSON.stringify(next));
  }

  function toggleGrade(g: string) {
    setGrades((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      setFile(null);
      return;
    }
    if (f.type !== "application/pdf") {
      setError("Only PDF files are supported");
      setFile(null);
      return;
    }
    setFile(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (
      !title.trim() ||
      !format ||
      !duration.trim() ||
      grades.length === 0 ||
      !topics.trim() ||
      !summary.trim()
    ) {
      setError("Please fill all required fields.");
      return;
    }

    if (!file) {
      setError("Please attach a PDF file for the lesson.");
      return;
    }

    setSubmitting(true);
    setProgress(0);

    // animate progress for 2.2 seconds before processing
    const durationMs = 2200;
    const start = Date.now();
    const iv = window.setInterval(() => {
      const pct = Math.min(
        100,
        Math.floor(((Date.now() - start) / durationMs) * 100),
      );
      setProgress(pct);
    }, 50);

    try {
      await new Promise((res) => setTimeout(res, durationMs));

      const dataUrl = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(String(reader.result));
        reader.onerror = () => rej(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      const newLesson = {
        id: Date.now().toString(),
        title: title.trim(),
        summary: summary.trim(),
        tags: topics
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        gradeBands: grades,
        duration: duration.trim(),
        format: format === "unplugged" ? "Unplugged" : "Hybrid",
        file: {
          name: file.name,
          type: file.type,
          dataUrl,
        },
      };

      const raw = localStorage.getItem("custom_lessons");
      const arr = raw ? JSON.parse(raw) : [];
      arr.unshift(newLesson);
      localStorage.setItem("custom_lessons", JSON.stringify(arr));
      setCustomLessons(arr);

      setProgress(100);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);

      // reset form
      setTitle("");
      setFormat("");
      setDuration("");
      setGrades([]);
      setTopics("");
      setSummary("");
      setMaterials("");
      setExtensions("");
      setFile(null);
    } catch (err) {
      setError("Failed to save lesson. Please try again.");
    } finally {
      window.clearInterval(iv);
      setSubmitting(false);
      // fade out progress shortly after
      setTimeout(() => setProgress(0), 400);
    }
  }

  return (
    <div className="container py-12">
      <div className="max-w-4xl">
        <div className="mb-2 flex items-center gap-2">
          <Upload className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Share Your Lesson</h1>
        </div>
        <p className="text-muted-foreground mt-2">
          Help teachers everywhere by sharing your unplugged or hybrid lesson.
          Fill out the form below with as much detail as you can.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 grid gap-6">
          <fieldset className="border rounded-lg p-6 bg-card">
            <legend className="text-lg font-semibold mb-4">
              Lesson Details
            </legend>

            <div className="grid gap-5">
              <div className="grid gap-2">
                <label htmlFor="title" className="text-sm font-medium">
                  Lesson Title <span className="text-red-500">*</span>
                </label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="e.g., Coding the Constellations"
                  aria-describedby="title-help"
                />
                <p id="title-help" className="text-xs text-muted-foreground">
                  Give your lesson a clear, descriptive title.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label htmlFor="format" className="text-sm font-medium">
                    Format <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="format"
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    required
                    className="rounded-md border px-3 py-2 text-sm"
                    aria-describedby="format-help"
                  >
                    <option value="">Select a format</option>
                    <option value="unplugged">Unplugged (no devices)</option>
                    <option value="hybrid">Hybrid (devices + hands-on)</option>
                  </select>
                  <p id="format-help" className="text-xs text-muted-foreground">
                    Choose how your lesson is delivered.
                  </p>
                </div>

                <div className="grid gap-2">
                  <label htmlFor="duration" className="text-sm font-medium">
                    Duration <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="duration"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    required
                    placeholder="e.g., 45–60 min"
                    aria-describedby="duration-help"
                  />
                  <p
                    id="duration-help"
                    className="text-xs text-muted-foreground"
                  >
                    How long does the activity take?
                  </p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label htmlFor="grades" className="text-sm font-medium">
                    Grade Levels <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      ["K-2", "K-2"],
                      ["3-5", "3-5"],
                      ["6-8", "6-8"],
                      ["9-12", "9-12"],
                    ].map(([id, label]) => (
                      <label key={id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={grades.includes(id)}
                          onChange={() => toggleGrade(id)}
                          className="rounded"
                        />{" "}
                        {label}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Select all that apply.
                  </p>
                </div>

                <div className="grid gap-2">
                  <label htmlFor="topics" className="text-sm font-medium">
                    Subjects/Topics <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="topics"
                    value={topics}
                    onChange={(e) => setTopics(e.target.value)}
                    required
                    placeholder="e.g., Computer Science, Data Science"
                    aria-describedby="topics-help"
                  />
                  <p id="topics-help" className="text-xs text-muted-foreground">
                    Separate multiple topics with commas.
                  </p>
                </div>
              </div>
            </div>
          </fieldset>

          <fieldset className="border rounded-lg p-6 bg-card">
            <legend className="text-lg font-semibold mb-4">
              Lesson Description
            </legend>

            <div className="grid gap-5">
              <div className="grid gap-2">
                <label htmlFor="summary" className="text-sm font-medium">
                  Summary <span className="text-red-500">*</span>
                </label>
                <Textarea
                  id="summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  required
                  placeholder="Brief overview of your lesson. What will students learn or do?"
                  className="min-h-24"
                  aria-describedby="summary-help"
                />
                <p id="summary-help" className="text-xs text-muted-foreground">
                  Keep this 1-2 sentences so teachers can quickly understand
                  your lesson.
                </p>
              </div>

              <div className="grid gap-2">
                <label htmlFor="materials" className="text-sm font-medium">
                  Materials & Setup <span className="text-red-500">*</span>
                </label>
                <Textarea
                  id="materials"
                  value={materials}
                  onChange={(e) => setMaterials(e.target.value)}
                  required
                  placeholder="What do students and teachers need? How do you set up the activity? Include step-by-step instructions."
                  className="min-h-32"
                  aria-describedby="materials-help"
                />
                <p
                  id="materials-help"
                  className="text-xs text-muted-foreground"
                >
                  Be detailed so other teachers can easily run your lesson.
                </p>
              </div>

              <div className="grid gap-2">
                <label htmlFor="extensions" className="text-sm font-medium">
                  Extensions & Adaptations (Optional)
                </label>
                <Textarea
                  id="extensions"
                  value={extensions}
                  onChange={(e) => setExtensions(e.target.value)}
                  placeholder="Ways to modify or extend the lesson, accessibility tips, or connections to other subjects."
                  className="min-h-20"
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="border rounded-lg p-6 bg-card">
            <legend className="text-lg font-semibold mb-4">Attachments</legend>
            <div className="grid gap-3">
              <label className="text-sm font-medium">
                Lesson PDF (required)
              </label>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
              />
              <p className="text-xs text-muted-foreground">
                We accept PDF files only.
              </p>
            </div>
          </fieldset>

          <fieldset className="border rounded-lg p-6 bg-card">
            <legend className="text-lg font-semibold mb-4">
              Your Submissions
            </legend>
            <div className="grid gap-3">
              {customLessons.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No submissions yet.
                </div>
              ) : (
                customLessons.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 rounded-md border p-3 bg-background"
                  >
                    <div>
                      <div className="font-medium">{c.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.file?.name ?? "No file"} • {c.format}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.file?.dataUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(c.file!.dataUrl, "_blank")}
                        >
                          View
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteCustom(c.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </fieldset>

          <div className="flex flex-col gap-3">
            {submitting && (
              <div className="w-full bg-muted h-2 rounded overflow-hidden">
                <div
                  className="h-2 bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button type="submit" className="px-6" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Lesson"}
              </Button>

              {success && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="text-sm">Lesson submitted</span>
                </div>
              )}

              {error && <div className="text-sm text-red-600">{error}</div>}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
