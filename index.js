
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Allow larger payloads for PDF text

// For Render, API key will be in environment variables
const api_key = process.env.GEMINI_API_KEY || process.env.API_KEY;
const genAI = new GoogleGenerativeAI(api_key);

// Helper to clean and parse JSON from AI response
function cleanAndParseJSON(text) {
    try {
        // Remove markdown code blocks if present
        const cleaned = text.replace(/```json|```/g, '').trim();
        return JSON.parse(cleaned);
    } catch (e) {
        console.error("JSON Parse Error. First 500 chars:", text.substring(0, 500));
        console.error("Parse error details:", e.message);
        throw new Error("AI returned invalid JSON format. Please try again.");
    }
}

// Helper for AI generation with JSON schema Support
async function generateAIResponse(modelName, prompt, schema = null, search = false) {
    console.log(`[AI Request] Model: ${modelName}, Search: ${search}`);
    const model = genAI.getGenerativeModel({
        model: modelName,
        tools: search ? [{ googleSearch: {} }] : undefined
    });

    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: schema ? { responseMimeType: "application/json" } : undefined
    });

    const response = result.response;
    const text = response.text();
    console.log(`[AI Response] Length: ${text.length} chars`);

    let sources = [];
    if (search) {
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        sources = chunks
            .filter((g) => g.web)
            .map((g) => ({ uri: g.web.uri, title: g.web.title }));
    }

    return { text, sources };
}

// Routes
app.post('/api/extract-syllabus', async (req, res) => {
    console.log("-> /api/extract-syllabus");
    try {
        const { text, lang } = req.body;
        const prompt = `Extract TNPSC Group 1 syllabus from this text into structured JSON. Format: [{ "subject": "History", "topics": [{ "name": "Topic", "subtopics": ["Sub"] }] }]. Language: ${lang}. Content: ${text.substring(0, 10000)}`;
        const { text: responseText } = await generateAIResponse("gemini-2.5-flash", prompt, true);
        res.json({ success: true, data: cleanAndParseJSON(responseText) });
    } catch (error) {
        console.error("[ERROR]", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/generate-schedule', async (req, res) => {
    console.log("-> /api/generate-schedule");
    try {
        const { config, syllabus, questionPapersContent, lang, progressData } = req.body;

        // Calculate days until exam
        const today = new Date();
        const examDate = new Date(config.examDate);
        const daysUntilExam = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));

        // Determine start date for this generation
        const startDate = progressData?.lastGeneratedDate
            ? new Date(new Date(progressData.lastGeneratedDate).getTime() + 86400000) // Next day after last
            : today;

        // Generate 30 days at a time
        const periodDays = 30;
        const endDate = new Date(startDate.getTime() + (periodDays * 86400000));

        // Extract completed and missed topics
        const completedTopics = progressData?.completedTopics || [];
        const missedTopics = progressData?.missedTopics || [];

        // Build context about progress
        let progressContext = "";
        if (completedTopics.length > 0) {
            progressContext += `\nCompleted topics (don't repeat): ${completedTopics.join(', ')}`;
        }
        if (missedTopics.length > 0) {
            progressContext += `\nMISSED topics (MUST include with priority): ${missedTopics.join(', ')}`;
        }

        // Determine intensity based on time remaining
        const isNearExam = daysUntilExam < 60;
        const intensityNote = isNearExam
            ? "EXAM IS NEAR: Increase revision days, add more mock tests, focus on high-yield topics."
            : "Regular pace: Balance new topics with revision.";

        const prompt = `Generate a 30-day TNPSC study plan.

START DATE: ${startDate.toISOString().split('T')[0]}
END DATE: ${endDate.toISOString().split('T')[0]}
EXAM DATE: ${config.examDate} (${daysUntilExam} days remaining)
STUDY HOURS/DAY: ${config.studyHoursPerDay}
TECHNIQUES: ${config.preferredMethods?.join(', ')}

SYLLABUS: ${JSON.stringify(syllabus).substring(0, 2000)}
${progressContext}

${intensityNote}

RULES:
1. Generate EXACTLY 30 days starting from ${startDate.toISOString().split('T')[0]}
2. PRIORITIZE missed topics in first week
3. Saturdays: MOCK_TEST
4. Sundays: REVISION
5. Don't repeat completed topics
6. Each task should be concise: "Subject - Topic (Xhrs)"

FORMAT (JSON array):
{
  "id": 1,
  "date": "YYYY-MM-DD",
  "type": "STUDY" | "REVISION" | "MOCK_TEST",
  "tasks": ["Task 1", "Task 2"],
  "isCompleted": false
}

Return ONLY valid JSON array.`;

        const { text: responseText } = await generateAIResponse("gemini-2.5-flash", prompt, true);
        res.json({ success: true, data: cleanAndParseJSON(responseText) });
    } catch (error) {
        console.error("[ERROR]", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/current-affairs', async (req, res) => {
    console.log("-> /api/current-affairs");
    try {
        const { lang } = req.query;
        const prompt = `Search for latest weekly TNPSC relevant current affairs. Return JSON array with title, summary, category (STATE, NATIONAL, ECONOMY, SCIENCE, INTERNATIONAL), date. Language: ${lang}`;
        const { text: responseText, sources } = await generateAIResponse("gemini-2.5-flash", prompt, true, true);
        const news = cleanAndParseJSON(responseText);
        const data = news.map((n, idx) => ({ ...n, id: `ca-${idx}`, sources: sources.slice(0, 2) }));
        res.json({ success: true, data });
    } catch (error) {
        console.error("[ERROR]", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/practice-question', async (req, res) => {
    console.log("-> /api/practice-question");
    try {
        const { topics, questionPapers, lang } = req.body;
        const prompt = `Generate one TNPSC question and explanation as JSON: {question, explanation}. Topics: ${topics.join(', ')}. Language: ${lang}. Context: ${questionPapers?.substring(0, 5000)}`;
        const { text: responseText } = await generateAIResponse("gemini-2.5-flash", prompt, true);
        res.json({ success: true, data: cleanAndParseJSON(responseText) });
    } catch (error) {
        console.error("[ERROR]", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/motivation', async (req, res) => {
    console.log("-> /api/motivation");
    try {
        const { lang } = req.query;
        const prompt = `Short motivational quote for student. Language: ${lang}. Just text.`;
        const { text: responseText } = await generateAIResponse("gemini-2.5-flash", prompt);
        res.json({ success: true, data: responseText.trim() });
    } catch (error) {
        console.error("[ERROR]", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/mock-test', async (req, res) => {
    console.log("-> /api/mock-test");
    try {
        const { completedTopics, oldPapers, lang } = req.body;
        const prompt = `As a TNPSC Examiner, generate a Mock Test (10 MCQs) in ${lang === 'ta' ? 'Tamil' : 'English'}. Topics: ${completedTopics.join(', ')}. Context: ${oldPapers?.substring(0, 5000)}. Return JSON array of objects with {question, options, correctAnswer, explanation}.`;
        const { text: responseText } = await generateAIResponse("gemini-2.5-flash", prompt, true);
        res.json({ success: true, data: cleanAndParseJSON(responseText) });
    } catch (error) {
        console.error("[ERROR]", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/parse-schedule', async (req, res) => {
    console.log("-> /api/parse-schedule");
    try {
        const { text, examDate } = req.body;
        const prompt = `Transform this manual study schedule into structured JSON StudyDay objects. Exam: ${examDate}. Content: ${text}. Format: JSON array of {id, date, type, tasks, isCompleted}.`;
        const { text: responseText } = await generateAIResponse("gemini-2.5-flash", prompt, true);
        res.json({ success: true, data: cleanAndParseJSON(responseText) });
    } catch (error) {
        console.error("[ERROR]", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`[Ready] VetriPathai Backend running on port ${PORT}`);
});
