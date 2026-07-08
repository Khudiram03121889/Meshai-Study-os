import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Download, RefreshCw, Sparkles, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { streamStudyMode } from "@/lib/studyModeApi";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

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

  const handleDownloadPDF = async () => {
    const printEl = document.getElementById("printable-cheat-sheet");
    if (!printEl) return;

    const subject = subjects.find(s => s.id === selectedSubjectId);
    const chapter = availableChapters.find(c => c.id === selectedChapterId);
    const chapterName = chapter?.name || "General";
    const subjectName = subject?.name || "General";

    setIsGenerating(true);
    const toastId = toast.loading("Generating structured PDF...");

    try {
      // Create off-screen container styled for high-resolution canvas capture
      const tempContainer = document.createElement("div");
      tempContainer.style.position = "absolute";
      tempContainer.style.left = "-9999px";
      tempContainer.style.top = "-9999px";
      tempContainer.style.width = "800px";
      tempContainer.style.padding = "40px";
      tempContainer.style.background = "#ffffff";
      
      const cleanHtml = printEl.innerHTML
        .replace(/\bprose-invert\b/g, "")
        .replace(/\btext-muted-foreground\b/g, "")
        .replace(/\btext-foreground\b/g, "")
        .replace(/\btext-primary\b/g, "")
        .replace(/\bbg-card\b/g, "")
        .replace(/\bbg-secondary\b/g, "");

      tempContainer.innerHTML = `
        <div style="margin-bottom: 24px; border-bottom: 2.5px solid #1e293b; padding-bottom: 12px; font-family: 'Space Grotesk', sans-serif;">
          <h1 style="font-size: 26px; font-weight: 800; margin: 0; color: #0f172a;">⚡ Cheat Sheet: ${chapterName}</h1>
          <p style="font-size: 14px; color: #475569; margin: 6px 0 0 0; font-weight: 600;">
            Subject: ${subjectName} &nbsp;•&nbsp; Compiled via MeshStudy AI
          </p>
        </div>
        <div class="prose prose-sm" style="font-family: 'Inter', sans-serif;">
          ${cleanHtml}
        </div>
      `;

      const style = document.createElement("style");
      style.innerHTML = `
        .prose * { color: #0f172a !important; font-family: 'Inter', sans-serif !important; }
        .prose h2 { color: #0f766e !important; text-transform: uppercase !important; border-bottom: 1.5px solid #cbd5e1 !important; padding-bottom: 4px; font-size: 15px !important; margin-top: 20px !important; }
        .prose p { font-size: 12px !important; line-height: 1.5 !important; }
        .prose ul { list-style-type: disc !important; padding-left: 18px !important; }
        .prose li { font-size: 11.5px !important; margin-bottom: 4px !important; }
        .katex-display { background-color: #f8fafc !important; border: 1px solid #cbd5e1 !important; color: #000000 !important; padding: 8px !important; margin: 8px 0 !important; border-radius: 6px !important; }
        .katex { color: #000000 !important; font-size: 1.05em !important; }
      `;
      tempContainer.appendChild(style);
      document.body.appendChild(tempContainer);

      const canvas = await html2canvas(tempContainer, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
      });

      document.body.removeChild(tempContainer);

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const filename = `${chapterName.replace(/[^a-zA-Z0-9]/g, "_")}_CheatSheet.pdf`;
      pdf.save(filename);
      toast.dismiss(toastId);
      toast.success("PDF downloaded successfully! 📄");
    } catch (err: any) {
      console.error(err);
      toast.dismiss(toastId);
      toast.error("Failed to generate PDF");
    } finally {
      setIsGenerating(false);
    }
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
              <div className="prose prose-invert max-w-none text-xs leading-relaxed space-y-4
                prose-headings:font-display prose-headings:font-bold prose-headings:text-foreground prose-headings:mt-4 prose-headings:mb-2
                prose-h1:text-xl prose-h1:border-b prose-h1:border-border prose-h1:pb-2
                prose-h2:text-sm prose-h2:text-primary prose-h2:uppercase prose-h2:tracking-wider
                prose-strong:text-foreground prose-strong:font-semibold
                prose-ul:list-disc prose-ul:pl-4 prose-li:my-1
                print:prose-neutral print:text-black print:prose-headings:text-black print:prose-strong:text-black">
                <ReactMarkdown
                  remarkPlugins={[remarkBreaks, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {content}
                </ReactMarkdown>
              </div>
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
              onClick={handleDownloadPDF}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-lg shadow-primary/20"
            >
              <Download className="w-3.5 h-3.5" /> Download PDF
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
