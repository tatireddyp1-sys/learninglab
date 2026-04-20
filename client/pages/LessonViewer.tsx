import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, ArrowRight, Play, Pause, Maximize2, Minimize2,
  CheckCircle2, FileText, ImageIcon, Video, FileQuestion,
  Download, FileType, BookOpen,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { useAuth } from "@/context/AuthContext";
import { useLms } from "@/context/LmsContext";
import { useProgress } from "@/context/ProgressContext";
import { EmptyState } from "@/components/PageState";
import { useToast } from "@/hooks/use-toast";
import type { LessonBlock } from "@shared/lms";
import {
  ImageBlock,
  extractQuizQuestionsFromBlock,
  OfficeDocumentViewer,
  QuizRenderer,
  VideoBlock,
} from "@/components/lesson/LessonBlockMedia";

/* ── Standalone slide preview (no course/lesson in URL) ───────────── */

type Slide = {
  id: string;
  title?: string;
  content?: string;
  image?: string;
  video?: string;
  tags?: string[];
  points?: string[];
  steps?: string[];
  code?: string;
  prompts?: string[];
};

const SAMPLE_SLIDES: Slide[] = [
  {
    id: "s1",
    title: "Welcome to Coding the Constellations",
    content: "Today we'll explore sequencing by plotting constellations. Get ready for hands-on, unplugged fun!",
    points: ["Introduce the idea of sequences as instructions", "Explain grid coordinates (row, column)", "Set groups of 2-3 students"],
    image: "/star-constellation.svg",
    tags: ["Introduction", "Unplugged"],
    prompts: ["Ask: What does it mean to follow a sequence of steps?", "Challenge: Can you describe your partner's star using only coordinates?"],
  },
  {
    id: "s2",
    title: "Activity: Map the Stars",
    content: "Students will give and follow instructions to place stars on a grid. This builds sequencing and communication skills.",
    steps: ["Draw a 6x6 grid on paper and label rows A-F and columns 1-6.", "One partner chooses 5 star coordinates and tells the other partner the coordinates in order.", "The partner receiving instructions places a star at each coordinate.", "Compare results and discuss where miscommunication happened."],
    image: "/map-stars.svg",
    tags: ["Activity", "K-5"],
    prompts: ["How could you make instructions clearer?", "What happens if steps are out of order?"],
  },
  {
    id: "s3",
    title: "Video: Example Walkthrough",
    content: "Watch a short walkthrough of the activity and classroom setup.",
    video: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    image: "/demo-thumb.svg",
    tags: ["Video", "Hybrid"],
    prompts: ["Pause at 0:25 — what teaching move did you notice?"],
  },
  {
    id: "s4",
    title: "Data Connection",
    content: "Collect simple data from student placements and visualize patterns — for example, most-chosen coordinates.",
    code: "coordinate,count\nA1,3\nB2,5\nC3,2",
    image: "/data-chart.svg",
    tags: ["Data", "Extension"],
    prompts: ["How could we display this data visually?", "What story does the data tell?"],
  },
  {
    id: "s5",
    title: "Reflection & Next Steps",
    content: "Wrap up with reflection and ideas to extend the activity to coding concepts like loops and conditions.",
    points: ["Reflect: What worked?", "Extend: Try writing a program that draws the constellation."],
    image: "/reflection.svg",
    tags: ["Wrap-up"],
    prompts: ["What coding concept connects to today's activity?"],
  },
];

/* ── Exports ──────────────────────────────────────────────────────── */

export default function LessonViewer() {
  const [params] = useSearchParams();
  const courseId = params.get("courseId");
  const lessonId = params.get("lessonId");

  if (courseId && lessonId) {
    return <LmsLessonViewer courseId={courseId} lessonId={lessonId} />;
  }

  return <SampleLessonViewer />;
}

/* ── Block type metadata (icon, color, label) ───────────────────── */

const BLOCK_META: Record<string, { icon: typeof FileText; color: string; bg: string; label: string }> = {
  text:     { icon: FileText,     color: "text-blue-500",   bg: "bg-blue-500/10 border-blue-500/20",   label: "Reading" },
  image:    { icon: ImageIcon,    color: "text-emerald-500",bg: "bg-emerald-500/10 border-emerald-500/20", label: "Image" },
  video:    { icon: Video,        color: "text-purple-500", bg: "bg-purple-500/10 border-purple-500/20", label: "Video" },
  quiz:     { icon: FileQuestion, color: "text-amber-500",  bg: "bg-amber-500/10 border-amber-500/20",  label: "Quiz" },
  pdf:      { icon: FileType,     color: "text-red-500",    bg: "bg-red-500/10 border-red-500/20",      label: "PDF Document" },
  download: { icon: Download,     color: "text-cyan-500",   bg: "bg-cyan-500/10 border-cyan-500/20",    label: "Download" },
};

function blockMeta(type: string) {
  return BLOCK_META[type] ?? BLOCK_META.text;
}

/* ── LMS Lesson Viewer (API-driven) ──────────────────────────────── */

function LmsLessonViewer({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const { user, hasRole } = useAuth();
  const {
    getCourse,
    getLesson,
    fetchLesson,
    getLessonsForCourse,
    completions,
    markLessonComplete,
    startLessonProgress,
    trackLessonProgress,
    fetchLessonProgress,
    submitQuiz,
  } = useLms();
  const { setProgress } = useProgress();
  const { toast } = useToast();
  const navigate = useNavigate();

  const course = getCourse(courseId);
  const lesson = getLesson(lessonId);
  const [completeSubmitting, setCompleteSubmitting] = useState(false);
  const [furthestBlock, setFurthestBlock] = useState(0);
  const [lessonLoadError, setLessonLoadError] = useState<string | null>(null);
  const blockElsRef = useRef<Map<number, HTMLDivElement>>(new Map());

  const blocks = useMemo(() => {
    if (!lesson) return [];
    return [...lesson.blocks].sort((a, b) => a.order - b.order);
  }, [lesson]);

  const orderedLessons = course ? getLessonsForCourse(course.id) : [];
  const pos = orderedLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = pos > 0 ? orderedLessons[pos - 1] : null;
  const nextLesson = pos >= 0 && pos < orderedLessons.length - 1 ? orderedLessons[pos + 1] : null;

  useEffect(() => {
    setFurthestBlock(0);
    blockElsRef.current.clear();
  }, [lessonId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLessonLoadError(null);
        await fetchLesson(lessonId);
      } catch (err: unknown) {
        if (!cancelled) {
          setLessonLoadError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lessonId, fetchLesson]);

  useEffect(() => {
    if (!hasRole("student")) return;
    startLessonProgress(lessonId, courseId).catch(() => {});
  }, [lessonId, courseId, startLessonProgress, hasRole]);

  useEffect(() => {
    if (!hasRole("student") || !user) return;
    void fetchLessonProgress(lessonId).catch(() => {});
  }, [lessonId, courseId, hasRole, user, fetchLessonProgress]);

  const savedLessonProgress = useMemo(() => {
    if (!user) return undefined;
    return completions.find((c) => c.userId === user.id && c.courseId === courseId && c.lessonId === lessonId);
  }, [completions, user, courseId, lessonId]);

  useEffect(() => {
    if (!hasRole("student") || blocks.length === 0) return;
    const p = savedLessonProgress?.progressPercent;
    if (p == null || p <= 0) return;
    const idx = Math.max(0, Math.ceil((p / 100) * blocks.length) - 1);
    setFurthestBlock((f) => Math.max(f, idx));
  }, [lessonId, blocks.length, savedLessonProgress?.progressPercent, hasRole]);

  useEffect(() => {
    const els = blockElsRef.current;
    if (els.size === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const idx = Number((entry.target as HTMLElement).dataset.blockIdx);
          if (!isNaN(idx)) {
            setFurthestBlock((prev) => Math.max(prev, idx));
          }
        });
      },
      { threshold: 0.3 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [blocks.length]);

  useEffect(() => {
    if (!user || !lesson || blocks.length === 0) return;
    if (!hasRole("student")) return;
    const pct = Math.min(100, Math.round(((furthestBlock + 1) / blocks.length) * 100));
    setProgress(user.id, lesson.id, pct);
    trackLessonProgress(lessonId, courseId, pct).catch(() => {});
  }, [furthestBlock, blocks.length, lesson, user, setProgress, trackLessonProgress, lessonId, courseId, hasRole]);

  const setBlockRef = useCallback((el: HTMLDivElement | null, idx: number) => {
    if (el) blockElsRef.current.set(idx, el);
    else blockElsRef.current.delete(idx);
  }, []);

  if (lessonLoadError) {
    return (
      <EmptyState
        title="Cannot open this lesson"
        description={lessonLoadError}
        action={
          <Button variant="outline" onClick={() => navigate(hasRole("student") ? "/my-courses" : "/courses")}>
            {hasRole("student") ? "Back to my courses" : "Back to courses"}
          </Button>
        }
      />
    );
  }

  if (!course || !lesson || lesson.deleted || (lesson.courseId && lesson.courseId !== courseId)) {
    return (
      <EmptyState
        title="Lesson unavailable"
        description="This lesson may have been removed or you may not have access."
        action={
          <Button variant="outline" onClick={() => navigate(hasRole("student") ? "/my-courses" : "/courses")}>
            {hasRole("student") ? "Back to my courses" : "Back to courses"}
          </Button>
        }
      />
    );
  }

  const scrollPct =
    blocks.length > 0 ? Math.min(100, Math.round(((furthestBlock + 1) / blocks.length) * 100)) : 0;
  const pct = hasRole("student")
    ? Math.max(scrollPct, savedLessonProgress?.progressPercent ?? 0)
    : scrollPct;

  async function onComplete() {
    if (!user) return;
    setCompleteSubmitting(true);
    try {
      await markLessonComplete(courseId, lessonId);
      setProgress(user.id, lesson!.id, 100);
      toast({ title: "Lesson marked complete" });
    } catch (err: any) {
      toast({ title: "Failed to complete lesson", description: err.message, variant: "destructive" });
    } finally {
      setCompleteSubmitting(false);
    }
  }

  return (
    <div className="container py-8 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>← Back</Button>
          <h1 className="text-2xl font-bold mt-2">{lesson.title}</h1>
          <p className="text-sm text-muted-foreground">{course.title} • {blocks.length} block{blocks.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {prevLesson && (
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/viewer?courseId=${courseId}&lessonId=${prevLesson.id}`}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Previous lesson
              </Link>
            </Button>
          )}
          {nextLesson && (
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/viewer?courseId=${courseId}&lessonId=${nextLesson.id}`}>
                Next lesson <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar — learner progress only */}
      {hasRole("student") && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Lesson progress</span>
            <span>{pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>
      )}

      {/* Lesson description */}
      {lesson.description && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">About this lesson</span>
          </div>
          <p className="text-sm text-muted-foreground">{lesson.description}</p>
        </div>
      )}

      {/* Blocks */}
      {blocks.length === 0 ? (
        <EmptyState title="No content blocks" description="This lesson has no blocks yet." />
      ) : (
        <div className="space-y-6">
          {blocks.map((block, idx) => {
            const meta = blockMeta(block.type);
            const Icon = meta.icon;
            const quizQuestions =
              block.type === "quiz" ? extractQuizQuestionsFromBlock(block) : null;

            return (
              <div
                key={block.id || idx}
                ref={(el) => setBlockRef(el, idx)}
                data-block-idx={idx}
                className={`rounded-xl border shadow-sm overflow-hidden ${meta.bg}`}
              >
                {/* Block header */}
                <div className={`flex items-center gap-3 px-5 py-3 border-b ${meta.bg}`}>
                  <Icon className={`h-5 w-5 ${meta.color} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-semibold truncate">{block.title || meta.label}</h2>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-xs uppercase tracking-wider">
                    {meta.label}
                  </Badge>
                </div>

                {/* Block body */}
                <div className="bg-card p-5">
                  {/* TEXT */}
                  {block.type === "text" && (
                    <div className="prose dark:prose-invert max-w-none prose-sm prose-headings:text-foreground prose-p:text-foreground/90 prose-code:bg-muted prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-pre:bg-slate-900 prose-pre:text-white">
                      <ReactMarkdown>{block.body ?? ""}</ReactMarkdown>
                    </div>
                  )}

                  {/* IMAGE */}
                  {block.type === "image" && (
                    <div className="flex justify-center">
                      <ImageBlock url={block.assetUrl} alt={block.title} />
                    </div>
                  )}

                  {/* VIDEO */}
                  {block.type === "video" && (
                    <div className="rounded-lg overflow-hidden bg-black">
                      <VideoBlock url={block.assetUrl} />
                    </div>
                  )}

                  {/* QUIZ */}
                  {block.type === "quiz" && (
                    quizQuestions ? (
                      <QuizRenderer
                        questions={quizQuestions}
                        serverSubmit={
                          courseId
                            ? async (answers) => {
                                const r = await submitQuiz(lessonId, block.id, answers);
                                return {
                                  scorePercent: r.scorePercent,
                                  passed: r.passed,
                                  correctCount: r.correctCount,
                                  totalQuestions: r.totalQuestions,
                                  results: r.results,
                                };
                              }
                            : undefined
                        }
                      />
                    ) : (
                      <div className="prose dark:prose-invert max-w-none text-sm">
                        <ReactMarkdown>{block.body ?? "Quiz content coming soon."}</ReactMarkdown>
                      </div>
                    )
                  )}

                  {/* DOCUMENT (PDF + Office + misc) */}
                  {block.type === "pdf" && (
                    <OfficeDocumentViewer url={block.assetUrl} fileName={block.fileName} />
                  )}

                  {/* DOWNLOAD */}
                  {block.type === "download" && (
                    <OfficeDocumentViewer url={block.assetUrl} fileName={block.fileName} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t">
        <div className="flex gap-2">
          {prevLesson && (
            <Button variant="outline" asChild>
              <Link to={`/viewer?courseId=${courseId}&lessonId=${prevLesson.id}`}>
                <ArrowLeft className="mr-2 h-4 w-4" /> {prevLesson.title}
              </Link>
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {hasRole("student") && (
            <Button onClick={onComplete} disabled={completeSubmitting}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Mark lesson complete
            </Button>
          )}
          {nextLesson && (
            <Button variant="secondary" asChild>
              <Link to={`/viewer?courseId=${courseId}&lessonId=${nextLesson.id}`}>
                {nextLesson.title} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Sample Lesson Viewer (standalone demo) ───────────────────────── */

function SampleLessonViewer() {
  const [index, setIndex] = useState(0);
  const slide = SAMPLE_SLIDES[index];
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setIsPlaying(false);
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; }
  }, [index]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === " ") { e.preventDefault(); togglePlay(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index]);

  function next() { setIndex((i) => Math.min(i + 1, SAMPLE_SLIDES.length - 1)); }
  function prev() { setIndex((i) => Math.max(i - 1, 0)); }

  function togglePlay() {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) { vid.play(); setIsPlaying(true); }
    else { vid.pause(); setIsPlaying(false); }
  }

  async function toggleFullscreen() {
    const el = document.getElementById("slide-stage");
    if (!el) return;
    if (!document.fullscreenElement) { await el.requestFullscreen?.(); setIsFullscreen(true); }
    else { await document.exitFullscreen?.(); setIsFullscreen(false); }
  }

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate(-1)}>← Back</Button>
          <div>
            <h1 className="text-2xl font-bold">Lesson preview: Coding the Constellations</h1>
            <div className="text-sm text-muted-foreground">Slide {index + 1} of {SAMPLE_SLIDES.length}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm text-muted-foreground mr-2">Progress</div>
          <div className="flex items-center gap-2">
            {SAMPLE_SLIDES.map((s, i) => (
              <button key={s.id} aria-label={`Go to slide ${i + 1}`} onClick={() => setIndex(i)} className={`h-2 w-8 rounded-full transition-all ${i === index ? "bg-primary" : "bg-muted/40"}`} />
            ))}
          </div>
        </div>
      </div>
      <div id="slide-stage" className="rounded-2xl border bg-gradient-to-br from-card to-card/90 p-6 shadow-md hover:shadow-xl transition-all duration-300 hover:border-primary/50 relative before:absolute before:inset-0 before:rounded-2xl before:pointer-events-none before:bg-gradient-to-br before:from-white/5 before:to-transparent">
        <div className="grid md:grid-cols-3 gap-6 relative z-10">
          <div className="md:col-span-2">
            <div className="rounded-lg overflow-hidden bg-black/5">
              {slide.video ? (
                <div className="relative">
                  <video ref={videoRef} src={slide.video} controls={false} className="w-full h-64 md:h-[420px] bg-black object-cover" onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} />
                  <div className="absolute bottom-3 left-3 flex items-center gap-2">
                    <Button size="icon" variant="ghost" onClick={togglePlay} aria-label="Play/Pause">{isPlaying ? <Pause /> : <Play />}</Button>
                    <Button size="icon" variant="ghost" onClick={toggleFullscreen} aria-label="Fullscreen">{isFullscreen ? <Minimize2 /> : <Maximize2 />}</Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col md:flex-row items-stretch gap-4 p-6">
                  <div className="flex-1">
                    <img src={slide.image} alt={slide.title} className="w-full h-64 object-contain" />
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4">
              <h2 className="text-xl font-semibold">{slide.title}</h2>
              {slide.content && <p className="text-muted-foreground mt-2">{slide.content}</p>}
              {slide.points && (
                <ul className="list-disc pl-5 mt-3 text-sm space-y-1 text-muted-foreground">{slide.points.map((p, i) => <li key={i}>{p}</li>)}</ul>
              )}
              {slide.steps && (
                <ol className="list-decimal pl-5 mt-3 text-sm space-y-1">{slide.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
              )}
              {slide.code && (
                <div className="mt-3">
                  <div className="text-xs font-medium text-muted-foreground mb-1">Sample data / code</div>
                  <pre className="rounded-md bg-slate-900 text-white p-3 overflow-auto text-sm"><code>{slide.code}</code></pre>
                </div>
              )}
              {slide.prompts && (
                <div className="mt-3 p-3 bg-muted/5 rounded-md">
                  <div className="text-sm font-semibold">Teacher prompts</div>
                  <ul className="mt-2 text-sm text-muted-foreground list-disc pl-5 space-y-1">{slide.prompts.map((pr, i) => <li key={i}>{pr}</li>)}</ul>
                </div>
              )}
              <div className="mt-4 flex items-center gap-2">
                <Button onClick={prev} disabled={index === 0} variant="outline" size="sm"><ArrowLeft className="mr-2" /> Previous</Button>
                <Button onClick={next} disabled={index === SAMPLE_SLIDES.length - 1} size="sm">Next <ArrowRight className="ml-2" /></Button>
              </div>
            </div>
          </div>
          <aside className="md:col-span-1">
            <div className="rounded-md border bg-gradient-to-br from-card to-card/90 p-4 shadow-md hover:shadow-xl transition-all duration-300 hover:border-primary/50 relative before:absolute before:inset-0 before:rounded-md before:pointer-events-none before:bg-gradient-to-br before:from-white/5 before:to-transparent">
              <div className="relative z-10">
                <h3 className="font-semibold">Slides</h3>
                <p className="text-sm text-muted-foreground mt-2">Jump to any slide using the thumbnails below.</p>
                <div className="mt-3 grid gap-2">
                  {SAMPLE_SLIDES.map((s, i) => (
                    <button key={s.id} onClick={() => setIndex(i)} className={`flex items-center gap-3 p-2 rounded-md border bg-gradient-to-br from-white/50 to-white/30 transition-all duration-300 ${i === index ? "ring-2 ring-primary shadow-md" : "hover:shadow-md hover:from-white/70 hover:to-white/50"}`}>
                      <img src={s.image} alt={s.title} className="w-16 h-10 object-cover rounded-sm" />
                      <div className="text-left">
                        <div className="text-sm font-medium">{s.title}</div>
                        <div className="text-xs text-muted-foreground">{s.tags?.slice(0, 2).join(", ")}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="mt-4">
                  <h3 className="font-semibold">Slide Notes</h3>
                  <p className="text-sm text-muted-foreground mt-2">Use these notes to guide instruction, prompts, and differentiation ideas for learners.</p>
                  <div className="mt-3 flex flex-wrap gap-2">{slide.tags?.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}</div>
                  <div className="mt-4 text-sm text-muted-foreground">Use ← → keys to navigate. Space to play/pause video.</div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
