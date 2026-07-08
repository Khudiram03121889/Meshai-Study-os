import { useState, useRef, useEffect, useCallback } from "react";
import { emitEvent } from "@/lib/events";
import { Send, Bot, User, Plus, History, ArrowLeft, Trash2, Paperclip, X, Image } from "lucide-react";
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
  image?: string;
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
      (supabase as any)
        .from("lecturers")
        .select("*")
        .eq("user_id", user.id)
        .then(({ data }: any) => {
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

async function streamChat({ messages, studyContext, language, imageUrl, onDelta, onModel, onDone }: {
  messages: Message[]; studyContext: any; language: string; imageUrl?: string; onDelta: (text: string) => void; onModel: (model: string) => void; onDone: () => void;
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
    body: JSON.stringify({ query: lastUserMsg, history, subjectId, language, imageUrl }),
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
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image too large (max 5MB)");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

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
    const { data } = await (supabase as any)
      .from("chat_conversations")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (data) setConversations(data as any[]);
  }, [user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const saveMessages = useCallback(async (convId: string, msgs: Message[]) => {
    if (!user) return;
    await (supabase as any).from("chat_messages").delete().eq("conversation_id", convId);
    const rows = msgs.map((m) => {
      let content = m.content;
      if (m.image) {
        content = `[Photo] ${content || "Solve or explain this image."}`;
      }
      return {
        conversation_id: convId,
        user_id: user.id,
        role: m.role,
        content,
        model_routed: m.model || null,
      };
    });
    await (supabase as any).from("chat_messages").insert(rows as any);
    const firstUser = msgs.find((m) => m.role === "user");
    if (firstUser) {
      let title = firstUser.content;
      if (firstUser.image && !title) {
        title = "Image doubt";
      }
      const slicedTitle = title.slice(0, 80) + (title.length > 80 ? "..." : "");
      await (supabase as any).from("chat_conversations").update({ title: slicedTitle, updated_at: new Date().toISOString() }).eq("id", convId);
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
    const { data } = await (supabase as any)
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true });
    if (data && data.length > 0) {
      setMessages(data.map((m: any) => {
        let content = m.content;
        let image: string | undefined = undefined;
        if (content.startsWith("[Photo] ")) {
          content = content.replace(/^\[Photo\]\s*/, "");
          image = "placeholder";
        }
        return { role: m.role, content, model: m.model_routed, image };
      }));
    } else {
      setMessages([WELCOME_MSG]);
    }
    setActiveConversationId(conv.id);
    setLoadingHistory(false);
  };

  const deleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await (supabase as any).from("chat_conversations").delete().eq("id", convId);
    setConversations((prev) => prev.filter((c) => c.id !== convId));
    if (activeConversationId === convId) startNewChat();
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || loading || !user) return;
    const userMsg: Message = { 
      role: "user", 
      content: input.trim(),
      image: selectedImage || undefined
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setSelectedImage(null);
    setLoading(true);
    emitEvent('ai.explanation_requested', { query: userMsg.content.slice(0, 200) });

    let convId = activeConversationId;
    if (!convId) {
      let title = userMsg.content;
      if (userMsg.image && !title) {
        title = "Image doubt";
      }
      const { data } = await (supabase as any)
        .from("chat_conversations")
        .insert({ user_id: user.id, title: title.slice(0, 80) })
        .select("id")
        .single();
      if (data) {
        convId = (data as any).id;
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
        imageUrl: userMsg.image,
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
                  {msg.role === "assistant" && msg.model && (() => {
                    const modelName = msg.model.toLowerCase();
                    let badgeClass = "text-primary/90 border-primary/20 bg-primary/5";
                    let dotClass = "bg-primary";
                    let provider = "Mesh";
                    
                    if (modelName.includes("claude") || modelName.includes("anthropic")) {
                      badgeClass = "text-orange-400 border-orange-500/20 bg-orange-500/5";
                      dotClass = "bg-orange-500";
                      provider = "Mesh: Anthropic";
                    } else if (modelName.includes("gpt") || modelName.includes("openai")) {
                      badgeClass = "text-emerald-400 border-emerald-500/20 bg-emerald-500/5";
                      dotClass = "bg-emerald-500";
                      provider = "Mesh: OpenAI";
                    } else if (modelName.includes("gemini") || modelName.includes("google")) {
                      badgeClass = "text-indigo-400 border-indigo-500/20 bg-indigo-500/5";
                      dotClass = "bg-indigo-500";
                      provider = "Mesh: Google";
                    }
                    
                    return (
                      <div className={`flex items-center gap-1.5 text-[10px] font-bold mb-2 border rounded-full px-2.5 py-0.5 w-fit select-none transition-all ${badgeClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${dotClass}`} />
                        <span>{provider} • {msg.model.replace("openai/", "").replace("anthropic/", "").replace("google/", "")}</span>
                      </div>
                    );
                  })()}
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
                  ) : (
                    <>
                      {msg.image && (
                        <div className="mb-2 max-w-sm rounded-lg overflow-hidden border border-border/50 bg-black/20">
                          {msg.image === "placeholder" ? (
                            <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                              <Image className="w-4 h-4" />
                              <span>Image Attachment</span>
                            </div>
                          ) : (
                            <img src={msg.image} alt="Attachment" className="max-h-48 object-contain w-full" />
                          )}
                        </div>
                      )}
                      {msg.content}
                    </>
                  )}
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
        <div className="max-w-3xl mx-auto flex flex-col gap-2">
          {/* Image preview area */}
          {selectedImage && (
            <div className="flex items-center gap-2 p-2 bg-card border border-border rounded-xl w-fit relative group">
              <img src={selectedImage} alt="Preview" className="h-16 w-16 object-cover rounded-lg" />
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground p-1 rounded-full hover:bg-destructive/90 transition-colors shadow-lg"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          
          <div className="flex gap-2 items-center">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageSelect}
              accept="image/*"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 p-3 rounded-xl border border-border bg-card hover:bg-accent/10 transition-colors text-muted-foreground hover:text-foreground"
              title="Attach photo/doubt"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask me anything, or attach a doubt photo..."
              className="flex-1 bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={handleSend}
              disabled={(!input.trim() && !selectedImage) || loading}
              className="gradient-primary text-primary-foreground px-4 py-3 rounded-xl disabled:opacity-50 transition-opacity shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
