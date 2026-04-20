import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, FileType, ExternalLink, FileWarning } from "lucide-react";
import { resolveAssetUrl, getFile } from "@/lib/mock/fileStorage";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import type { LessonQuizSubmitResult } from "@shared/lms";

/** Resolves mock-asset:// keys to blob URLs for previews and the lesson viewer. */
export function useResolvedUrl(url: string | undefined): string | undefined {
  const [resolved, setResolved] = useState(url);
  useEffect(() => {
    if (!url) {
      setResolved(undefined);
      return;
    }
    if (!url.startsWith("mock-asset://")) {
      setResolved(url);
      return;
    }
    let cancelled = false;
    resolveAssetUrl(url).then((r) => {
      if (!cancelled) setResolved(r);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);
  return resolved;
}

/** Legacy authoring shape + Lambda `quizData.questions` variants */
export interface QuizQuestion {
  id: string;
  text: string;
  options: { id: string; text: string }[];
  correctId: string;
  explanation?: string;
}

export type NormalizedQuizQuestion = {
  id: string;
  prompt: string;
  kind: "single" | "multi";
  choices: { key: string; value: string; label: string }[];
  correctValues: string[];
  explanation?: string;
};

function readQuestionsArray(quizData: unknown, body: string | undefined): unknown[] | null {
  if (quizData && typeof quizData === "object") {
    const qd = quizData as { questions?: unknown };
    if (Array.isArray(qd.questions) && qd.questions.length > 0) return qd.questions;
  }
  if (!body?.trim()) return null;
  const trimmed = body.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    const parsed = JSON.parse(trimmed) as { questions?: unknown };
    const questions = parsed.questions ?? (Array.isArray(parsed) ? parsed : null);
    if (!Array.isArray(questions) || questions.length === 0) return null;
    return questions;
  } catch {
    return null;
  }
}

function normalizeOne(raw: unknown): NormalizedQuizQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const q = raw as Record<string, unknown>;
  const id = String(q.id ?? "").trim();
  if (!id) return null;

  const prompt = String(q.text ?? q.prompt ?? q.question ?? "Question").trim();
  const typeStr = String(q.type ?? "single-choice").toLowerCase();
  const kind: "single" | "multi" =
    typeStr.includes("multi") || typeStr === "multiple" ? "multi" : "single";

  const optsRaw = q.options;
  if (Array.isArray(optsRaw) && optsRaw.length > 0 && typeof optsRaw[0] === "string") {
    const choices = (optsRaw as string[]).map((label, i) => ({
      key: `o${i}`,
      value: label,
      label,
    }));
    const ans = q.answers ?? q.correctAnswers;
    const single = q.answer ?? q.correctAnswer;
    let correctValues: string[] = [];
    if (Array.isArray(ans)) correctValues = ans.map(String);
    else if (single !== undefined && single !== null) correctValues = [String(single)];
    if (correctValues.length === 0) return null;
    return { id, prompt, kind, choices, correctValues, explanation: q.explanation != null ? String(q.explanation) : undefined };
  }

  if (Array.isArray(optsRaw) && optsRaw.length > 0 && typeof optsRaw[0] === "object") {
    const options = optsRaw as { id?: unknown; text?: unknown }[];
    const choices = options.map((o, i) => {
      const oid = String(o.id ?? String.fromCharCode(97 + i));
      const text = String(o.text ?? "");
      return { key: oid, value: oid, label: text || oid };
    });
    const correctId = String(q.correctId ?? "");
    const single = q.answer ?? q.correctAnswer;
    const ans = q.answers ?? q.correctAnswers;
    let correctValues: string[] = [];
    if (correctId) {
      const hit = choices.find((c) => c.key === correctId);
      correctValues = hit ? [hit.value] : [correctId];
    } else if (Array.isArray(ans)) {
      correctValues = ans.map(String);
    } else if (single !== undefined && single !== null) {
      correctValues = [String(single)];
    }
    if (correctValues.length === 0) return null;
    return { id, prompt, kind, choices, correctValues, explanation: q.explanation != null ? String(q.explanation) : undefined };
  }

  return null;
}

/** Normalize quiz from `quizData` and/or `textData` JSON for UI + grading payloads */
export function extractQuizQuestionsFromBlock(block: {
  body?: string;
  quizData?: unknown;
}): NormalizedQuizQuestion[] | null {
  const rawList = readQuestionsArray(block.quizData, block.body);
  if (!rawList) return null;
  const out: NormalizedQuizQuestion[] = [];
  for (const r of rawList) {
    const n = normalizeOne(r);
    if (n) out.push(n);
  }
  return out.length ? out : null;
}

/** @deprecated use extractQuizQuestionsFromBlock — kept for call sites that only had body */
export function parseQuizData(body: string | undefined): NormalizedQuizQuestion[] | null {
  return extractQuizQuestionsFromBlock({ body });
}

export type QuizSubmitResponse = LessonQuizSubmitResult;

function sortStr(a: string, b: string) {
  return a.localeCompare(b);
}

function setEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const x = [...a].sort(sortStr);
  const y = [...b].sort(sortStr);
  return x.every((v, i) => v === y[i]);
}

export function QuizRenderer({
  questions,
  serverSubmit,
}: {
  questions: NormalizedQuizQuestion[];
  /** When set, grades via `submitQuiz` API; otherwise instant client-side check */
  serverSubmit?: (answers: Record<string, string | string[]>) => Promise<QuizSubmitResponse>;
}) {
  const [single, setSingle] = useState<Record<string, string>>({});
  const [multi, setMulti] = useState<Record<string, string[]>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverResult, setServerResult] = useState<QuizSubmitResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setSingle({});
    setMulti({});
    setSubmitted(false);
    setServerResult(null);
    setError(null);
  };

  const toggleMulti = (qid: string, value: string) => {
    if (submitted) return;
    setMulti((prev) => {
      const cur = prev[qid] ?? [];
      const has = cur.includes(value);
      const next = has ? cur.filter((x) => x !== value) : [...cur, value];
      return { ...prev, [qid]: next };
    });
  };

  const allAnswered =
    questions.length > 0 &&
    questions.every((q) => {
      if (q.kind === "multi") return (multi[q.id]?.length ?? 0) > 0;
      return Boolean(single[q.id]);
    });

  const clientScore = submitted && !serverSubmit
    ? questions.filter((q) => {
        if (q.kind === "multi") {
          return setEqual(multi[q.id] ?? [], q.correctValues);
        }
        return q.correctValues.includes(single[q.id] ?? "");
      }).length
    : 0;

  const buildPayload = (): Record<string, string | string[]> => {
    const out: Record<string, string | string[]> = {};
    for (const q of questions) {
      if (q.kind === "multi") {
        out[q.id] = [...(multi[q.id] ?? [])];
      } else {
        const v = single[q.id];
        if (v) out[q.id] = v;
      }
    }
    return out;
  };

  const onSubmit = async () => {
    setError(null);
    if (!serverSubmit) {
      setSubmitted(true);
      return;
    }
    setSubmitting(true);
    try {
      const res = await serverSubmit(buildPayload());
      setServerResult(res);
      setSubmitted(true);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const resultForQuestion = (qid: string) => {
    if (!submitted) return null;
    if (serverResult) return serverResult.results.find((r) => r.questionId === qid) ?? null;
    const q = questions.find((x) => x.id === qid);
    if (!q) return null;
    const sub = q.kind === "multi" ? [...(multi[qid] ?? [])] : single[qid];
    const ok =
      q.kind === "multi" ? setEqual(sub as string[], q.correctValues) : q.correctValues.includes(String(sub));
    return {
      questionId: qid,
      submittedAnswer: sub,
      correctAnswer: q.correctValues,
      isCorrect: ok,
    };
  };

  const displayScore = serverResult
    ? { num: serverResult.correctCount, den: serverResult.totalQuestions, pct: serverResult.scorePercent }
    : { num: clientScore, den: questions.length, pct: questions.length ? Math.round((clientScore / questions.length) * 100) : 0 };

  return (
    <div className="space-y-6">
      {questions.map((q, qi) => {
        const row = resultForQuestion(q.id);
        return (
          <div key={q.id} className="space-y-3">
            <p className="font-medium text-sm">
              {qi + 1}. {q.prompt}
            </p>
            <div className="grid gap-2">
              {q.kind === "single"
                ? q.choices.map((opt) => {
                    const selected = single[q.id] === opt.value;
                    let cls =
                      "border rounded-lg px-4 py-3 text-sm text-left w-full transition-all ";
                    if (submitted && row) {
                      const showCorrect = q.correctValues.includes(opt.value);
                      if (showCorrect) cls += "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400";
                      else if (selected && !showCorrect) cls += "border-red-500 bg-red-500/10 text-red-700 dark:text-red-400";
                      else cls += "border-border opacity-50";
                    } else if (selected) cls += "border-primary bg-primary/10 ring-2 ring-primary/30";
                    else cls += "border-border hover:border-primary/50 hover:bg-muted/30 cursor-pointer";
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => !submitted && setSingle((prev) => ({ ...prev, [q.id]: opt.value }))}
                        className={cls}
                        disabled={submitted}
                      >
                        <span className="flex items-center gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold uppercase">
                            {opt.key.slice(0, 3)}
                          </span>
                          <span>{opt.label}</span>
                          {submitted && row && q.correctValues.includes(opt.value) && (
                            <CheckCircle2 className="ml-auto h-5 w-5 text-green-500" />
                          )}
                          {submitted && row && selected && !q.correctValues.includes(opt.value) && (
                            <XCircle className="ml-auto h-5 w-5 text-red-500" />
                          )}
                        </span>
                      </button>
                    );
                  })
                : q.choices.map((opt) => {
                    const checked = (multi[q.id] ?? []).includes(opt.value);
                    const shouldPick = q.correctValues.includes(opt.value);
                    return (
                      <label
                        key={opt.key}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-all",
                          submitted && row
                            ? row.isCorrect
                              ? shouldPick === checked
                                ? "border-green-500/40 bg-green-500/5"
                                : "border-border opacity-60"
                              : "border-amber-500/50 bg-amber-500/5"
                            : checked
                              ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                              : "border-border hover:border-primary/50"
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={submitted}
                          onCheckedChange={() => toggleMulti(q.id, opt.value)}
                        />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
            </div>
            {submitted && q.explanation && (
              <p className="text-xs text-muted-foreground pl-2 border-l-2 border-primary/30">{q.explanation}</p>
            )}
          </div>
        );
      })}

      {error && (
        <p className="text-sm text-destructive flex items-center gap-2">
          <FileWarning className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4 pt-2">
        {!submitted ? (
          <Button type="button" onClick={() => void onSubmit()} disabled={!allAnswered || submitting}>
            {submitting ? "Submitting…" : serverSubmit ? "Submit for grading" : "Check answers"}
          </Button>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Badge variant={displayScore.pct >= 70 ? "default" : "secondary"} className="text-base px-3 py-1">
                {displayScore.num} / {displayScore.den}
                {serverResult && <span className="ml-2 opacity-90">({serverResult.scorePercent}%)</span>}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {serverResult
                  ? serverResult.passed
                    ? "Passed"
                    : "Below passing threshold"
                  : displayScore.pct === 100
                    ? "Perfect!"
                    : displayScore.pct >= 70
                      ? "Good job!"
                      : "Keep practicing!"}
              </span>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={reset}>
              Try again
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function docExt(fileName?: string, url?: string): string {
  const fromName = fileName?.split(".").pop()?.toLowerCase() ?? "";
  if (fromName) return fromName;
  try {
    const u = new URL(url ?? "", "https://example.invalid");
    const p = u.pathname.split(".").pop()?.toLowerCase() ?? "";
    return p;
  } catch {
    return "";
  }
}

function TextDocPreview({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("bad");
        const t = await res.text();
        if (!cancelled) setText(t.slice(0, 200_000));
      } catch {
        if (!cancelled) setErr(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);
  if (err || text === null) {
    return (
      <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
        Inline preview is unavailable (CORS or network). Use download or open in a new tab.
      </div>
    );
  }
  return (
    <pre className="max-h-[480px] overflow-auto rounded-lg border bg-muted/30 p-4 text-xs leading-relaxed whitespace-pre-wrap">
      {text}
    </pre>
  );
}

/** PDF, Office embed, plain text, or download fallback — matches DOCUMENT / download blocks */
export function OfficeDocumentViewer({
  url,
  fileName,
  variant = "default",
}: {
  url?: string;
  fileName?: string;
  variant?: "default" | "studio";
}) {
  const resolved = useResolvedUrl(url);
  const ext = docExt(fileName, resolved);
  const isStudio = variant === "studio";

  if (!resolved) return <p className="text-sm text-muted-foreground">No document URL</p>;

  if (ext === "pdf") {
    return <PdfBlock url={resolved} fileName={fileName} variant={isStudio ? "studio" : "default"} />;
  }

  if (["ppt", "pptx", "doc", "docx", "xls", "xlsx"].includes(ext)) {
    const embed =
      resolved.startsWith("http://") || resolved.startsWith("https://")
        ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(resolved)}`
        : null;
    if (!embed) {
      return <DownloadBlock url={resolved} fileName={fileName} />;
    }
    const shell = "flex flex-col overflow-hidden rounded-xl border bg-card shadow-md ring-1 ring-border/50";
    const viewport = "relative h-[min(72vh,820px)] min-h-[420px] w-full bg-white dark:bg-zinc-950";
    return (
      <div className={cn(shell)}>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2">
          <p className="truncate text-sm font-medium">{fileName ?? "Document"}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={embed} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1 h-3 w-3" />
                Viewer tab
              </a>
            </Button>
            <DownloadBlock url={resolved} fileName={fileName} />
          </div>
        </div>
        <div className={viewport}>
          <iframe title={fileName ?? "Document"} src={embed} className="absolute inset-0 h-full w-full border-0" />
        </div>
      </div>
    );
  }

  if (ext === "txt") {
    return (
      <div className="space-y-3">
        <TextDocPreview url={resolved} />
        <DownloadBlock url={resolved} fileName={fileName} />
      </div>
    );
  }

  if (["mp4", "mov", "webm"].includes(ext)) {
    return <VideoBlock url={resolved} />;
  }
  if (["jpg", "jpeg", "png", "webp", "svg", "gif"].includes(ext)) {
    return (
      <div className="flex justify-center">
        <ImageBlock url={resolved} alt={fileName} />
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-gradient-to-br from-muted/30 to-card p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <FileType className="h-10 w-10 text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{fileName ?? "Attachment"}</p>
          <p className="text-xs text-muted-foreground mt-1">Open or download this file.</p>
        </div>
        <DownloadBlock url={resolved} fileName={fileName} />
      </div>
    </div>
  );
}

export function ImageBlock({ url, alt, compact }: { url?: string; alt?: string; compact?: boolean }) {
  const resolved = useResolvedUrl(url);
  if (!resolved) return <p className="text-sm text-muted-foreground">No image available</p>;
  return (
    <img
      src={resolved}
      alt={alt ?? "Lesson image"}
      className={
        compact
          ? "w-full rounded-lg max-h-[280px] object-contain bg-muted/30 ring-1 ring-border/60"
          : "w-full rounded-md max-h-[500px] object-contain bg-muted/10"
      }
    />
  );
}

export function VideoBlock({ url, compact }: { url?: string; compact?: boolean }) {
  const resolved = useResolvedUrl(url);
  if (!resolved) return <p className="text-sm text-muted-foreground">No video available</p>;
  return (
    <video
      src={resolved}
      controls
      className={
        compact
          ? "w-full rounded-lg bg-black max-h-[260px] ring-1 ring-border/60"
          : "w-full rounded-md bg-black max-h-[420px]"
      }
    />
  );
}

export function PdfBlock({
  url,
  fileName,
  variant = "default",
}: {
  url?: string;
  fileName?: string;
  /** default = lesson viewer (fixed height + links). studio = editor preview (tall viewport panel + toolbar). */
  variant?: "default" | "studio";
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const isStudio = variant === "studio";

  useEffect(() => {
    if (!url) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        if (url.startsWith("mock-asset://")) {
          const blob = await getFile(url);
          if (cancelled) return;
          if (blob) {
            const pdfBlob = blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" });
            const objUrl = URL.createObjectURL(pdfBlob);
            setBlobUrl(objUrl);
          } else {
            setError(true);
          }
        } else {
          setBlobUrl(url);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    const currentUrl = blobUrl;
    return () => {
      if (currentUrl && currentUrl.startsWith("blob:")) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [blobUrl]);

  const studioShell = "flex flex-col overflow-hidden rounded-xl border bg-card shadow-md ring-1 ring-border/50";
  const studioViewport = "relative h-[min(75vh,880px)] min-h-[520px] w-full max-h-[920px] bg-white dark:bg-zinc-950";

  if (!url) return <p className="text-sm text-muted-foreground">No PDF available</p>;

  if (loading) {
    if (isStudio) {
      return (
        <div className={cn(studioShell)}>
          <div className="h-11 shrink-0 animate-pulse border-b bg-muted/40" />
          <div
            className={cn(
              studioViewport,
              "flex flex-col items-center justify-center gap-3 border-t-0 text-sm text-muted-foreground"
            )}
          >
            <span className="inline-flex h-10 w-10 animate-pulse rounded-full bg-muted-foreground/15" />
            Loading PDF…
          </div>
        </div>
      );
    }
    return (
      <div className="flex h-[480px] w-full flex-col items-center justify-center gap-2 rounded-lg border bg-muted/20 text-sm text-muted-foreground">
        <span className="inline-flex h-8 w-8 animate-pulse rounded-full bg-muted-foreground/20" />
        Loading PDF…
      </div>
    );
  }

  if (blobUrl && !error && isStudio) {
    return (
      <div className={studioShell}>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-gradient-to-r from-rose-500/5 via-muted/40 to-transparent px-3 py-2.5 sm:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-500/20 bg-background text-rose-600 dark:text-rose-400">
              <FileType className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">{fileName ?? "Document.pdf"}</p>
              <p className="text-xs text-muted-foreground">Scroll inside the frame to read pages</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Button variant="outline" size="sm" className="h-8" asChild>
              <a href={blobUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                New tab
              </a>
            </Button>
            <Button size="sm" className="h-8" asChild>
              <a href={blobUrl} download={fileName ?? "document.pdf"}>
                Download
              </a>
            </Button>
          </div>
        </div>
        <div className={studioViewport}>
          <iframe
            src={blobUrl}
            title={fileName ?? "PDF Document"}
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {blobUrl && !error ? (
        <iframe
          src={blobUrl}
          title={fileName ?? "PDF Document"}
          className="h-[600px] w-full rounded-lg border bg-white shadow-inner"
        />
      ) : (
        <div className="flex w-full flex-col items-center justify-center gap-3 rounded-lg border bg-muted/20 p-6 text-center">
          <FileType className="h-12 w-12 text-destructive/70" />
          <p className="text-sm text-muted-foreground">
            {error ? "Could not load PDF preview." : "PDF preview not available."}
          </p>
          {blobUrl && (
            <a
              href={blobUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary hover:underline"
            >
              Open PDF in new tab
            </a>
          )}
        </div>
      )}
      {blobUrl && !error && !isStudio && (
        <div className="flex flex-wrap gap-3">
          <a href={blobUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
            Open in new tab
          </a>
          <a href={blobUrl} download={fileName ?? "document.pdf"} className="text-sm text-primary hover:underline">
            Download PDF
          </a>
        </div>
      )}
    </div>
  );
}

export function DownloadBlock({ url, fileName }: { url?: string; fileName?: string }) {
  const resolved = useResolvedUrl(url);
  if (!resolved) return <p className="text-sm text-muted-foreground">No file available</p>;
  return (
    <a
      className="text-primary underline-offset-4 hover:underline inline-flex items-center gap-2 font-medium"
      href={resolved}
      download={fileName}
    >
      Download {fileName ?? "file"}
    </a>
  );
}
