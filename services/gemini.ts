
import { SyllabusItem, StudyDay, UserConfig, MockTestQuestion, CurrentAffairItem } from "../types";
import { API_URL } from "../constants";

async function apiCall<T>(path: string, method: string = 'GET', body?: any): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    console.error(`API Error: Expected JSON but got ${contentType}. First 200 chars: ${text.substring(0, 200)}`);
    throw new Error(
      `Server returned an invalid response (not JSON). This usually means the server timed out or had an internal error. Type: ${contentType}`
    );
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'API call failed');
  }
  return result.data;
}

export async function extractSyllabus(text: string, lang: 'en' | 'ta'): Promise<SyllabusItem[]> {
  return apiCall<SyllabusItem[]>('/api/extract-syllabus', 'POST', { text, lang });
}

export async function fetchWeeklyCurrentAffairs(lang: 'en' | 'ta'): Promise<CurrentAffairItem[]> {
  return apiCall<CurrentAffairItem[]>(`/api/current-affairs?lang=${lang}`);
}

export async function generateSchedule(
  syllabus: SyllabusItem[],
  config: UserConfig,
  questionPapersContent: string,
  progressData?: {
    completedTopics: string[];
    missedTopics: string[];
    hardTopics: string[];
    lastGeneratedDate: string;
  }
): Promise<StudyDay[]> {
  const lang = config.language || 'en';
  return apiCall<StudyDay[]>('/api/generate-schedule', 'POST', {
    syllabus,
    config,
    questionPapersContent,
    lang,
    progressData
  });
}

export async function generateMockTest(
  completedTopics: string[],
  oldPapers: string,
  lang: 'en' | 'ta'
): Promise<MockTestQuestion[]> {
  // This is a placeholder as the backend implements practice questions MVP
  // For a full mock test, we would add a dedicated backend route
  return apiCall<MockTestQuestion[]>('/api/mock-test', 'POST', { completedTopics, oldPapers, lang });
}

export async function generateDailyQuestion(
  topics: string[],
  oldPapers: string,
  lang: 'en' | 'ta'
): Promise<{ question: string; explanation: string }> {
  return apiCall<{ question: string; explanation: string }>('/api/practice-question', 'POST', { topics, oldPapers, lang });
}

export async function getMotivationalQuote(lang: 'en' | 'ta'): Promise<string> {
  return apiCall<string>(`/api/motivation?lang=${lang}`);
}

// Keeping a shell for parseManualSchedule if still needed
export async function parseManualSchedule(text: string, examDate: string): Promise<StudyDay[]> {
  return apiCall<StudyDay[]>('/api/parse-schedule', 'POST', { text, examDate });
}
export async function fetchDailySummary(tasks: string[], language: 'en' | 'ta'): Promise<string> {
  const response = await fetch(`${API_URL}/api/daily-summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tasks, language }),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.summary;
}
