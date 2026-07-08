import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { emitEvent } from '@/lib/events';
import { subjects } from './syllabus';

export interface StudyLog {
  id: string;
  date: string;
  subjectId: string;
  lecturerId: string;
  chapterId: string;
  topicIds: string[];
  understanding: number;
  notes?: string;
}

export interface TrackProgress {
  lecturerId: string;
  chapterId: string;
  coveredTopicIds: string[];
  lastUpdated: string;
}

export interface QuestionAttempt {
  id: string;
  date: string;
  mode: 'practice' | 'test';
  subjectId: string;
  chapterId: string;
  topicId: string;
  question: string;
  options: string[];
  correctAnswer: string;
  studentAnswer: string;
  isCorrect: boolean;
  mistakeType?: 'conceptual' | 'calculation' | 'sign_error' | 'formula_misuse' | 'careless';
  explanation?: string;
  formulaUsed?: string;
  timeSpent?: number;
  examType?: string;
}

export interface TestResult {
  id: string;
  date: string;
  subjectId: string;
  chapterId: string;
  examType: string;
  totalQuestions: number;
  correctAnswers: number;
  score: number;
  timeTaken: number;
  timeAllowed: number;
  attempts: QuestionAttempt[];
}

interface StudyStore {
  logs: StudyLog[];
  tracks: TrackProgress[];
  attempts: QuestionAttempt[];
  testResults: TestResult[];
  loaded: boolean;
  userId: string | null;
  setUserId: (id: string | null) => void;
  loadFromDb: () => Promise<void>;
  addLog: (log: StudyLog) => void;
  updateTrack: (lecturerId: string, chapterId: string, topicIds: string[]) => void;
  addAttempts: (attempts: QuestionAttempt[]) => void;
  addTestResult: (result: TestResult) => void;
  getWrongAttempts: (subjectId?: string, chapterId?: string) => QuestionAttempt[];
  getTopicPerformance: (topicId: string) => { total: number; correct: number; rate: number };
}

export const useStudyStore = create<StudyStore>()((set, get) => ({
  logs: [],
  tracks: [],
  attempts: [],
  testResults: [],
  loaded: false,
  userId: null,

  setUserId: (id) => set({ userId: id }),

  loadFromDb: async () => {
    const { userId } = get();
    if (!userId) return;

    const [logsRes, tracksRes, attemptsRes, testsRes, prefsRes, subjsRes] = await Promise.all([
      supabase.from('study_logs').select('*').eq('user_id', userId),
      supabase.from('track_progress').select('*').eq('user_id', userId),
      supabase.from('question_attempts').select('*').eq('user_id', userId),
      supabase.from('test_results').select('*').eq('user_id', userId),
      supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('subjects').select('*').eq('user_id', userId),
    ]);

    if (prefsRes?.data) {
      localStorage.setItem(`user_exam_${userId}`, prefsRes.data.exam_priority || "boards");
      localStorage.setItem(`user_board_${userId}`, (prefsRes.data as any).board || "CBSE");
    }
    if (subjsRes?.data) {
      const slugs = subjsRes.data.map((s: any) => s.slug);
      localStorage.setItem(`user_subjects_${userId}`, JSON.stringify(slugs));
    }

    const logs: StudyLog[] = (logsRes.data ?? []).map((r: any) => ({
      id: r.id,
      date: r.date,
      subjectId: r.subject_id,
      lecturerId: r.lecturer_id,
      chapterId: r.chapter_id,
      topicIds: r.topic_ids as string[],
      understanding: r.understanding,
      notes: r.notes,
    }));

    const tracks: TrackProgress[] = (tracksRes.data ?? []).map((r: any) => ({
      lecturerId: r.lecturer_id,
      chapterId: r.chapter_id,
      coveredTopicIds: r.covered_topic_ids as string[],
      lastUpdated: r.last_updated,
    }));

    const attempts: QuestionAttempt[] = (attemptsRes.data ?? []).map((r: any) => ({
      id: r.id,
      date: r.date,
      mode: r.mode as 'practice' | 'test',
      subjectId: r.subject_id,
      chapterId: r.chapter_id,
      topicId: r.topic_id,
      question: r.question,
      options: r.options as string[],
      correctAnswer: r.correct_answer,
      studentAnswer: r.student_answer,
      isCorrect: r.is_correct,
      mistakeType: r.mistake_type as any,
      explanation: r.explanation,
      formulaUsed: r.formula_used,
      timeSpent: r.time_spent,
      examType: r.exam_type,
    }));

    const testResults: TestResult[] = (testsRes.data ?? []).map((r: any) => ({
      id: r.id,
      date: r.date,
      subjectId: r.subject_id,
      chapterId: r.chapter_id,
      examType: r.exam_type,
      totalQuestions: r.total_questions,
      correctAnswers: r.correct_answers,
      score: Number(r.score),
      timeTaken: r.time_taken,
      timeAllowed: r.time_allowed,
      attempts: attempts.filter((a) => (r.attempt_ids as string[]).includes(a.id)),
    }));

    set({ logs, tracks, attempts, testResults, loaded: true });
  },

  addLog: async (log) => {
    const { userId } = get();
    set((s) => ({ logs: [...s.logs, log] }));

    if (userId) {
      await supabase.from('study_logs').insert({
        id: log.id,
        user_id: userId,
        date: log.date,
        subject_id: log.subjectId,
        lecturer_id: log.lecturerId,
        chapter_id: log.chapterId,
        topic_ids: log.topicIds,
        understanding: log.understanding,
        notes: log.notes,
      });

      // Seed memories for the logged topics to solve the cold-start problem
      const findTopicName = (tId: string): string => {
        for (const sub of subjects) {
          for (const chap of sub.chapters) {
            const topic = chap.topics.find((t) => t.id === tId);
            if (topic) return topic.name;
          }
        }
        return tId;
      };

      const confidence = log.understanding / 5;
      const memoryRows = log.topicIds.map((tId) => {
        const topicName = findTopicName(tId);
        return {
          user_id: userId,
          memory_type: log.understanding <= 3 ? "weak_area" : "revision",
          content: `Revision needed for: ${topicName}. Confidence: ${Math.round(confidence * 100)}%`,
          subject_slug: log.subjectId,
          confidence_score: confidence,
          source: "user_upload",
          metadata: { 
            topic: topicName, 
            chapterId: log.chapterId, 
            topicId: tId, 
            last_revised: new Date().toISOString(), 
            revision_count: 0 
          },
        };
      });

      await supabase.from('memories').insert(memoryRows);

      emitEvent('lecture.completed', {
        subject_id: log.subjectId,
        chapter_id: log.chapterId,
        topic_count: log.topicIds.length,
        understanding: log.understanding,
      });
    }

    get().updateTrack(log.lecturerId, log.chapterId, log.topicIds);
  },

  updateTrack: async (lecturerId, chapterId, topicIds) => {
    const { userId } = get();
    set((s) => {
      const existing = s.tracks.find(
        (t) => t.lecturerId === lecturerId && t.chapterId === chapterId
      );
      if (existing) {
        const newCovered = [...new Set([...existing.coveredTopicIds, ...topicIds])];
        return {
          tracks: s.tracks.map((t) =>
            t.lecturerId === lecturerId && t.chapterId === chapterId
              ? { ...t, coveredTopicIds: newCovered, lastUpdated: new Date().toISOString() }
              : t
          ),
        };
      }
      return {
        tracks: [
          ...s.tracks,
          { lecturerId, chapterId, coveredTopicIds: topicIds, lastUpdated: new Date().toISOString() },
        ],
      };
    });

    if (userId) {
      const track = get().tracks.find(
        (t) => t.lecturerId === lecturerId && t.chapterId === chapterId
      );
      if (track) {
        await supabase.from('track_progress').upsert(
          {
            user_id: userId,
            lecturer_id: lecturerId,
            chapter_id: chapterId,
            covered_topic_ids: track.coveredTopicIds,
            last_updated: track.lastUpdated,
          },
          { onConflict: 'user_id,lecturer_id,chapter_id' }
        );
      }
    }
  },

  addAttempts: async (newAttempts) => {
    const { userId } = get();
    set((s) => ({ attempts: [...s.attempts, ...newAttempts] }));

    if (userId) {
      const rows = newAttempts.map((a) => ({
        id: a.id,
        user_id: userId,
        date: a.date,
        mode: a.mode,
        subject_id: a.subjectId,
        chapter_id: a.chapterId,
        topic_id: a.topicId,
        question: a.question,
        options: a.options,
        correct_answer: a.correctAnswer,
        student_answer: a.studentAnswer,
        is_correct: a.isCorrect,
        mistake_type: a.mistakeType,
        explanation: a.explanation,
        formula_used: a.formulaUsed,
        time_spent: a.timeSpent,
        exam_type: a.examType,
      }));
      await supabase.from('question_attempts').insert(rows);
    }
  },

  addTestResult: async (result) => {
    const { userId } = get();
    set((s) => ({ testResults: [...s.testResults, result] }));

    if (userId) {
      await supabase.from('test_results').insert({
        id: result.id,
        user_id: userId,
        date: result.date,
        subject_id: result.subjectId,
        chapter_id: result.chapterId,
        exam_type: result.examType,
        total_questions: result.totalQuestions,
        correct_answers: result.correctAnswers,
        score: result.score,
        time_taken: result.timeTaken,
        time_allowed: result.timeAllowed,
        attempt_ids: result.attempts.map((a) => a.id),
      });
    }
  },

  getWrongAttempts: (subjectId?: string, chapterId?: string) => {
    const { attempts } = get();
    return attempts.filter((a) => {
      if (a.isCorrect) return false;
      if (subjectId && a.subjectId !== subjectId) return false;
      if (chapterId && a.chapterId !== chapterId) return false;
      return true;
    });
  },

  getTopicPerformance: (topicId: string) => {
    const { attempts } = get();
    const topicAttempts = attempts.filter((a) => a.topicId === topicId);
    const correct = topicAttempts.filter((a) => a.isCorrect).length;
    return {
      total: topicAttempts.length,
      correct,
      rate: topicAttempts.length > 0 ? Math.round((correct / topicAttempts.length) * 100) : 0,
    };
  },
}));
