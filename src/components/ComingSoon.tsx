import { Sparkles } from "lucide-react";

export default function ComingSoon({ title, phase, description }: { title: string; phase: string; description: string }) {
  return (
    <div className="max-w-2xl mx-auto py-12">
      <div className="bg-card border border-border rounded-2xl p-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
          <Sparkles className="w-7 h-7 text-primary" />
        </div>
        <div className="text-xs uppercase tracking-wider text-primary font-semibold mb-2">{phase}</div>
        <h1 className="text-2xl font-display font-bold text-foreground mb-3">{title}</h1>
        <p className="text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
