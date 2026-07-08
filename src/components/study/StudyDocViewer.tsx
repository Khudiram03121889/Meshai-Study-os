import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, ArrowLeft, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import StudyMarkdown from "./StudyMarkdown";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { preprocessMarkdown } from "@/lib/utils";

const TUTOR_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pdf-tutor`;

interface Msg { role: "user" | "assistant"; content: string; }

interface Props {
  doc: {
    id?: string;
    mode: "prelearn" | "learn";
    topic_name: string;
    chapter_name?: string | null;
    subject_name?: string | null;
    content: string;
  };
  onBack: () => void;
  onExportPDF?: () => void;
}

export default function StudyDocViewer({ doc, onBack, onExportPDF }: Props) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: `Hi! Ask me anything about **${doc.topic_name}**. I have the full generated document as context. 👋` },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); toast.error("Not authenticated"); return; }

    let acc = "";
    try {
      const resp = await fetch(TUTOR_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: updated,
          scope: "study_doc",
          docContent: doc.content,
          docMode: doc.mode,
          topicName: doc.topic_name,
          chapterName: doc.chapter_name,
          subjectName: doc.subject_name
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Error ${resp.status}`);
      }
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const p = JSON.parse(json);
            const c = p.choices?.[0]?.delta?.content;
            if (c) {
              acc += c;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && prev.length === updated.length + 1) {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: acc } : m));
                }
                return [...prev, { role: "assistant", content: acc }];
              });
            }
          } catch { /* skip */ }
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 h-[calc(100vh-10rem)] flex flex-col">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        {onExportPDF && (
          <button onClick={onExportPDF} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs hover:bg-primary/20 font-medium">
            <Download className="w-3.5 h-3.5" /> Export PDF
          </button>
        )}
      </div>

      <ResizablePanelGroup direction="horizontal" className="flex-1 rounded-xl border border-border overflow-hidden">
        {/* Document */}
        <ResizablePanel defaultSize={60} minSize={30}>
          <div className="h-full flex flex-col bg-card">
            <div className="p-4 border-b border-border">
              <h3 className="font-display font-semibold text-foreground">{doc.topic_name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {doc.chapter_name} • {doc.subject_name} • {doc.mode === "prelearn" ? "Pre-Learn" : "Learn"}
              </p>
            </div>
            <div id="learn-print-area" className="flex-1 overflow-y-auto p-6">
              <StudyMarkdown content={doc.content} />
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* AI Tutor */}
        <ResizablePanel defaultSize={40} minSize={25}>
          <div className="h-full flex flex-col bg-card">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="font-display font-bold text-foreground text-sm flex items-center gap-2">
                <Bot className="w-4 h-4 text-primary" /> AI Tutor for this document
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${m.role === "assistant" ? "bg-primary/10" : "bg-accent/10"}`}>
                    {m.role === "assistant" ? <Bot className="w-3.5 h-3.5 text-primary" /> : <User className="w-3.5 h-3.5 text-accent" />}
                  </div>
                  <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm break-words ${m.role === "assistant" ? "bg-secondary/40 border border-border text-foreground" : "bg-primary/10 border border-primary/20 text-foreground"}`}>
                    {m.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none break-words
                        [&_hr]:my-4 [&_hr]:border-white/20 [&_hr]:border-dashed
                        [&_p]:my-2 [&_strong]:text-blue-300
                        [&_.katex-display]:my-3 [&_.katex-display]:py-2 [&_.katex-display]:px-3 [&_.katex-display]:bg-white/5 [&_.katex-display]:rounded
                      ">
                        <ReactMarkdown remarkPlugins={[remarkMath, remarkBreaks]} rehypePlugins={[rehypeKatex]}>
                          {preprocessMarkdown(m.content)}
                        </ReactMarkdown>
                      </div>
                    ) : m.content}
                  </div>
                </div>
              ))}
              {loading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex items-center gap-2 text-muted-foreground text-xs"><Loader2 className="w-3 h-3 animate-spin" /> Thinking…</div>
              )}
              <div ref={bottomRef} />
            </div>
            <div className="p-3 border-t border-border flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Ask about this document…"
                className="flex-1 bg-secondary/40 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button onClick={send} disabled={!input.trim() || loading} className="gradient-primary text-primary-foreground px-3 py-2 rounded-lg disabled:opacity-50">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
