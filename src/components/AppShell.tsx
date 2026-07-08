import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, BarChart3, Brain, MessageSquare, CalendarDays, GraduationCap, Menu, X, LogOut, ChevronLeft, ChevronRight, FileText, Clock, ClipboardList, RefreshCw, AlertTriangle, Settings as SettingsIcon, Database } from "lucide-react";
import logoImg from "@/assets/logo.png";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: GraduationCap },
  { id: "syllabus", label: "Syllabus", icon: BookOpen },
  { id: "daily-notes", label: "Daily Notes", icon: FileText },
  { id: "class-timeline", label: "Class Timeline", icon: Clock },
  { id: "tests-exams", label: "Tests & Exams", icon: ClipboardList },
  { id: "chat", label: "AI Tutor", icon: MessageSquare },
  { id: "revision-hub", label: "Revision Hub", icon: RefreshCw },
  { id: "weak-areas", label: "Weak Areas", icon: AlertTriangle },
  { id: "performance", label: "Performance", icon: BarChart3 },
  { id: "modes", label: "Study Modes", icon: Brain },
  { id: "log", label: "Class Log", icon: CalendarDays },
  { id: "memory", label: "Memory Core", icon: Database },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

interface AppShellProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  children: React.ReactNode;
}

export default function AppShell({ currentPage, onNavigate, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { signOut } = useAuth();

  const isChat = currentPage === "chat";

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r border-border bg-card p-4 gap-2 transition-all duration-300 shrink-0 overflow-y-auto h-screen ${
          sidebarCollapsed ? "w-16" : "w-64"
        }`}
      >
        <div className="flex items-center gap-3 px-3 py-4 mb-4">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center font-display font-bold text-primary-foreground text-lg shrink-0 hover:opacity-90 transition-opacity"
          >
            {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <span className="font-display font-bold text-lg">M</span>}
          </button>
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0 flex items-center justify-between">
              <div>
                <h1 className="font-display font-bold text-foreground text-lg leading-tight">MeshStudy AI</h1>
                <p className="text-xs text-muted-foreground">AI-Powered Academic Coach</p>
              </div>
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                title="Collapse sidebar"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all shrink-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        {navItems.map((item) => {
          const active = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={sidebarCollapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "bg-primary/10 text-primary glow-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              } ${sidebarCollapsed ? "justify-center" : ""}`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!sidebarCollapsed && item.label}
            </button>
          );
        })}
        <div className="mt-auto pt-4 border-t border-border">
          <button
            onClick={signOut}
            title={sidebarCollapsed ? "Sign Out" : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all w-full ${sidebarCollapsed ? "justify-center" : ""}`}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!sidebarCollapsed && "Sign Out"}
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md gradient-primary flex items-center justify-center font-display font-bold text-primary-foreground text-sm shrink-0">M</div>
          <span className="font-display font-bold text-foreground">MeshStudy AI</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-foreground">
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, x: -200 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -200 }}
            className="md:hidden fixed inset-0 z-40 bg-background/95 backdrop-blur pt-16 p-4 overflow-y-auto"
          >
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => { onNavigate(item.id); setMobileOpen(false); }}
                className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg text-base font-medium mb-1 ${
                  currentPage === item.id ? "bg-primary/10 text-primary" : "text-muted-foreground"
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className={`flex-1 overflow-hidden flex flex-col ${isChat ? "pt-14 md:pt-0" : "pt-20 md:pt-0"}`}>
        <div className={`flex-1 overflow-auto ${isChat ? "" : "md:p-8 p-4"}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className={isChat ? "h-full" : ""}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
