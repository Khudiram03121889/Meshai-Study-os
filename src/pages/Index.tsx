import { useState } from "react";
import AppShell from "@/components/AppShell";
import Dashboard from "@/components/Dashboard";
import SyllabusBrowser from "@/components/SyllabusBrowser";
import ClassLogger from "@/components/ClassLogger";
import StudyModes from "@/components/StudyModes";
import Performance from "@/components/Performance";
import AITutor from "@/components/AITutor";
import DailyNotes from "@/components/DailyNotes";
import ClassTimeline from "@/components/ClassTimeline";
import TestsExams from "@/components/TestsExams";
import WeakAreas from "@/components/WeakAreas";
import RevisionHub from "@/components/RevisionHub";
import Settings from "@/components/Settings";
import { MemoryDashboard } from "@/components/MemoryDashboard";

const pages: Record<string, React.ComponentType<any>> = {
  dashboard: Dashboard,
  syllabus: SyllabusBrowser,
  "daily-notes": DailyNotes,
  "class-timeline": ClassTimeline,
  "tests-exams": TestsExams,
  chat: AITutor,
  "revision-hub": RevisionHub,
  "weak-areas": WeakAreas,
  performance: Performance,
  modes: StudyModes,
  log: ClassLogger,
  settings: Settings,
  memory: MemoryDashboard,
};

export default function Index() {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const PageComponent = pages[currentPage] || Dashboard;

  return (
    <AppShell currentPage={currentPage} onNavigate={setCurrentPage}>
      <PageComponent onNavigate={setCurrentPage} />
    </AppShell>
  );
}
