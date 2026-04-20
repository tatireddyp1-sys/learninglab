import ReactMarkdown from "react-markdown";
import {
  Eye,
  FileText,
  Image as ImageIcon,
  Video,
  FileQuestion,
  FileType,
  Download,
  Sparkles,
  Package,
} from "lucide-react";
import type { LessonBlock, LessonBlockType } from "@shared/lms";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DownloadBlock,
  ImageBlock,
  extractQuizQuestionsFromBlock,
  OfficeDocumentViewer,
  QuizRenderer,
  VideoBlock,
} from "./LessonBlockMedia";

const TYPE_CONFIG: Record<
  LessonBlockType,
  { label: string; Icon: typeof FileText; shell: string; accent: string }
> = {
  text: {
    label: "Text",
    Icon: FileText,
    shell: "from-slate-500/8 via-card to-card border-slate-500/15",
    accent: "text-slate-600 dark:text-slate-300",
  },
  image: {
    label: "Image",
    Icon: ImageIcon,
    shell: "from-emerald-500/10 via-card to-card border-emerald-500/20",
    accent: "text-emerald-600 dark:text-emerald-400",
  },
  video: {
    label: "Video",
    Icon: Video,
    shell: "from-violet-500/10 via-card to-card border-violet-500/20",
    accent: "text-violet-600 dark:text-violet-400",
  },
  quiz: {
    label: "Quiz",
    Icon: FileQuestion,
    shell: "from-amber-500/10 via-card to-card border-amber-500/20",
    accent: "text-amber-700 dark:text-amber-400",
  },
  pdf: {
    label: "PDF",
    Icon: FileType,
    shell: "from-rose-500/10 via-card to-card border-rose-500/20",
    accent: "text-rose-600 dark:text-rose-400",
  },
  download: {
    label: "Download",
    Icon: Download,
    shell: "from-cyan-500/10 via-card to-card border-cyan-500/20",
    accent: "text-cyan-700 dark:text-cyan-400",
  },
};

function downloadKind(fileName?: string): "pdf" | "video" | "image" | "archive" | "other" {
  const ext = (fileName?.split(".").pop() ?? "").toLowerCase();
  if (["pdf"].includes(ext)) return "pdf";
  if (["mp4", "mov", "webm"].includes(ext)) return "video";
  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)) return "image";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive";
  return "other";
}

function DownloadPreviewShell({ block }: { block: LessonBlock }) {
  const kind = downloadKind(block.fileName);
  const Icon =
    kind === "pdf"
      ? FileType
      : kind === "video"
        ? Video
        : kind === "image"
          ? ImageIcon
          : kind === "archive"
            ? Package
            : FileText;

  return (
    <div className="rounded-xl border bg-gradient-to-br from-cyan-950/25 via-card to-card p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border bg-background/80 shadow-inner",
            kind === "pdf" && "border-rose-500/25 text-rose-500",
            kind === "video" && "border-violet-500/25 text-violet-500",
            kind === "image" && "border-emerald-500/25 text-emerald-500",
            kind === "archive" && "border-cyan-500/25 text-cyan-500",
            kind === "other" && "border-muted-foreground/30 text-muted-foreground"
          )}
        >
          <Icon className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium truncate">{block.fileName ?? "Attached file"}</p>
          <p className="text-xs text-muted-foreground">Learners can download this resource.</p>
        </div>
        <div className="shrink-0">
          <DownloadBlock url={block.assetUrl} fileName={block.fileName} />
        </div>
      </div>
      {(kind === "video" || kind === "image") && block.assetUrl && (
        <div className="mt-4 rounded-lg border bg-black/5 dark:bg-black/40 overflow-hidden">
          {kind === "video" ? (
            <VideoBlock url={block.assetUrl} compact />
          ) : (
            <ImageBlock url={block.assetUrl} alt={block.title} compact />
          )}
        </div>
      )}
    </div>
  );
}

export function LessonBlockPreview({ block, className }: { block: LessonBlock; className?: string }) {
  const cfg = TYPE_CONFIG[block.type];
  const Icon = cfg.Icon;
  const quizQuestions = block.type === "quiz" ? extractQuizQuestionsFromBlock(block) : null;
  const hasBody = Boolean(block.body?.trim());
  const hasAsset = Boolean(block.assetUrl?.trim());

  return (
    <div
      className={cn(
        "rounded-xl border bg-gradient-to-br shadow-sm",
        block.type === "pdf" ? "overflow-visible" : "overflow-hidden",
        cfg.shell,
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-border/60 bg-background/40 px-3 py-2 backdrop-blur-sm">
        <Eye className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Live preview</span>
        <Icon className={cn("ml-1 h-3.5 w-3.5", cfg.accent)} aria-hidden />
        <Badge variant="secondary" className="ml-auto text-[10px] font-semibold">
          {cfg.label}
        </Badge>
      </div>

      <div className="border-l-4 border-l-primary/40 bg-card/80 p-4 sm:p-5">
        {block.type === "text" && (
          <div>
            {!hasBody ? (
              <p className="text-sm text-muted-foreground italic">Nothing to preview yet — add Markdown above.</p>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-code:bg-muted prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-pre:bg-slate-900 prose-pre:text-white rounded-lg bg-muted/20 p-4 ring-1 ring-border/50">
                <ReactMarkdown>{block.body ?? ""}</ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {block.type === "image" && (
          <div className="flex justify-center rounded-lg bg-muted/15 p-2 ring-1 ring-inset ring-border/40">
            {hasAsset ? (
              <ImageBlock url={block.assetUrl} alt={block.title} compact />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
                <ImageIcon className="h-10 w-10 opacity-40" />
                <p>Upload an image to see it here.</p>
              </div>
            )}
          </div>
        )}

        {block.type === "video" && (
          <div className="rounded-lg bg-black/90 p-1 ring-1 ring-border/50 shadow-inner">
            {hasAsset ? (
              <VideoBlock url={block.assetUrl} compact />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-14 text-center text-sm text-muted-foreground">
                <Video className="h-10 w-10 opacity-50" />
                <p>Upload a video file to preview playback.</p>
              </div>
            )}
          </div>
        )}

        {block.type === "pdf" && (
          <div className="rounded-lg ring-1 ring-border/30">
            {hasAsset ? (
              <OfficeDocumentViewer url={block.assetUrl} fileName={block.fileName} variant="studio" />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
                <FileType className="h-10 w-10 opacity-40" />
                <p>Upload a PDF to see an inline preview.</p>
              </div>
            )}
          </div>
        )}

        {block.type === "download" && (
          <div>
            {hasAsset ? (
              <DownloadPreviewShell block={block} />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
                <Download className="h-10 w-10 opacity-40" />
                <p>Attach a file for download preview.</p>
              </div>
            )}
          </div>
        )}

        {block.type === "quiz" && (
          <div className="space-y-3">
            {quizQuestions ? (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-4">
                <QuizRenderer questions={quizQuestions} />
              </div>
            ) : (
              <div>
                {!hasBody ? (
                  <div className="flex items-start gap-3 rounded-lg border border-dashed border-amber-500/30 bg-amber-500/5 p-4 text-sm text-muted-foreground">
                    <Sparkles className="h-5 w-5 shrink-0 text-amber-500/80" />
                    <div>
                      <p className="font-medium text-foreground">Structured quiz</p>
                      <p className="mt-1 text-xs leading-relaxed">
                        Paste JSON with a <code className="rounded bg-muted px-1">questions</code> array (each with{" "}
                        <code className="rounded bg-muted px-1">id</code>, <code className="rounded bg-muted px-1">text</code>,{" "}
                        <code className="rounded bg-muted px-1">options</code>, <code className="rounded bg-muted px-1">correctId</code>) for
                        an interactive preview, or use Markdown below for a reading-style quiz note.
                      </p>
                    </div>
                  </div>
                ) : null}
                {hasBody && (
                  <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg bg-muted/20 p-4 ring-1 ring-border/50">
                    <ReactMarkdown>{block.body}</ReactMarkdown>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
