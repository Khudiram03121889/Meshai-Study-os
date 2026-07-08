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

interface Msg { role: "user" | "assistant"; content: string; }

const TUTOR_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pdf-tutor`;

export default function NoteViewer({ noteId }: { noteId: string }) {
  const [note, setNote] = useState<any>(null);
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: "Hi! Ask me anything about this lecture — I also remember your earlier classes and weak areas. 👋" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const loadNote = useCallback(async () => {
    const { data } = await supabase
      .from("notes")
      .select("*, class_sessions(session_date, subject_id, title, summary, continuity_context, lecturers(name))")
      .eq("id", noteId)
      .single();
    setNote(data);
    if (data?.storage_path) {
      const { data: signed } = await supabase.storage.from("notes-pdfs").createSignedUrl(data.storage_path, 60 * 60 * 4);
      if (signed?.signedUrl) setPdfUrl(signed.signedUrl);
    }
    // load chat history
    const { data: hist } = await supabase.from("ai_chat_history").select("role, message").eq("note_id", noteId).order("created_at", { ascending: true });
    if (hist?.length) {
      setMessages([{ role: "assistant", content: "Welcome back to this note. 👋" }, ...hist.map((h: any) => ({ role: h.role, content: h.message }))]);
    }
  }, [noteId]);

  useEffect(() => { loadNote(); }, [loadNote]);

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
      const resp = await fetch(TUTOR_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ messages: updated, noteId, scope: "note" }),
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
      // persist
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("ai_chat_history").insert([
          { user_id: user.id, scope: "note", note_id: noteId, role: "user", message: userMsg.content },
          { user_id: user.id, scope: "note", note_id: noteId, role: "assistant", message: assistantSoFar },
        ]);
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
          <div className="font-medium text-foreground truncate">{note?.file_name || "Loading…"}</div>
          {note?.class_sessions && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {note.class_sessions.session_date} · {note.class_sessions.subject_id} · {note.class_sessions.lecturers?.name}
            </div>
          )}
          {note?.ai_summary && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{note.ai_summary}</p>}
        </div>
        <div className="flex-1 bg-secondary/30">
          {pdfUrl ? (
            <iframe src={pdfUrl} className="w-full h-full" title={note?.file_name} />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading PDF…</div>
          )}
        </div>
      </div>

      {/* Chat panel */}
      <div className="lg:col-span-2 bg-card border border-border rounded-xl flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-display font-bold text-foreground text-sm flex items-center gap-2"><Bot className="w-4 h-4 text-primary" /> AI Tutor for this note</h3>
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
            placeholder="Ask about this lecture…"
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
