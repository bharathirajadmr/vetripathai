
export type Language = 'en' | 'ta';

export interface User {
  fullName: string;
  email: string;
  mobile: string;
  password?: string;
  subscriptionStatus: 'trial' | 'active' | 'expired';
  subscriptionExpiry: string;
  deviceId: string;
  lastLoginTime: string;
  appData?: AppState;
}

export interface UserConfig {
  examName: string;
  examDate: string;
  startDate?: string;
  endDate?: string;
  theme?: 'light' | 'dark';
  studyHoursPerDay: number;
  language: Language;
  preferredMethods?: string[];
  specificPreferences?: string;
}

export interface SyllabusItem {
  subject: string;
  topics: {
    name: string;
    subtopics: string[];
    difficulty?: number;
  }[];
}

export interface MockTestQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface CurrentAffairItem {
  id: string;
  title: string;
  summary: string;
  category: 'STATE' | 'NATIONAL' | 'INTERNATIONAL' | 'ECONOMY' | 'SCIENCE';
  date: string;
  sources: GroundingSource[];
}

export interface StudyDay {
  id: string;
  date: string;
  type: 'STUDY' | 'REVISION' | 'MOCK_TEST' | 'REST';
  tasks: string[];
  isCompleted: boolean;
  completedTasks?: string[];
  actualHours?: number;
  confidence?: number;
  notes?: string;
  dailyQuestion?: {
    question: string;
    answer?: string;
    explanation?: string;
  };
  mockTest?: MockTestQuestion[];
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedDate?: string;
}

export interface AppState {
  user: UserConfig | null;
  syllabus: SyllabusItem[] | null;
  schedule: StudyDay[] | null;
  logs: Record<string, Partial<StudyDay>>;
  streak: number;
  level: number;
  xp: number;
  badges: Badge[];
  hardTopics: string[];
  longestStreak: number;
  lastUpdateDate: string | null;
  questionPapersContent: string;
  setupMode?: 'ai' | 'manual';
  streakHistory?: string[];
  currentAffairs?: CurrentAffairItem[];
  motivation?: string;
}

export interface DashboardStats {
  totalCompletion: number;
  subjectProgress: { name: string; percentage: number }[];
  consistencyData: { date: string; hours: number }[];
  feedback: string;
  pendingTasks: { dayId: string; date: string; task: string }[];
}

export interface SearchResult {
  type: 'SYLLABUS' | 'SCHEDULE' | 'NOTE';
  title: string;
  content: string;
  date?: string;
  relatedNotes?: string;
  id?: string;
}
