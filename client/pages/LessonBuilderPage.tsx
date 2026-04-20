import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLms } from "@/context/LmsContext";
import { usePermissions } from "@/hooks/usePermissions";
import type { LessonBlock, LessonBlockType } from "@shared/lms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress as ProgressBar } from "@/components/ui/progress";
import { EmptyState } from "@/components/PageState";
import { useToast } from "@/hooks/use-toast";
import {
  ACCEPT_DOCUMENT,
  ACCEPT_DOWNLOAD,
  ACCEPT_IMAGE,
  ACCEPT_VIDEO,
  effectiveContentType,
  validateUploadForBlock,
} from "@/lib/validators";
import { ArrowDown, ArrowUp, BookCheck, History, Plus, Trash2, Upload } from "lucide-react";
import { lessonTitleSchema } from "@/lib/validators";
import { storeFile } from "@/lib/mock/fileStorage";
import { LessonBlockPreview } from "@/components/lesson/LessonBlockPreview";
import { QuizBlockEditor } from "@/components/lesson/QuizBlockEditor";
import { Separator } from "@/components/ui/separator";

function clientId() {
  return `new-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function isClientBlock(id: string) {
  return id.startsWith("new-");
}

function tryQuizDataFromBody(body: string | undefined): unknown | undefined {
  if (!body?.trim()) return undefined;
  try {
    const o = JSON.parse(body) as unknown;
    return typeof o === "object" && o !== null ? o : undefined;
  } catch {
    return undefined;
  }
}

function sanitizeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("blob:")) return undefined;
  // mock-asset:// URLs are persisted in IndexedDB — keep them
  return url;
}

export default function LessonBuilderPage() {
  const { courseId, lessonId = "" } = useParams();
  const isNew = !lessonId || lessonId === "new";
  const standalone = !courseId;
  const { user } = useAuth();
  const { canEditCourse } = usePermissions();
  const {
    getCourse,
    getLesson,
    fetchLesson,
    createLesson,
    createStandaloneLesson,
    updateLesson,
    publishLesson,
    archiveLesson,
    addBlock: apiAddBlock,
    updateBlock: apiUpdateBlock,
    removeBlock: apiRemoveBlock,
    reorderBlocks: apiReorderBlocks,
    getUploadUrl,
    checkStaleLesson,
    refresh,
  } = useLms();
  const navigate = useNavigate();
  const { toast } = useToast();

  const course = courseId ? getCourse(courseId) : undefined;
  const existing = !isNew && lessonId ? getLesson(lessonId) : undefined;

  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [sequential, setSequential] = useState(existing?.sequential ?? true);
  const [blocks, setBlocks] = useState<LessonBlock[]>(existing?.blocks ?? []);
  const [baseline, setBaseline] = useState(existing?.updatedAt);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);

  const serverBlocksRef = useRef<LessonBlock[]>(existing?.blocks ?? []);
  const pendingFilesRef = useRef<Map<string, File>>(new Map());

  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setDescription(existing.description);
      setSequential(existing.sequential);
      setBlocks(existing.blocks);
      setBaseline(existing.updatedAt);
      serverBlocksRef.current = existing.blocks;
    }
  }, [existing]);

  useEffect(() => {
    if (isNew || !lessonId) return;
    let cancelled = false;
    void (async () => {
      try {
        await fetchLesson(lessonId);
      } catch (e: any) {
        if (!cancelled) {
          toast({ title: "Could not load lesson", description: e?.message ?? String(e), variant: "destructive" });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast is stable; avoid re-fetch loops
  }, [isNew, lessonId, fetchLesson]);

  if (!user) {
    return <EmptyState title="Not found" />;
  }

  if (!standalone && (!courseId || !course)) {
    return <EmptyState title="Course not found" />;
  }

  if (course && !canEditCourse(course)) {
    return <EmptyState title="Access denied" description="You cannot edit lessons for this course." />;
  }

  const stale = existing && baseline && checkStaleLesson(existing.id, baseline);

  const addBlock = (type: LessonBlockType) => {
    const order = blocks.length;
    const defaultQuiz = type === "quiz" ? JSON.stringify({ questions: [] }, null, 2) : "";
    setBlocks((b) => [...b, { id: clientId(), type, order, title: "", body: defaultQuiz }]);
  };

  const patchBlock = (id: string, patch: Partial<LessonBlock>) => {
    setBlocks((b) => b.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const removeBlockLocal = (id: string) => {
    pendingFilesRef.current.delete(id);
    setBlocks((b) => b.filter((x) => x.id !== id).map((x, i) => ({ ...x, order: i })));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[idx], next[j]] = [next[j], next[idx]];
    setBlocks(next.map((x, i) => ({ ...x, order: i })));
  };

  const uploadFile = async (file: File, block: LessonBlock, targetLessonId: string) => {
    setUploadTarget(block.id);
    setUploadPct(0);
    try {
      const mime = effectiveContentType(file);
      const result = await getUploadUrl(
        targetLessonId,
        file.name,
        mime,
        block.type,
        isClientBlock(block.id) ? undefined : block.id
      );
      const uploadUrl = result?.uploadUrl;
      const assetUrl = result?.assetUrl;
      if (!uploadUrl || !assetUrl) {
        throw new Error("Backend returned empty upload/asset URL");
      }

      if (uploadUrl.startsWith("mock-asset://")) {
        // Mock mode: store file in IndexedDB for persistence
        setUploadPct(30);
        await storeFile(assetUrl, file);
        setUploadPct(100);
      } else {
        const putWithXhr = () =>
          new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.upload.addEventListener("progress", (e) => {
              if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100));
            });
            xhr.addEventListener("load", () => {
              if (xhr.status >= 200 && xhr.status < 300) resolve();
              else reject(new Error(`Upload returned ${xhr.status}: ${xhr.statusText}`));
            });
            xhr.addEventListener("error", () => {
              reject(
                new Error(
                  "XHR upload failed — check that the bucket CORS policy allows PUT from this origin"
                )
              );
            });
            xhr.open("PUT", uploadUrl);
            xhr.withCredentials = false;
            xhr.setRequestHeader("Content-Type", mime);
            xhr.send(file);
          });

        try {
          await putWithXhr();
        } catch {
          setUploadPct(40);
          const res = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": mime } });
          if (!res.ok) {
            throw new Error(
              `Upload failed (${res.status}). If the URL is a public S3 object URL, ensure CORS allows PUT from this site.`
            );
          }
          setUploadPct(100);
        }
      }
      patchBlock(block.id, {
        assetUrl,
        fileName: file.name,
        s3Bucket: result.s3Bucket || undefined,
        s3Key: result.s3Key || undefined,
      });
      toast({ title: "Upload complete" });
      return assetUrl;
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
      return null;
    } finally {
      setUploadPct(null);
      setUploadTarget(null);
    }
  };

  const onPickFile = async (block: LessonBlock, file: File | undefined) => {
    if (!file) return;
    let mode: "video" | "pdf" | "image" | "download" = "download";
    if (block.type === "video") mode = "video";
    if (block.type === "pdf") mode = "pdf";
    if (block.type === "image") mode = "image";
    const v = validateUploadForBlock(file, mode);
    if (v.ok === false) {
      toast({ title: "Invalid file", description: v.message, variant: "destructive" });
      return;
    }
    if (existing?.id) {
      await uploadFile(file, block, existing.id);
    } else {
      pendingFilesRef.current.set(block.id, file);
      const url = URL.createObjectURL(file);
      patchBlock(block.id, { assetUrl: url, fileName: file.name });
      toast({ title: "File attached (will upload on save)" });
    }
  };

  const syncBlocks = async (targetLessonId: string) => {
    const serverBlocks = serverBlocksRef.current;
    const serverIds = new Set(serverBlocks.map((b) => b.id));
    const currentIds = new Set(blocks.map((b) => b.id));

    const removed = serverBlocks.filter((b) => !currentIds.has(b.id));
    for (const b of removed) {
      await apiRemoveBlock(targetLessonId, b.id);
    }

    const newBlocks = blocks.filter((b) => isClientBlock(b.id));
    for (const b of newBlocks) {
      const isTextType = b.type === "text" || b.type === "quiz";
      let resolvedAssetUrl = sanitizeUrl(b.assetUrl);

      const pendingFile = pendingFilesRef.current.get(b.id);
      if (pendingFile) {
        const uploaded = await uploadFile(pendingFile, b, targetLessonId);
        resolvedAssetUrl = uploaded ?? undefined;
        pendingFilesRef.current.delete(b.id);
      }

      await apiAddBlock(targetLessonId, {
        type: b.type,
        order: b.order,
        title: b.title || undefined,
        body: isTextType ? b.body : undefined,
        quizData: b.type === "quiz" ? tryQuizDataFromBody(b.body) : undefined,
        assetUrl: resolvedAssetUrl || undefined,
        fileName: resolvedAssetUrl ? b.fileName || undefined : undefined,
        s3Bucket: b.s3Bucket,
        s3Key: b.s3Key,
      });
    }

    const updated = blocks.filter((b) => !isClientBlock(b.id) && serverIds.has(b.id));
    for (const b of updated) {
      const orig = serverBlocks.find((s) => s.id === b.id);
      if (!orig) continue;
      const changed =
        b.title !== orig.title ||
        b.body !== orig.body ||
        b.order !== orig.order ||
        b.assetUrl !== orig.assetUrl ||
        b.fileName !== orig.fileName ||
        b.s3Key !== orig.s3Key ||
        b.s3Bucket !== orig.s3Bucket;
      if (changed) {
        await apiUpdateBlock(targetLessonId, b.id, {
          title: b.title,
          order: b.order,
          body: b.body,
          quizData: b.type === "quiz" ? tryQuizDataFromBody(b.body) : undefined,
          assetUrl: sanitizeUrl(b.assetUrl),
          fileName: b.fileName,
          s3Bucket: b.s3Bucket,
          s3Key: b.s3Key,
        });
      }
    }

    if (newBlocks.length > 0 || removed.length > 0 || blocks.some((b, i) => {
      const orig = serverBlocks.find((s) => s.id === b.id);
      return orig && orig.order !== i;
    })) {
      await refresh();
      const freshLesson = getLesson(targetLessonId);
      if (freshLesson && freshLesson.blocks.length > 0) {
        const desiredOrder = blocks.map((b) => {
          if (isClientBlock(b.id)) {
            const match = freshLesson.blocks.find((fb) =>
              fb.title === b.title && fb.order === b.order && !blocks.some((ob) => ob.id === fb.id && !isClientBlock(ob.id))
            );
            return match?.id;
          }
          return b.id;
        }).filter(Boolean) as string[];

        if (desiredOrder.length === freshLesson.blocks.length) {
          const serverOrder = freshLesson.blocks.map((fb) => fb.id);
          const needsReorder = desiredOrder.some((id, i) => id !== serverOrder[i]);
          if (needsReorder) {
            try { await apiReorderBlocks(targetLessonId, desiredOrder); } catch {}
          }
        }
      }
    }
  };

  const save = async () => {
    const parsed = lessonTitleSchema.safeParse(title);
    if (!parsed.success) {
      toast({ title: "Validation", description: parsed.error.issues[0]?.message, variant: "destructive" });
      return;
    }
    if (stale) {
      toast({ title: "Stale lesson", description: "Refresh before saving.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const created = standalone
          ? await createStandaloneLesson({ title, description, sequential })
          : await createLesson(courseId!, { title, description, sequential });
        if (!created) throw new Error("Lesson creation failed — backend returned no lesson ID");

        const blockErrors: string[] = [];
        for (const b of blocks) {
          try {
            const isTextType = b.type === "text" || b.type === "quiz";
            let resolvedAssetUrl = sanitizeUrl(b.assetUrl);

            const pendingFile = pendingFilesRef.current.get(b.id);
            if (pendingFile) {
              const uploaded = await uploadFile(pendingFile, b, created.id);
              resolvedAssetUrl = uploaded ?? undefined;
              pendingFilesRef.current.delete(b.id);
            }

            await apiAddBlock(created.id, {
              type: b.type,
              order: b.order,
              title: b.title || undefined,
              body: isTextType ? b.body : undefined,
              quizData: b.type === "quiz" ? tryQuizDataFromBody(b.body) : undefined,
              assetUrl: resolvedAssetUrl || undefined,
              fileName: resolvedAssetUrl ? b.fileName || undefined : undefined,
              s3Bucket: b.s3Bucket,
              s3Key: b.s3Key,
            });
          } catch (blockErr: any) {
            blockErrors.push(`${b.type} block "${b.title || `#${b.order + 1}`}": ${blockErr.message}`);
          }
        }

        pendingFilesRef.current.clear();
        await refresh();
        if (blockErrors.length > 0) {
          toast({
            title: "Lesson created with errors",
            description: blockErrors.join("; "),
            variant: "destructive",
          });
        } else {
          toast({ title: "Lesson created" });
        }
        if (standalone) {
          navigate(`/lessons/${created.id}/edit`, { replace: true });
        } else {
          navigate(`/courses/${courseId}/lessons/${created.id}`, { replace: true });
        }
      } else if (lessonId) {
        await updateLesson(lessonId, {
          title,
          description,
          sequential,
          baselineUpdatedAt: baseline,
        });
        await syncBlocks(lessonId);
        await refresh();
        const updated = getLesson(lessonId);
        setBaseline(updated?.updatedAt);
        if (updated) serverBlocksRef.current = updated.blocks;
        toast({ title: "Saved" });
      }
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const onPublish = async () => {
    if (!existing) return;
    setPublishing(true);
    try {
      await publishLesson(existing.id, baseline);
      toast({ title: "Lesson published" });
    } catch (err: any) {
      toast({ title: "Publish failed", description: err.message, variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  const onArchive = async () => {
    if (!existing) return;
    try {
      await archiveLesson(existing.id, baseline);
      toast({ title: "Lesson archived" });
    } catch (err: any) {
      toast({ title: "Archive failed", description: err.message, variant: "destructive" });
    }
  };

  const backPath = standalone ? "/lessons" : `/courses/${courseId}`;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{isNew ? "New lesson" : "Lesson editor"}</h1>
          <p className="text-sm text-muted-foreground">
            {standalone ? "Standalone lesson — attach to a course later" : `Course: ${course?.title}`}
          </p>
        </div>
        <div className="flex gap-2">
          {!isNew && existing && !standalone && (
            <>
              <Button variant="outline" size="sm" onClick={onPublish} disabled={publishing}>
                <BookCheck className="h-4 w-4 mr-1" />
                {publishing ? "Publishing…" : "Publish"}
              </Button>
              <Button variant="ghost" size="sm" onClick={onArchive}>
                Archive
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/courses/${courseId}/lessons/${lessonId}/history`}>
                  <History className="h-4 w-4 mr-1" />
                  Version history
                </Link>
              </Button>
            </>
          )}
          <Button variant="outline" asChild>
            <Link to={backPath}>Back</Link>
          </Button>
        </div>
      </div>

      {stale && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          This lesson changed in another tab. Refresh before editing.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={500} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="seq" checked={sequential} onCheckedChange={setSequential} />
            <Label htmlFor="seq">Sequential completion (lock next lesson until previous done)</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {(["text", "video", "pdf", "image", "quiz", "download"] as LessonBlockType[]).map((t) => (
          <Button key={t} type="button" variant="secondary" size="sm" onClick={() => addBlock(t)}>
            <Plus className="h-4 w-4 mr-1" />
            {t === "pdf" ? "PDF" : t.charAt(0).toUpperCase() + t.slice(1)}
          </Button>
        ))}
      </div>

      <div className="space-y-4">
        {blocks.length === 0 && (
          <EmptyState title="No content blocks" description="Add blocks to build your lesson." />
        )}
        {blocks.map((block, idx) => (
          <Card key={block.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium capitalize">{block.type}</CardTitle>
              <div className="flex gap-1">
                <Button type="button" size="icon" variant="ghost" onClick={() => move(idx, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" onClick={() => move(idx, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" onClick={() => removeBlockLocal(block.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Block title (optional)"
                value={block.title ?? ""}
                onChange={(e) => patchBlock(block.id, { title: e.target.value })}
              />
              {block.type === "text" && (
                <Textarea
                  placeholder="Text content (Markdown supported)"
                  value={block.body ?? ""}
                  onChange={(e) => patchBlock(block.id, { body: e.target.value })}
                  rows={6}
                />
              )}
              {block.type === "quiz" && (
                <QuizBlockEditor
                  body={block.body}
                  onChange={(json) => patchBlock(block.id, { body: json })}
                  disabled={!!stale}
                />
              )}
              {(block.type === "video" || block.type === "pdf" || block.type === "download" || block.type === "image") && (
                <div className="space-y-2">
                  <Input
                    type="file"
                    accept={
                      block.type === "video"
                        ? ACCEPT_VIDEO
                        : block.type === "image"
                          ? ACCEPT_IMAGE
                          : block.type === "pdf"
                            ? ACCEPT_DOCUMENT
                            : ACCEPT_DOWNLOAD
                    }
                    onChange={(e) => onPickFile(block, e.target.files?.[0])}
                  />
                  {uploadTarget === block.id && uploadPct !== null && (
                    <div className="space-y-1">
                      <ProgressBar value={uploadPct} className="h-2" />
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Upload className="h-3 w-3" /> Uploading… {uploadPct}%
                      </p>
                    </div>
                  )}
                  {block.assetUrl && (
                    <p className="text-xs text-muted-foreground truncate">Attached: {block.fileName ?? block.assetUrl}</p>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Change type</span>
                <Select
                  value={block.type}
                  onValueChange={(v) => patchBlock(block.id, { type: v as LessonBlockType })}
                >
                  <SelectTrigger className="w-[180px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="quiz">Quiz</SelectItem>
                    <SelectItem value="download">Download</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator className="my-1" />
              <LessonBlockPreview block={block} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Button onClick={save} disabled={saving || !!stale}>
        {saving ? "Saving…" : "Save lesson"}
      </Button>
    </div>
  );
}
