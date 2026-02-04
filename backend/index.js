
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
    try {
        const model = genAI.getGenerativeModel({
            model: modelName,
            tools: search ? [{ googleSearch: {} }] : undefined,
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ]
        });

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: (schema && !search) ? {
                responseMimeType: "application/json",
                temperature: 0.2
            } : {
                temperature: search ? 0.4 : 0.7
            }
        });

        const response = result.response;
        const text = response.text();
        console.log(`[AI Response] Length: ${text.length} chars`);

        // Log a snippet for debugging parse errors
        if (schema) {
            console.log(`[AI JSON Snippet] ${text.substring(0, 100)}...`);
        }

        let sources = [];
        if (search) {
            const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
            sources = chunks
                .filter((g) => g.web)
                .map((g) => ({ uri: g.web.uri, title: g.web.title }));
        }

        return { text, sources };
    } catch (error) {
        // Handle Rate Limit (429) fallback
        if ((error.message.includes('429') || error.message.includes('Resource exhausted')) && modelName === 'gemini-2.0-flash') {
            console.warn(`[Fallback] 429 Rate Limit hit for 2.0-flash. Retrying with 1.5-flash...`);
            return generateAIResponse('gemini-1.5-flash', prompt, schema, search);
        }
        throw error;
    }
}

// Routes
app.post('/api/extract-syllabus', async (req, res) => {
    console.log("-> /api/extract-syllabus");
    try {
        const { text, lang } = req.body;
        // Increase context window for syllabus
        const contextText = text.length > 50000 ? text.substring(0, 50000) : text;
        const prompt = `Extract TNPSC Group 1 syllabus from this text into structured JSON. 
        Format: [{ "subject": "History", "topics": [{ "name": "Topic", "subtopics": ["Sub"] }] }]. 
        Language: ${lang}. 
        Content: ${contextText}`;

        // Use 2.5-flash for speed and reliability
        const { text: responseText } = await generateAIResponse("gemini-2.0-flash", prompt, true);
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

        const today = new Date();
        const examDate = new Date(config.examDate);
        const daysUntilExam = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));

        const lastGeneratedDate = progressData?.lastGeneratedDate;
        const startDate = (lastGeneratedDate && !isNaN(new Date(lastGeneratedDate).getTime()))
            ? new Date(new Date(lastGeneratedDate).getTime() + 86400000)
            : today;

        const periodDays = 30;
        const endDate = new Date(startDate.getTime() + (periodDays * 86400000));

        const completedTopics = progressData?.completedTopics || [];
        const missedTopics = progressData?.missedTopics || [];
        const hardTopics = progressData?.hardTopics || [];

        let progressContext = "";
        if (completedTopics.length > 0) {
            progressContext += `\nCompleted topics (don't repeat): ${completedTopics.join(', ')}`;
        }
        if (missedTopics.length > 0) {
            progressContext += `\nMISSED topics (MUST include with priority): ${missedTopics.join(', ')}`;
        }
        if (hardTopics.length > 0) {
            progressContext += `\nHARD topics (Marked by user as difficult, include in Spaced Repetition/Revision slots): ${hardTopics.join(', ')}`;
        }

        const isNearExam = daysUntilExam < 60;
        const intensityNote = isNearExam
            ? "EXAM IS NEAR: Increase revision days, add more mock tests, focus on high-yield topics."
            : "Regular pace: Balance new topics with revision.";

        const prompt = `As a TNPSC Expert, generate a 30-day Study Plan.
        
START DATE: ${startDate.toISOString().split('T')[0]}
END DATE: ${endDate.toISOString().split('T')[0]}
EXAM DATE: ${config.examDate} (${daysUntilExam} days remaining)
STUDY HOURS/DAY: ${config.studyHoursPerDay}
TECHNIQUES: ${config.preferredMethods?.join(', ')}

SYLLABUS: ${JSON.stringify(syllabus).substring(0, 10000)}
${progressContext}

${intensityNote}

RULES:
1. Generate EXACTLY 30 days starting from ${startDate.toISOString().split('T')[0]}.
2. If techniques include 'Interleaved Study', EACH daily "tasks" array MUST have exactly 3 items: 
   - Slot 1: A Core subject topic (Polity/History/Unit 8) - ~2 hrs.
   - Slot 2: Aptitude & Mental Ability topic (Unit 10) - ~1 hr.
   - Slot 3: Dynamic subject topic (Current Affairs/Science & Tech) - ~1.5 hrs.
   Format these 3 tasks as "Slot 1: [Topic]", "Slot 2: [Topic]", "Slot 3: [Topic]".
3. PRIORITIZE missed topics in first week.
4. Saturdays: MOCK_TEST.
5. Sundays: REVISION.
6. Don't repeat completed topics.
7. Return ONLY valid JSON array.
8. If NOT Interleaved, "tasks" can be 3-5 general topics.

FORMAT:
{
  "id": "day-1",
  "date": "YYYY-MM-DD",
  "type": "STUDY" | "REVISION" | "MOCK_TEST",
  "tasks": ["Task 1", "Task 2"],
  "isCompleted": false
}`;

        const { text: responseText } = await generateAIResponse("gemini-2.0-flash", prompt, true);
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
        const prompt = `Find 5-6 latest TNPSC current affairs from the past 7 days.
        Categories: STATE (Tamil Nadu), NATIONAL (India), ECONOMY, SCIENCE, INTERNATIONAL.
        Return EXCLUSIVELY a JSON array of objects with keys: title, summary, category, date.
        DO NOT include any markdown formatting or code blocks, just the raw JSON text.
        Language: ${lang === 'ta' ? 'Tamil' : 'English'}.
        Topics should be relevant to competitive exams like TNPSC.`;

        const { text: responseText, sources } = await generateAIResponse("gemini-2.0-flash", prompt, true, true);
        const news = cleanAndParseJSON(responseText);

        // Ensure data consistency
        const data = news.map((n, idx) => ({
            id: `ca-${idx}`,
            title: n.title || n.Name || "Current Event",
            summary: n.summary || n.Description || n.content || "",
            category: (n.category || "GENERAL").toUpperCase(),
            date: n.date || new Date().toISOString().split('T')[0],
            sources: sources.slice(0, 2)
        }));

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
        const prompt = `As a TNPSC Examiner, generate 5 difficult MCQs based on these topics: ${topics.join(', ')}. 
        Latest TNPSC trends must be followed.
        Requirement: Include exactly 5 questions.
        Specific Requirement: One question MUST be of 'Assertion and Reason' type.
        Return EXCLUSIVELY a JSON array: [{ "question": "...", "explanation": "..." }].
        Language: ${lang}. 
        Context: ${questionPapers?.substring(0, 5000)}`;
        const { text: responseText } = await generateAIResponse("gemini-2.0-flash", prompt, true);
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
        const { text: responseText } = await generateAIResponse("gemini-2.0-flash", prompt);
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
        const { text: responseText } = await generateAIResponse("gemini-2.0-flash", prompt, true);
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
        const { text: responseText } = await generateAIResponse("gemini-2.0-flash", prompt, true);
        res.json({ success: true, data: cleanAndParseJSON(responseText) });
    } catch (error) {
        console.error("[ERROR]", error);
        res.status(500).json({ success: false, error: error.message });
    }
});


// State Persistence
const fs = require('fs');
const path = require('path');
const STATE_DIR = path.join(__dirname, 'data', 'states');

if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
}

app.get('/api/user/state', (req, res) => {
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const filePath = path.join(STATE_DIR, `${Buffer.from(email).toString('base64')}.json`);
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        res.json({ success: true, data: JSON.parse(data) });
    } else {
        res.json({ success: true, data: null });
    }
});

app.post('/api/user/state', (req, res) => {
    const { email, state } = req.body;
    if (!email || !state) return res.status(400).json({ error: 'Email and state required' });

    const filePath = path.join(STATE_DIR, `${Buffer.from(email).toString('base64')}.json`);
    fs.writeFileSync(filePath, JSON.stringify(state), 'utf8');
    res.json({ success: true });
});

app.get('/api/syllabus/:id', (req, res) => {
    const { id } = req.params;
    const filePath = path.join(__dirname, 'data', 'syllabuses', `${id}.txt`);
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        res.json({ success: true, data });
    } else {
        res.status(404).json({ success: false, error: 'Syllabus not found' });
    }
});

app.post('/api/daily-summary', async (req, res) => {
    try {
        const { tasks, language } = req.body;
        const prompt = `As a friendly AI mentor, provide a 30-45 second motivational summary of today's study plan for a student preparing for TNPSC.
        
        TASKS FOR TODAY:
        ${tasks.join('\n- ')}
        
        LANGUAGE: ${language === 'ta' ? 'Tamil' : 'English'}
        
        INSTRUCTIONS:
        - Keep it encouraging and high-energy.
        - Don't just list the topics; explain *why* they are important or give a quick tip.
        - Sound natural, like a podcast or mentor briefing.
        - Max 100 words.
        - Return ONLY the plain text summary without any markdown or formatting.`;

        const { text: summary } = await generateAIResponse("gemini-2.0-flash", prompt);
        res.json({ success: true, summary });
    } catch (error) {
        console.error('Summary error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Self-ping to keep Render awake
const https = require('https');
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
if (RENDER_URL) {
    setInterval(() => {
        https.get(`${RENDER_URL}/health`, (res) => {
            console.log(`[Self-Ping] Status: ${res.statusCode}`);
        }).on('error', (err) => {
            console.error('[Self-Ping] Error:', err.message);
        });
    }, 14 * 60 * 1000); // 14 minutes
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`[Ready] VetriPathai Backend running on port ${PORT}`);
});
