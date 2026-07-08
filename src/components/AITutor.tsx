import { useState, useRef, useEffect, useCallback } from "react";
import { emitEvent } from "@/lib/events";
import { Send, Bot, User, Plus, History, ArrowLeft, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { toast } from "sonner";
import { useStudyStore } from "@/data/store";
import { useSubjects } from "@/data/syllabus";
import { supabase, getFunctionUrl } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getMeshKey, getTutorContext, streamMeshChat } from "@/lib/mesh-stream";
import { preprocessMarkdown } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
  model?: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

const CHAT_URL = getFunctionUrl("ai-chat-v2");
const WELCOME_MSG: Message = {
  role: "assistant",
  content: "Hi Student! 👋 I'm your AI tutor. Ask me anything about Physics, Chemistry, or Mathematics. I can explain concepts, solve problems, and help you prepare for **Boards** and **KCET**!",
};

function useStudyContext() {
  const { user } = useAuth();
  const subjects = useSubjects();
  const { tracks, logs } = useStudyStore();
  const [dbLecturers, setDbLecturers] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      supabase
        .from("lecturers")
        .select("*")
        .eq("user_id", user.id)
        .then(({ data }) => {
          if (data) setDbLecturers(data);
        });
    }
  }, [user]);

  const startedChapters: any[] = [];
  const completedChapters: any[] = [];

  tracks.forEach((track) => {
    const subject = subjects.find((s) => s.chapters.some((c) => c.id === track.chapterId));
    const chapter = subject?.chapters.find((c) => c.id === track.chapterId);
    const lecturer = dbLecturers.find((l) => l.id === track.lecturerId);
    if (!chapter || !subject) return;
    const progress = Math.round((track.coveredTopicIds.length / chapter.topics.length) * 100);
    const entry = { name: chapter.name, subject: subject.name, subject_id: subject.id, lecturer: lecturer?.name || track.lecturerId, progress };
    if (progress >= 100) completedChapters.push(entry);
    else startedChapters.push(entry);
  });

  const recentLogs = logs.slice(-5).map((l) => {
    const subject = subjects.find((s) => s.id === l.subjectId);
    const chapter = subject?.chapters.find((c) => c.id === l.chapterId);
    return { date: l.date, chapter: chapter?.name || l.chapterId, topics: l.topicIds.length, understanding: l.understanding };
  });

  return { startedChapters, completedChapters, recentLogs };
}

async function streamChat({ messages, studyContext, language, onDelta, onModel, onDone }: {
  messages: Message[]; studyContext: any; language: string; onDelta: (text: string) => void; onModel: (model: string) => void; onDone: () => void;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  const history = messages.slice(0, -1);
  const subjectId = studyContext?.startedChapters?.[0]?.subject_id;

  const token = session?.access_token;

  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
    body: JSON.stringify({ query: lastUserMsg, history, subjectId, language }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `Error ${resp.status}`);
  }
  if (!resp.body) throw new Error("No response body");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") { streamDone = true; break; }
      try {
        const parsed = JSON.parse(jsonStr);
        const model = parsed.choices?.[0]?.delta?.model as string | undefined;
        if (model) onModel(model);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }

  if (buffer.trim()) {
    for (let raw of buffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const model = parsed.choices?.[0]?.delta?.model as string | undefined;
        if (model) onModel(model);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }
  onDone();
}

export default function AITutor() {
  const { user } = useAuth();
  const subjects = useSubjects();
  const studyContext = useStudyContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [language, setLanguage] = useState("english");
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const getWelcomeMessage = () => {
    const list = subjects.map(s => s.name);
    let subjectsStr = "Physics, Chemistry, or Mathematics";
    if (list.length > 0) {
      if (list.length === 1) subjectsStr = list[0];
      else if (list.length === 2) subjectsStr = list.join(" or ");
      else subjectsStr = list.slice(0, -1).join(", ") + ", or " + list[list.length - 1];
    }
    const board = user ? localStorage.getItem(`user_board_${user.id}`) : null;
    const exam = user ? localStorage.getItem(`user_exam_${user.id}`) : null;
    const boardStr = board ? `**${board}**` : "your Board exams";
    const compStr = exam ? `**${exam.toUpperCase()}**` : "competitive exams";
    return `Hi Student! 👋 I'm your AI tutor. Ask me anything about ${subjectsStr}. I can explain concepts, solve problems, and help you prepare for ${boardStr} and ${compStr}!`;
  };

  useEffect(() => {
    if (!activeConversationId && messages.length === 0 && subjects.length > 0) {
      setMessages([{ role: "assistant", content: getWelcomeMessage() }]);
    }
  }, [subjects, activeConversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("chat_conversations")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (data) setConversations(data);
  }, [user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const saveMessages = useCallback(async (convId: string, msgs: Message[]) => {
    if (!user) return;
    await supabase.from("chat_messages").delete().eq("conversation_id", convId);
    const rows = msgs.map((m) => ({
      conversation_id: convId,
      user_id: user.id,
      role: m.role,
      content: m.content,
      model_routed: m.model || null,
    }));
    await supabase.from("chat_messages").insert(rows as any);
    const firstUser = msgs.find((m) => m.role === "user");
    if (firstUser) {
      const title = firstUser.content.slice(0, 80) + (firstUser.content.length > 80 ? "..." : "");
      await supabase.from("chat_conversations").update({ title, updated_at: new Date().toISOString() }).eq("id", convId);
    }
  }, [user]);

  const startNewChat = () => {
    setActiveConversationId(null);
    setMessages([WELCOME_MSG]);
    setShowHistory(false);
  };

  const loadConversation = async (conv: Conversation) => {
    setLoadingHistory(true);
    setShowHistory(false);
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true });
    if (data && data.length > 0) {
      setMessages(data.map((m: any) => ({ role: m.role, content: m.content, model: m.model_routed })));
    } else {
      setMessages([WELCOME_MSG]);
    }
    setActiveConversationId(conv.id);
    setLoadingHistory(false);
  };

  const deleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("chat_conversations").delete().eq("id", convId);
    setConversations((prev) => prev.filter((c) => c.id !== convId));
    if (activeConversationId === convId) startNewChat();
  };

  const handleSend = async () => {
    if (!input.trim() || loading || !user) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);
    emitEvent('ai.explanation_requested', { query: userMsg.content.slice(0, 200) });

    let convId = activeConversationId;
    if (!convId) {
      const { data } = await supabase
        .from("chat_conversations")
        .insert({ user_id: user.id, title: userMsg.content.slice(0, 80) })
        .select("id")
        .single();
      if (data) {
        convId = data.id;
        setActiveConversationId(convId);
      }
    }

    let assistantSoFar = "";
    let routedModel = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && prev.length === updatedMessages.length + 1) {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar, model: routedModel } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar, model: routedModel }];
      });
    };

    const handleModel = (model: string) => {
      routedModel = model;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && prev.length === updatedMessages.length + 1) {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, model } : m));
        }
        return prev;
      });
    };

    try {
      await streamChat({
        messages: updatedMessages,
        studyContext,
        language,
        onDelta: (chunk) => upsertAssistant(chunk),
        onModel: (model) => handleModel(model),
        onDone: async () => {
          setLoading(false);
          if (convId) {
            const finalMessages = [...updatedMessages, { role: "assistant" as const, content: assistantSoFar, model: routedModel }];
            await saveMessages(convId, finalMessages);
            fetchConversations();
            
            // Fire Reflection Worker asynchronously
            const subjectId = studyContext?.startedChapters?.[0]?.subject_id;
            supabase.functions.invoke("ai-reflection-worker", { 
              body: { history: finalMessages, subjectId } 
            }).catch(e => console.error("Reflection failed:", e));
          }
        },
      });
    } catch (e: any) {
      console.error(e);
      setLoading(false);
      toast.error(e.message || "Failed to get AI response");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="shrink-0 px-4 md:px-6 py-3 border-b border-border bg-card/50 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-display font-bold text-foreground">AI Tutor</h1>
          <p className="text-muted-foreground text-xs">Your personal study assistant</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-secondary/50 border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-medium"
          >
            <option value="english">🇬🇧 English</option>
            <option value="hinglish">🇮🇳 Hinglish</option>
            <option value="hindi">🇮🇳 Hindi</option>
          </select>
          <button
            onClick={startNewChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm hover:bg-primary/20 transition-colors"
          >
            <Plus className="w-4 h-4" /> New
          </button>
          <button
            onClick={() => { setShowHistory(!showHistory); if (!showHistory) fetchConversations(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${showHistory ? "bg-primary text-primary-foreground" : "bg-card border border-border text-foreground hover:bg-accent/10"}`}
          >
            <History className="w-4 h-4" /> History
          </button>
        </div>
      </div>

      {/* History Panel (overlay) */}
      {showHistory && (
        <div className="shrink-0 mx-4 md:mx-6 mt-3 bg-card border border-border rounded-xl p-3 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">Chat History</h3>
            <button onClick={() => setShowHistory(false)} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
          {conversations.length === 0 ? (
            <p className="text-muted-foreground text-xs text-center py-4">No previous chats yet</p>
          ) : (
            <div className="space-y-1">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => loadConversation(conv)}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                    activeConversationId === conv.id ? "bg-primary/15 text-primary" : "hover:bg-accent/10 text-foreground"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{conv.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(conv.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => deleteConversation(conv.id, e)}
                    className="text-muted-foreground hover:text-destructive shrink-0 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages area — scrolls vertically */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 md:px-6 py-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {loadingHistory ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Loading conversation...</div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${msg.role === "assistant" ? "bg-primary/10" : "bg-accent/10"}`}>
                  {msg.role === "assistant" ? <Bot className="w-4 h-4 text-primary" /> : <User className="w-4 h-4 text-accent" />}
                </div>
                <div className={`max-w-[80%] px-4 py-3 rounded-xl text-sm break-words ${
                  msg.role === "assistant" ? "bg-card border border-border text-foreground" : "bg-primary/10 text-foreground border border-primary/20"
                }`}>
                  {msg.role === "assistant" && msg.model && (
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-primary/90 mb-2 border border-primary/20 bg-primary/5 rounded-full px-2.5 py-0.5 w-fit select-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      <span>Mesh: {msg.model.replace("openai/", "").replace("anthropic/", "").replace("google/", "")}</span>
                    </div>
                  )}
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none break-words overflow-hidden
                      [&_hr]:my-6 [&_hr]:border-white/20 [&_hr]:border-t-2 [&_hr]:border-dashed
                      [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-4
                      [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2
                      [&_p]:my-3 [&_p]:leading-relaxed
                      [&_strong]:text-blue-300
                      [&_.katex-display]:my-4 [&_.katex-display]:py-3 [&_.katex-display]:px-4 [&_.katex-display]:bg-white/5 [&_.katex-display]:rounded-lg [&_.katex-display]:border [&_.katex-display]:border-white/10
                      [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-blue-200 [&_h2]:border-b [&_h2]:border-white/10 [&_h2]:pb-2
                      [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-blue-200
                      [&_blockquote]:border-l-4 [&_blockquote]:border-blue-400 [&_blockquote]:pl-4 [&_blockquote]:py-2 [&_blockquote]:bg-white/5 [&_blockquote]:rounded-r-lg
                    ">
                      <ReactMarkdown remarkPlugins={[remarkMath, remarkBreaks]} rehypePlugins={[rehypeKatex]}>{preprocessMarkdown(msg.content)}</ReactMarkdown>
                    </div>
                  ) : msg.content}
                </div>
              </div>
            ))
          )}
          {loading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-card border border-border rounded-xl px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar — pinned at bottom */}
      <div className="shrink-0 px-4 md:px-6 py-3 border-t border-border bg-card/50">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask me anything about your subjects..."
            className="flex-1 bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="gradient-primary text-primary-foreground px-4 py-3 rounded-xl disabled:opacity-50 transition-opacity"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
