import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Play, Pause, Maximize2, Minimize2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Slide = {
  id: string;
  title?: string;
  content?: string;
  image?: string; // optional image URL
  video?: string; // optional video URL (mp4 or webm)
  tags?: string[];
  points?: string[]; // bullet points
  steps?: string[]; // ordered steps
  code?: string; // code snippet or data sample
  prompts?: string[]; // teacher prompts or reflection questions
};

const SAMPLE_SLIDES: Slide[] = [
  {
    id: "s1",
    title: "Welcome to Coding the Constellations",
    content:
      "Today we'll explore sequencing by plotting constellations. Get ready for hands-on, unplugged fun!",
    points: [
      "Introduce the idea of sequences as instructions",
      "Explain grid coordinates (row, column)",
      "Set groups of 2-3 students",
    ],
    image: "/star-constellation.svg",
    tags: ["Introduction", "Unplugged"],
    prompts: [
      "Ask: What does it mean to follow a sequence of steps?",
      "Challenge: Can you describe your partner's star using only coordinates?",
    ],
  },
  {
    id: "s2",
    title: "Activity: Map the Stars",
    content:
      "Students will give and follow instructions to place stars on a grid. This builds sequencing and communication skills.",
    steps: [
      "Draw a 6x6 grid on paper and label rows A-F and columns 1-6.",
      "One partner chooses 5 star coordinates and tells the other partner the coordinates in order.",
      "The partner receiving instructions places a star at each coordinate.",
      "Compare results and discuss where miscommunication happened.",
    ],
    image: "/map-stars.svg",
    tags: ["Activity", "K-5"],
    prompts: ["How could you make instructions clearer?", "What happens if steps are out of order?"],
  },
  {
    id: "s3",
    title: "Video: Example Walkthrough",
    content: "Watch a short demo of the activity and classroom setup.",
    video: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    image: "/demo-thumb.svg",
    tags: ["Demo", "Hybrid"],
    prompts: ["Pause at 0:25 — what teaching move did you notice?"],
  },
  {
    id: "s4",
    title: "Data Connection",
    content:
      "Collect simple data from student placements and visualize patterns — for example, most-chosen coordinates.",
    code: "coordinate,count\nA1,3\nB2,5\nC3,2",
    image: "/data-chart.svg",
    tags: ["Data", "Extension"],
    prompts: ["How could we display this data visually?", "What story does the data tell?"],
  },
  {
    id: "s5",
    title: "Reflection & Next Steps",
    content:
      "Wrap up with reflection and ideas to extend the activity to coding concepts like loops and conditions.",
    points: ["Reflect: What worked?", "Extend: Try writing a program that draws the constellation."],
    image: "/reflection.svg",
    tags: ["Wrap-up"],
    prompts: ["What coding concept connects to today's activity?"],
  },
];


export default function LessonViewer() {
  const [index, setIndex] = useState(0);
  const slide = SAMPLE_SLIDES[index];
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [index]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index]);

  function next() {
    setIndex((i) => Math.min(i + 1, SAMPLE_SLIDES.length - 1));
  }
  function prev() {
    setIndex((i) => Math.max(i - 1, 0));
  }

  function togglePlay() {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play();
      setIsPlaying(true);
    } else {
      vid.pause();
      setIsPlaying(false);
    }
  }

  async function toggleFullscreen() {
    const el = document.getElementById("slide-stage");
    if (!el) return;
    // @ts-ignore
    if (!document.fullscreenElement) {
      // @ts-ignore
      await el.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      // @ts-ignore
      await document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            ← Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Sample Lesson: Coding the Constellations</h1>
            <div className="text-sm text-muted-foreground">Slide {index + 1} of {SAMPLE_SLIDES.length}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm text-muted-foreground mr-2">Progress</div>
          <div className="flex items-center gap-2">
            {SAMPLE_SLIDES.map((s, i) => (
              <button
                key={s.id}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-2 w-8 rounded-full transition-all ${i === index ? "bg-primary" : "bg-muted/40"}`}
              />
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
                  <video
                    ref={videoRef}
                    src={slide.video}
                    controls={false}
                    className="w-full h-64 md:h-[420px] bg-black object-cover"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  />
                  <div className="absolute bottom-3 left-3 flex items-center gap-2">
                    <Button size="icon" variant="ghost" onClick={togglePlay} aria-label="Play/Pause">
                      {isPlaying ? <Pause /> : <Play />}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={toggleFullscreen} aria-label="Fullscreen">
                      {isFullscreen ? <Minimize2 /> : <Maximize2 />}
                    </Button>
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
                <ul className="list-disc pl-5 mt-3 text-sm space-y-1 text-muted-foreground">
                  {slide.points.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              )}

              {slide.steps && (
                <ol className="list-decimal pl-5 mt-3 text-sm space-y-1">
                  {slide.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              )}

              {slide.code && (
                <div className="mt-3">
                  <div className="text-xs font-medium text-muted-foreground mb-1">Sample data / code</div>
                  <pre className="rounded-md bg-slate-900 text-white p-3 overflow-auto text-sm">
                    <code>{slide.code}</code>
                  </pre>
                </div>
              )}

              {slide.prompts && (
                <div className="mt-3 p-3 bg-muted/5 rounded-md">
                  <div className="text-sm font-semibold">Teacher prompts</div>
                  <ul className="mt-2 text-sm text-muted-foreground list-disc pl-5 space-y-1">
                    {slide.prompts.map((pr, i) => (
                      <li key={i}>{pr}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 flex items-center gap-2">
                <Button onClick={prev} disabled={index === 0} variant="outline" size="sm">
                  <ArrowLeft className="mr-2" /> Previous
                </Button>
                <Button onClick={next} disabled={index === SAMPLE_SLIDES.length - 1} size="sm">
                  Next <ArrowRight className="ml-2" />
                </Button>
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
                  <button
                    key={s.id}
                    onClick={() => setIndex(i)}
                    className={`flex items-center gap-3 p-2 rounded-md border bg-gradient-to-br from-white/50 to-white/30 transition-all duration-300 ${i === index ? 'ring-2 ring-primary shadow-md' : 'hover:shadow-md hover:from-white/70 hover:to-white/50'}`}
                  >
                    <img src={s.image} alt={s.title} className="w-16 h-10 object-cover rounded-sm" />
                    <div className="text-left">
                      <div className="text-sm font-medium">{s.title}</div>
                      <div className="text-xs text-muted-foreground">{s.tags?.slice(0,2).join(', ')}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <h3 className="font-semibold">Slide Notes</h3>
                <p className="text-sm text-muted-foreground mt-2">Use these notes to guide instruction, prompts, and differentiation ideas for learners.</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {slide.tags?.map((t) => (
                    <Badge key={t} variant="outline">{t}</Badge>
                  ))}
                </div>

                <div className="mt-4 text-sm text-muted-foreground">
                  <div>Use ← → keys to navigate. Space to play/pause video.</div>
                </div>
              </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
