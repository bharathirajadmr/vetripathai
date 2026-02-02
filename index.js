
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
        generationConfig: schema ? {
            responseMimeType: "application/json",
            temperature: 0.2 // Lower temperature for more consistent JSON
        } : {
            temperature: 0.7
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

        const today = new Date();
        const examDate = new Date(config.examDate);
        const daysUntilExam = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));

        const startDate = progressData?.lastGeneratedDate
            ? new Date(new Date(progressData.lastGeneratedDate).getTime() + 86400000)
            : today;

        const periodDays = 30;
        const endDate = new Date(startDate.getTime() + (periodDays * 86400000));

        const completedTopics = progressData?.completedTopics || [];
        const missedTopics = progressData?.missedTopics || [];

        let progressContext = "";
        if (completedTopics.length > 0) {
            progressContext += `\nCompleted topics (don't repeat): ${completedTopics.join(', ')}`;
        }
        if (missedTopics.length > 0) {
            progressContext += `\nMISSED topics (MUST include with priority): ${missedTopics.join(', ')}`;
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
1. Generate EXACTLY 30 days starting from ${startDate.toISOString().split('T')[0]}
2. PRIORITIZE missed topics in first week
3. Saturdays: MOCK_TEST
4. Sundays: REVISION
5. Don't repeat completed topics
6. Return ONLY valid JSON array.

FORMAT:
{
  "id": "day-1",
  "date": "YYYY-MM-DD",
  "type": "STUDY" | "REVISION" | "MOCK_TEST",
  "tasks": ["Task 1", "Task 2"],
  "isCompleted": false
}`;

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
        const prompt = `Find 5-6 latest TNPSC current affairs from the past 7 days.
        Categories: STATE (Tamil Nadu), NATIONAL (India), ECONOMY, SCIENCE, INTERNATIONAL.
        Return EXCLUSIVELY a JSON array of objects with keys: title, summary, category, date.
        Language: ${lang === 'ta' ? 'Tamil' : 'English'}.
        Topics should be relevant to competitive exams like TNPSC.`;

        const { text: responseText, sources } = await generateAIResponse("gemini-2.5-flash", prompt, true, true);
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

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`[Ready] VetriPathai Backend running on port ${PORT}`);
});
