import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Printer, RefreshCw, Sparkles, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { streamStudyMode } from "@/lib/studyModeApi";
import { toast } from "sonner";

interface Topic {
  id: string;
  name: string;
}

interface Chapter {
  id: string;
  name: string;
  class: number;
  topics: Topic[];
}

interface Subject {
  id: string;
  name: string;
  chapters: Chapter[];
}

interface CheatSheetModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  subjects: Subject[];
}

export default function CheatSheetModal({ isOpen, onOpenChange, subjects }: CheatSheetModalProps) {
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedChapterId, setSelectedChapterId] = useState("");
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [content, setContent] = useState("");

  // Get chapters of selected subject
  const availableChapters = useMemo(() => {
    const subj = subjects.find(s => s.id === selectedSubjectId);
    return subj ? subj.chapters : [];
  }, [selectedSubjectId, subjects]);

  const handleSubjectChange = (val: string) => {
    setSelectedSubjectId(val);
    setSelectedChapterId("");
    setContent("");
  };

  const handleGenerate = async () => {
    const subject = subjects.find(s => s.id === selectedSubjectId);
    const chapter = availableChapters.find(c => c.id === selectedChapterId);

    if (!subject || !chapter) {
      toast.error("Please select a subject and a chapter");
      return;
    }

    setIsGenerating(true);
    setContent("");

    try {
      // Use the chapter name as the topic for chapter-wide compilation
      await streamStudyMode({
        mode: "cheatsheet",
        topic: chapter.name,
        chapter: chapter.name,
        subject: subject.name,
        onDelta: (text) => {
          setContent(prev => prev + text);
        },
        onDone: () => {
          setIsGenerating(false);
          toast.success("Cheat Sheet generated successfully! ⚡");
        }
      });
    } catch (err: any) {
      console.error(err);
      setIsGenerating(false);
      toast.error(err.message || "Failed to generate cheat sheet");
    }
  };

  const handlePrint = () => {
    const printEl = document.getElementById("printable-cheat-sheet");
    if (!printEl) return;

    const subject = subjects.find(s => s.id === selectedSubjectId);
    const chapter = availableChapters.find(c => c.id === selectedChapterId);
    const chapterName = chapter?.name || "General";
    const subjectName = subject?.name || "General";

    const container = document.createElement("div");
    container.id = "print-container";
    container.className = "prose prose-sm max-w-none text-black p-8 bg-white md:p-12";
    container.innerHTML = `
      <div style="margin-bottom: 24px; border-bottom: 2px solid #333; padding-bottom: 12px; font-family: 'Space Grotesk', sans-serif;">
        <h1 style="font-size: 26px; font-weight: bold; margin: 0; color: black;">⚡ Cheat Sheet: ${chapterName}</h1>
        <p style="font-size: 14px; color: #555; margin: 6px 0 0 0; font-weight: 500;">
          Subject: ${subjectName} &nbsp;•&nbsp; Compiled via MeshStudy AI
        </p>
      </div>
      <div style="font-family: 'Inter', sans-serif; color: black;">
        ${printEl.innerHTML.replace(/\bprose-invert\b/g, "")}
      </div>`;
    
    document.body.appendChild(container);
    const originalTitle = document.title;
    document.title = `${chapterName.replace(/[^a-zA-Z0-9]/g, "_")}_CheatSheet`;
    
    document.body.classList.add("printing-learn-content");
    window.print();
    document.title = originalTitle;
    document.body.classList.remove("printing-learn-content");
    document.body.removeChild(container);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden bg-card/95 border border-border shadow-2xl backdrop-blur-xl">
        <DialogHeader className="print:hidden">
          <DialogTitle className="text-xl font-display font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" /> 1-Click Cheat Sheet Generator
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Select a subject and chapter to generate a high-yield, KaTeX-formatted, print-ready cheat sheet.
          </DialogDescription>
        </DialogHeader>

        {/* Selection bar */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 print:hidden">
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Subject</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => handleSubjectChange(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer h-10"
              disabled={isGenerating}
            >
              <option value="" disabled>Select Subject</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Chapter</label>
            <select
              value={selectedChapterId}
              onChange={(e) => setSelectedChapterId(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer h-10 disabled:opacity-50"
              disabled={!selectedSubjectId || isGenerating}
            >
              <option value="" disabled>Select Chapter</option>
              {availableChapters.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleGenerate}
              disabled={!selectedChapterId || isGenerating}
              className="w-full sm:w-auto h-10 gradient-primary text-primary-foreground font-display font-semibold px-5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-1.5 text-sm"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Compile Sheet
                </>
              )}
            </button>
          </div>
        </div>

        {/* Content Preview Container */}
        {content && (
          <div className="flex-1 overflow-y-auto mt-4 border border-border/80 bg-secondary/10 rounded-2xl p-6 relative group min-h-[250px] max-h-[55vh]">
            {/* Mesh API Branding Badge */}
            <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-full px-2.5 py-1 text-[10px] font-medium text-primary print:hidden">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Routed via Mesh API
            </div>

            {/* Print Container Wrapper */}
            <div id="printable-cheat-sheet" className="font-sans">
              <ReactMarkdown
                remarkPlugins={[remarkBreaks, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                className="prose prose-invert max-w-none text-xs leading-relaxed space-y-4
                  prose-headings:font-display prose-headings:font-bold prose-headings:text-foreground prose-headings:mt-4 prose-headings:mb-2
                  prose-h1:text-xl prose-h1:border-b prose-h1:border-border prose-h1:pb-2
                  prose-h2:text-sm prose-h2:text-primary prose-h2:uppercase prose-h2:tracking-wider
                  prose-strong:text-foreground prose-strong:font-semibold
                  prose-ul:list-disc prose-ul:pl-4 prose-li:my-1
                  print:prose-neutral print:text-black print:prose-headings:text-black print:prose-strong:text-black"
              >
                {content}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Loading placeholder when starting */}
        {isGenerating && !content && (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[250px] border border-border/50 bg-secondary/5 rounded-2xl mt-4 print:hidden">
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
            <p className="text-sm font-medium text-foreground">Querying notes and formulas...</p>
            <p className="text-xs text-muted-foreground mt-1">Mesh AI is compiling your revision sheet.</p>
          </div>
        )}

        {/* Action bar */}
        {content && !isGenerating && (
          <div className="flex gap-3 justify-end pt-3 border-t border-border mt-3 print:hidden">
            <button
              onClick={handleGenerate}
              className="px-4 py-2 rounded-xl bg-secondary border border-border text-foreground hover:bg-accent/10 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Re-generate
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-lg shadow-primary/20"
            >
              <Printer className="w-3.5 h-3.5" /> Print Cheat Sheet
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
