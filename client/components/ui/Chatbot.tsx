import React, { useEffect, useRef, useState } from "react";
import { MessageSquare, X, Send } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import sampleLessons from "@/lib/sample-lessons";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  time: number;
};

const STORAGE_KEY = "llm_chat_history_v1";

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

async function fakeLLMResponse(prompt: string) {
  await new Promise((r) => setTimeout(r, 450));
  const p = prompt.toLowerCase().trim();
  if (!p) return "Hi — tell me what lesson or topic you'd like help with. Examples: \"lessons for grade 6\", \"is 'Coding the Constellations' suitable for grade 3?\" or \"lessons about data\".";

  const bandForNumber = (n: number) => {
    if (n <= 2) return "K-2";
    if (n <= 5) return "3-5";
    if (n <= 8) return "6-8";
    return "9-12";
  };

  // check for explicit grade number
  const gradeNumMatch = p.match(/grade\s*(k|kindergarten|\d{1,2})/);
  if (gradeNumMatch) {
    const g = gradeNumMatch[1];
    let band = "";
    if (/k|kindergarten/.test(g)) band = "K-2";
    else band = bandForNumber(Number(g));

    const matches = sampleLessons.filter((l: any) => l.gradeBands.includes(band));
    if (matches.length === 0) return `I couldn't find lessons for ${g} (band ${band}).`;
    const items = matches.map((m: any, i: number) => `${i + 1}. ${m.title} — Grades: ${m.gradeBands.join(", ")} • ${m.duration} • ${m.format}`);
    return `Lessons for grade ${g} (band ${band}):\n\n${items.join("\n")}`;
  }

  // check for topic-based queries
  const topicMatch = p.match(/lessons? (?:for|about|on)\s+(.+)$/) || p.match(/about\s+(.+)$/);
  if (topicMatch) {
    const topic = topicMatch[1].replace(/[?.]/g, "").trim();
    // look for tag matches or title matches
    const matches = sampleLessons.filter((l: any) => {
      const titleMatch = l.title.toLowerCase().includes(topic);
      const tagMatch = l.tags.some((t: string) => t.toLowerCase().includes(topic));
      return titleMatch || tagMatch;
    });
    if (matches.length === 0) return `No lessons found for "${topic}". Try a different keyword (e.g. data, circuits, ecosystems).`;
    const items = matches.map((m: any, i: number) => `${i + 1}. ${m.title} — Grades: ${m.gradeBands.join(", ")} • ${m.duration} • ${m.format}`);
    return `Lessons for "${topic}":\n\n${items.join("\n")}`;
  }

  // check for suitability question e.g., "is X suitable for grade 3"
  const suitableMatch = p.match(/is\s+['\"]?([^'\"]+)['\"]?\s+suitable\s+for\s+grade\s*(k|\d{1,2})/);
  if (suitableMatch) {
    const titleQuery = suitableMatch[1].toLowerCase().trim();
    const gradePart = suitableMatch[2];
    const band = /k/.test(gradePart) ? "K-2" : bandForNumber(Number(gradePart));
    const found = sampleLessons.find((l: any) => l.title.toLowerCase().includes(titleQuery));
    if (!found) return `I couldn't find a lesson titled \"${suitableMatch[1]}\".`;
    const ok = found.gradeBands.includes(band);
    return ok
      ? `Yes — "${found.title}" is suitable for grade ${gradePart} (bands: ${found.gradeBands.join(", ")}).`
      : `No — "${found.title}" is not typically targeted at grade ${gradePart}. It's designed for grades: ${found.gradeBands.join(", ")}.`;
  }

  // fallback: try to match tags or keywords across dataset
  const keywordMatches = sampleLessons.filter((l: any) => {
    return (
      l.title.toLowerCase().includes(p) ||
      l.summary.toLowerCase().includes(p) ||
      l.tags.some((t: string) => t.toLowerCase().includes(p))
    );
  });

  if (keywordMatches.length > 0) {
    const items = keywordMatches.map((m: any, i: number) => `${i + 1}. ${m.title} — Grades: ${m.gradeBands.join(", ")} • ${m.duration}`);
    return `I found some lessons related to "${prompt}":\n\n${items.join("\n")}`;
  }

  // final fallback: list featured lessons
  const top = sampleLessons.slice(0, 6).map((m: any, i: number) => `${i + 1}. ${m.title} — Grades: ${m.gradeBands.join(", ")} • ${m.duration}`);
  return `Here are some sample lessons you can ask about:\n\n${top.join("\n")}`;
}

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    const userMsg: Message = { id: String(Date.now()) + "u", role: "user", text, time: Date.now() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    try {
      // Prefer server-backed Gemini endpoint if available
      // try local server endpoint first
      let usedServer = false;
      try {
        let res = await fetch('/api/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: text, context: sampleLessons }),
        });

        if (!res.ok) {
          // try Netlify function path if server unavailable
          res = await fetch('/.netlify/functions/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: text, context: sampleLessons }),
          });
        } else {
          usedServer = true;
        }

        if (res.ok) {
          const json = await res.json();
          const out = (json && (json.output || json.result || json.text)) || '';
          const assistantMsg: Message = { id: String(Date.now()) + 'a', role: 'assistant', text: out || 'No response', time: Date.now() };
          setMessages((m) => [...m, assistantMsg]);
          setLoading(false);
          return;
        }
      } catch (e) {
        // ignore and fallback
      }

      // final fallback to local mock
      const fallback = await fakeLLMResponse(text);
      const assistantMsg: Message = { id: String(Date.now()) + 'a', role: 'assistant', text: fallback, time: Date.now() };
      setMessages((m) => [...m, assistantMsg]);
    } catch (e) {
      const fallback = await fakeLLMResponse(text);
      const errMsg: Message = { id: String(Date.now()) + 'a', role: 'assistant', text: fallback, time: Date.now() };
      setMessages((m) => [...m, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const panelClass =
    "fixed z-40 right-6 transition-all transform " +
    (open
      ? "top-12 bottom-6 w-56 md:w-[420px] max-h-[92vh] rounded-xl border bg-card shadow-xl flex flex-col overflow-hidden opacity-100 scale-100"
      : "bottom-20 w-14 h-14 rounded-xl border bg-card shadow-xl flex flex-col overflow-hidden opacity-0 scale-95 pointer-events-none");

  return (
    <div>
      {/* Floating button */}
      <button
        aria-hidden={open}
        aria-label={open ? "Close chat" : "Open chat"}
        onClick={() => setOpen((s) => !s)}
        className={
          "fixed z-50 right-6 bottom-6 p-3 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 " +
          (open ? "bg-primary text-white opacity-0 translate-y-6 pointer-events-none" : "bg-card text-primary opacity-100")
        }
        style={{ width: 56, height: 56 }}
      >
        {open ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
      </button>

      {/* Panel */}
      <div aria-hidden={!open} className={panelClass}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-gradient-to-br from-primary to-accent w-9 h-9 grid place-items-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-semibold">Learning Lab Assistant</div>
              <div className="text-xs text-muted-foreground">Ask for lesson ideas, classroom tips, or activity suggestions.</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={clear} className="text-xs px-2 py-1 rounded-md border hover:bg-muted-foreground/6">Clear</button>
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="p-1">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div ref={listRef} className="flex-1 overflow-auto px-3 py-2 space-y-3">
          {messages.length === 0 && (
            <div className="text-sm text-muted-foreground p-3">Say hi — ask for a lesson plan, a quick activity, or classroom tips.</div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  (m.role === "user" ? "bg-primary text-white" : "bg-secondary/8 text-foreground") +
                  " max-w-[86%] px-3 py-2 rounded-lg text-sm leading-snug whitespace-pre-wrap"
                }
              >
                      <div className="prose prose-sm max-w-none text-sm text-foreground">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                    a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-primary underline" />,
                    code: ({node, inline, className, children, ...props}) => (
                      <code className={(inline ? "rounded px-1 py-0.5" : "block rounded p-2 bg-slate-900 text-white text-xs overflow-auto") + (className ? ` ${className}` : "")} {...props}>{children}</code>
                    )
                  }}>{m.text}</ReactMarkdown>
                </div>
                <div className="text-[10px] opacity-60 mt-1 text-right">{formatTime(m.time)}</div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-secondary/8 max-w-[60%] px-3 py-2 rounded-lg text-sm leading-snug">Thinking...</div>
            </div>
          )}
        </div>

        <div className="border-t px-3 py-2 flex items-center gap-2">
          <input
            ref={inputRef}
            placeholder="Ask something, e.g. 'lesson for 3rd graders about data'"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            className="flex-1 px-3 py-2 rounded-md border bg-transparent text-sm outline-none"
            aria-label="Chat message"
          />
          <button onClick={send} disabled={loading || !input.trim()} className="p-2 rounded-md bg-primary text-white disabled:opacity-50">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
