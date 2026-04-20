import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from "lucide-react";

function newQuestionId() {
  return `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export type UiQuizQuestion = {
  id: string;
  mode: "single" | "multi";
  prompt: string;
  options: string[];
  correctSingleIndex: number;
  correctMultiIndices: number[];
};

export type UiQuizPayload = { questions: UiQuizQuestion[] };

function normalizeOptions(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0) return ["", ""];
  const out: string[] = [];
  for (const o of raw) {
    if (typeof o === "string") out.push(o);
    else if (o && typeof o === "object" && "text" in o) out.push(String((o as { text?: unknown }).text ?? ""));
    else out.push(String(o));
  }
  while (out.length < 2) out.push("");
  return out;
}

function parseQuestion(raw: unknown): UiQuizQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const q = raw as Record<string, unknown>;
  const id = String(q.id ?? newQuestionId());
  const typeStr = String(q.type ?? "single-choice").toLowerCase();
  const mode: "single" | "multi" = typeStr.includes("multi") || typeStr === "multiple" ? "multi" : "single";
  const prompt = String(q.question ?? q.prompt ?? q.text ?? "");
  const options = normalizeOptions(q.options);

  let correctSingleIndex = 0;
  let correctMultiIndices: number[] = [0];

  if (mode === "single") {
    const ans = q.answer ?? q.correctAnswer;
    if (typeof ans === "string" && ans.trim()) {
      const idx = options.findIndex((o) => o.trim() === ans.trim());
      correctSingleIndex = idx >= 0 ? idx : 0;
    } else if (q.correctId != null && Array.isArray(q.options) && q.options.length && typeof q.options[0] === "object") {
      const cid = String(q.correctId);
      const idx = (q.options as { id?: unknown }[]).findIndex((o) => String(o?.id) === cid);
      correctSingleIndex = idx >= 0 ? idx : 0;
    }
  } else {
    const arr = q.answers ?? q.correctAnswers;
    if (Array.isArray(arr)) {
      const set = new Set<number>();
      for (const a of arr) {
        const s = String(a).trim();
        const idx = options.findIndex((o) => o.trim() === s);
        if (idx >= 0) set.add(idx);
      }
      correctMultiIndices = set.size ? [...set].sort((a, b) => a - b) : [0];
    }
  }

  return {
    id,
    mode,
    prompt,
    options,
    correctSingleIndex: Math.min(Math.max(0, correctSingleIndex), Math.max(0, options.length - 1)),
    correctMultiIndices,
  };
}

export function parseQuizBody(body: string | undefined): UiQuizPayload {
  if (!body?.trim()) return { questions: [] };
  try {
    const parsed = JSON.parse(body) as { questions?: unknown };
    const rawList = parsed.questions ?? (Array.isArray(parsed) ? parsed : null);
    if (!Array.isArray(rawList)) return { questions: [] };
    const questions = rawList.map(parseQuestion).filter(Boolean) as UiQuizQuestion[];
    return { questions };
  } catch {
    return { questions: [] };
  }
}

export function serializeQuizPayload(d: UiQuizPayload): string {
  const questions = d.questions.map((q) => {
    const raw = q.options;
    const opts = raw.map((o) => o.trim()).filter((o) => o.length > 0);
    const options = opts.length >= 2 ? opts : ["Option 1", "Option 2"];

    if (q.mode === "single") {
      let answer = raw[q.correctSingleIndex]?.trim();
      if (!answer || !options.includes(answer)) {
        const fallback = raw.map((o) => o.trim()).filter(Boolean);
        answer =
          fallback[Math.min(q.correctSingleIndex, Math.max(0, fallback.length - 1))] ?? options[0];
      }
      if (!options.includes(answer)) answer = options[0];

      return {
        id: q.id,
        type: "single-choice",
        question: q.prompt.trim() || "Untitled question",
        options,
        answer,
      };
    }

    const fromIndices = q.correctMultiIndices
      .map((i) => raw[i]?.trim())
      .filter((t): t is string => Boolean(t && options.includes(t)));
    const answers = [...new Set(fromIndices)];
    const finalAnswers = answers.length ? answers : [options[0]];

    return {
      id: q.id,
      type: "multi-choice",
      question: q.prompt.trim() || "Untitled question",
      options,
      answers: finalAnswers,
    };
  });

  return JSON.stringify({ questions }, null, 2);
}

type Props = {
  body: string | undefined;
  onChange: (json: string) => void;
  disabled?: boolean;
};

export function QuizBlockEditor({ body, onChange, disabled }: Props) {
  const [draft, setDraft] = useState<UiQuizPayload>(() => parseQuizBody(body));
  const lastEmitted = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (body === lastEmitted.current) return;
    lastEmitted.current = body;
    setDraft(parseQuizBody(body));
  }, [body]);

  const commit = useCallback(
    (updater: UiQuizPayload | ((prev: UiQuizPayload) => UiQuizPayload)) => {
      setDraft((prev) => {
        const next = typeof updater === "function" ? (updater as (p: UiQuizPayload) => UiQuizPayload)(prev) : updater;
        const json = serializeQuizPayload(next);
        lastEmitted.current = json;
        onChange(json);
        return next;
      });
    },
    [onChange]
  );

  const addQuestion = () => {
    commit((d) => ({
      questions: [
        ...d.questions,
        {
          id: newQuestionId(),
          mode: "single",
          prompt: "",
          options: ["", ""],
          correctSingleIndex: 0,
          correctMultiIndices: [0],
        },
      ],
    }));
  };

  const removeQuestion = (index: number) => {
    commit((d) => ({ questions: d.questions.filter((_, i) => i !== index) }));
  };

  const moveQuestion = (index: number, dir: -1 | 1) => {
    commit((d) => {
      const j = index + dir;
      if (j < 0 || j >= d.questions.length) return d;
      const questions = [...d.questions];
      [questions[index], questions[j]] = [questions[j], questions[index]];
      return { questions };
    });
  };

  const updateQuestion = (index: number, patch: Partial<UiQuizQuestion>) => {
    commit((d) => ({
      questions: d.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    }));
  };

  const setOption = (qi: number, oi: number, value: string) => {
    commit((d) => {
      const q = d.questions[qi];
      if (!q) return d;
      const options = [...q.options];
      options[oi] = value;
      let correctSingleIndex = q.correctSingleIndex;
      if (q.mode === "single") {
        correctSingleIndex = Math.min(correctSingleIndex, Math.max(0, options.length - 1));
      }
      return {
        questions: d.questions.map((x, i) => (i === qi ? { ...x, options, correctSingleIndex } : x)),
      };
    });
  };

  const addOption = (qi: number) => {
    commit((d) => {
      const q = d.questions[qi];
      if (!q) return d;
      return {
        questions: d.questions.map((x, i) => (i === qi ? { ...x, options: [...q.options, ""] } : x)),
      };
    });
  };

  const removeOption = (qi: number, oi: number) => {
    commit((d) => {
      const q = d.questions[qi];
      if (!q || q.options.length <= 2) return d;
      const options = q.options.filter((_, i) => i !== oi);
      let correctSingleIndex = q.correctSingleIndex;
      if (q.mode === "single") {
        if (oi < correctSingleIndex) correctSingleIndex -= 1;
        else if (oi === correctSingleIndex) correctSingleIndex = Math.min(correctSingleIndex, options.length - 1);
        correctSingleIndex = Math.max(0, Math.min(correctSingleIndex, options.length - 1));
      }
      let correctMultiIndices = q.correctMultiIndices
        .filter((i) => i !== oi)
        .map((i) => (i > oi ? i - 1 : i))
        .filter((i) => i >= 0 && i < options.length);
      if (q.mode === "multi" && correctMultiIndices.length === 0) correctMultiIndices = [0];
      return {
        questions: d.questions.map((x, i) =>
          i === qi ? { ...x, options, correctSingleIndex, correctMultiIndices } : x
        ),
      };
    });
  };

  return (
    <div className="space-y-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">Quiz questions</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add questions, enter each answer choice, then mark which one is correct.
          </p>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={addQuestion} disabled={disabled}>
          <Plus className="h-4 w-4 mr-1" />
          Add question
        </Button>
      </div>

      {draft.questions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-background/50 py-10 text-center text-sm text-muted-foreground">
          No questions yet. Click &quot;Add question&quot; to create your first question.
        </div>
      ) : (
        <ul className="space-y-4">
          {draft.questions.map((q, qi) => (
            <li key={q.id} className="rounded-lg border bg-card shadow-sm overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-3 py-2">
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                <span className="text-xs font-medium text-muted-foreground">Question {qi + 1}</span>
                <div className="ml-auto flex gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={disabled || qi === 0}
                    onClick={() => moveQuestion(qi, -1)}
                    aria-label="Move question up"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={disabled || qi === draft.questions.length - 1}
                    onClick={() => moveQuestion(qi, 1)}
                    aria-label="Move question down"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    disabled={disabled}
                    onClick={() => removeQuestion(qi)}
                    aria-label="Remove question"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`qq-${q.id}`}>Question</Label>
                  <Textarea
                    id={`qq-${q.id}`}
                    placeholder="e.g. What is 2 + 2?"
                    value={q.prompt}
                    onChange={(e) => updateQuestion(qi, { prompt: e.target.value })}
                    rows={2}
                    disabled={disabled}
                    className="resize-y min-h-[60px]"
                  />
                </div>

                <div className="space-y-2 max-w-xs">
                  <Label>Answer type</Label>
                  <Select
                    value={q.mode}
                    onValueChange={(v) => {
                      const mode = v as "single" | "multi";
                      if (mode === "multi") {
                        updateQuestion(qi, {
                          mode,
                          correctMultiIndices: [q.correctSingleIndex],
                        });
                      } else {
                        const first = q.correctMultiIndices[0] ?? 0;
                        updateQuestion(qi, {
                          mode,
                          correctSingleIndex: Math.min(first, q.options.length - 1),
                        });
                      }
                    }}
                    disabled={disabled}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">One correct answer</SelectItem>
                      <SelectItem value="multi">Multiple correct answers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Answer choices</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => addOption(qi)}
                      disabled={disabled}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add choice
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Type each option on its own line. You need at least two choices.
                  </p>

                  <div className="space-y-2">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex gap-2 items-start">
                        <Input
                          className="flex-1"
                          placeholder={`Choice ${oi + 1}`}
                          value={opt}
                          onChange={(e) => setOption(qi, oi, e.target.value)}
                          disabled={disabled}
                        />
                        {q.options.length > 2 && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="shrink-0 h-10 w-10 text-muted-foreground"
                            disabled={disabled}
                            onClick={() => removeOption(qi, oi)}
                            aria-label={`Remove choice ${oi + 1}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {q.mode === "single" ? (
                  <div className="space-y-2 rounded-md bg-muted/40 p-3">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Correct answer
                    </Label>
                    <RadioGroup
                      value={String(Math.min(q.correctSingleIndex, Math.max(0, q.options.length - 1)))}
                      onValueChange={(v) => updateQuestion(qi, { correctSingleIndex: Number(v) })}
                      disabled={disabled}
                      className="gap-2"
                    >
                      {q.options.map((opt, oi) => (
                        <label
                          key={oi}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-md border border-transparent px-2 py-2 text-sm hover:bg-background/80",
                            q.correctSingleIndex === oi && "border-primary/40 bg-primary/5"
                          )}
                        >
                          <RadioGroupItem value={String(oi)} id={`${q.id}-opt-${oi}`} disabled={disabled} />
                          <span className="flex-1 truncate">{opt.trim() || `Choice ${oi + 1} (empty)`}</span>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>
                ) : (
                  <div className="space-y-2 rounded-md bg-muted/40 p-3">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Correct answers (select all that apply)
                    </Label>
                    <div className="space-y-2">
                      {q.options.map((opt, oi) => {
                        const checked = q.correctMultiIndices.includes(oi);
                        return (
                          <label
                            key={oi}
                            className={cn(
                              "flex cursor-pointer items-center gap-3 rounded-md border border-transparent px-2 py-2 text-sm hover:bg-background/80",
                              checked && "border-primary/40 bg-primary/5"
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              disabled={disabled}
                              onCheckedChange={(v) => {
                                const on = v === true;
                                let next = new Set(q.correctMultiIndices);
                                if (on) next.add(oi);
                                else next.delete(oi);
                                let arr = [...next].sort((a, b) => a - b);
                                if (arr.length === 0) arr = [Math.min(oi, q.options.length - 1)];
                                updateQuestion(qi, { correctMultiIndices: arr });
                              }}
                            />
                            <span className="flex-1 truncate">{opt.trim() || `Choice ${oi + 1} (empty)`}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
