import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { preprocessMarkdown } from "@/lib/utils";

const TUTOR_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pdf-tutor`;

interface Msg { role: "user" | "assistant"; content: string; }

export default function TestPaperViewer({ paperId }: { paperId: string }) {
  const [paper, setPaper] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: "Hi! Ask me anything about this test paper. I can help you solve the questions step-by-step! 👋" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const loadPaper = useCallback(async () => {
    const { data: p } = await supabase
      .from("test_papers")
      .select("*")
      .eq("id", paperId)
      .single();
    setPaper(p);
    
    if (p?.storage_path) {
      const { data: signed } = await supabase.storage.from("notes-pdfs").createSignedUrl(p.storage_path, 60 * 60 * 4);
      if (signed?.signedUrl) setPdfUrl(signed.signedUrl);
    }

    const { data: qs } = await supabase
      .from("test_questions")
      .select("*")
      .eq("test_paper_id", paperId)
      .order("created_at", { ascending: true });
    
    if (qs) setQuestions(qs);
    
  }, [paperId]);

  useEffect(() => { loadPaper(); }, [loadPaper]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); toast.error("Not authenticated"); return; }

    let assistantSoFar = "";
    try {
      const _board = localStorage.getItem(`user_board_${session.user.id}`) || "CBSE";
      const _cls = localStorage.getItem(`user_class_${session.user.id}`) || "12";

      const resp = await fetch(TUTOR_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: updated,
          scope: "test_paper",
          paperId,
          board: _board,
          classLabel: _cls
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
              assistantSoFar += c;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && prev.length === updated.length + 1) {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
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
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 h-[calc(100vh-12rem)]">
      {/* PDF panel */}
      <div className="lg:col-span-3 bg-card border border-border rounded-xl overflow-hidden flex flex-col">
        <div className="p-3 border-b border-border">
          <div className="font-medium text-foreground truncate">{paper?.title || "Loading…"}</div>
          <div className="text-xs text-muted-foreground mt-0.5 flex gap-2">
            {paper?.subject_id && <span className="capitalize">{paper.subject_id}</span>}
            {paper?.exam_date && <span>· {new Date(paper.exam_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>}
            {questions.length > 0 && <span>· {questions.length} questions</span>}
          </div>
          {paper?.ai_analysis && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{paper.ai_analysis}</p>}
        </div>
        <div className="flex-1 bg-secondary/30">
          {pdfUrl ? (
            <iframe src={pdfUrl} className="w-full h-full" title={paper?.title} />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading PDF…</div>
          )}
        </div>
      </div>

      {/* Chat panel */}
      <div className="lg:col-span-2 bg-card border border-border rounded-xl flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-display font-bold text-foreground text-sm flex items-center gap-2"><Bot className="w-4 h-4 text-primary" /> AI Tutor for this paper</h3>
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
                    <ReactMarkdown remarkPlugins={[remarkMath, remarkBreaks]} rehypePlugins={[rehypeKatex]}>{preprocessMarkdown(m.content)}</ReactMarkdown>
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
            placeholder="Ask about these questions…"
            className="flex-1 bg-secondary/40 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button onClick={send} disabled={!input.trim() || loading} className="gradient-primary text-primary-foreground px-3 py-2 rounded-lg disabled:opacity-50">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
