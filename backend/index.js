
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const QUIZ_BANK_PATH = path.join(__dirname, 'data', 'quiz_bank.json');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Allow larger payloads for PDF text

// For Render, API key will be in environment variables
const api_key = process.env.GEMINI_API_KEY || process.env.API_KEY;
const genAI = new GoogleGenerativeAI(api_key);

const GENERIC_TNPSC_QUIZ = [
    { "question": "Who is known as the 'Father of Local Self Government' in India?", "options": ["Lord Mayo", "Lord Ripon", "Lord Curzon", "Lord Dalhousie"], "correctAnswer": "B", "explanation": "Lord Ripon is known as the Father of Local Self Government in India." },
    { "question": "Which article of the Indian Constitution deals with the Right to Equality?", "options": ["Article 14", "Article 17", "Article 21", "Article 44"], "correctAnswer": "A", "explanation": "Article 14 ensures equality before the law." },
    { "question": "The Shore Temple is located in which city?", "options": ["Kanchipuram", "Thanjavur", "Mahabalipuram", "Madurai"], "correctAnswer": "C", "explanation": "The Shore Temple is an iconic 8th-century structure in Mahabalipuram." },
    { "question": "Who was the first woman to become the Governor of an Indian state?", "options": ["Sarojini Naidu", "Sucheta Kripalani", "Vijayalakshmi Pandit", "Indira Gandhi"], "correctAnswer": "A", "explanation": "Sarojini Naidu was the Governor of United Provinces (now Uttar Pradesh)." },
    { "question": "Which planet is known as the Blue Planet?", "options": ["Mars", "Venus", "Earth", "Neptune"], "correctAnswer": "C", "explanation": "Earth is called the Blue Planet due to the presence of water." },
    { "question": "The Sepoy Mutiny took place in which year?", "options": ["1857", "1757", "1885", "1942"], "correctAnswer": "A", "explanation": "The first war of Indian Independence occurred in 1857." },
    { "question": "What is the official language of Tamil Nadu?", "options": ["Hindi", "English", "Tamil", "Sanskrit"], "correctAnswer": "C", "explanation": "Tamil is the official language of the state." },
    { "question": "Who founded the Self-Respect Movement?", "options": ["E.V. Ramasamy (Periyar)", "C.N. Annadurai", "M.G. Ramachandran", "K. Kamaraj"], "correctAnswer": "A", "explanation": "Periyar started the Self-Respect Movement in 1925." },
    { "question": "Which is the highest peak in Southern India?", "options": ["Anamudi", "Doddabetta", "Kalsubai", "Mahendragiri"], "correctAnswer": "A", "explanation": "Anamudi in Kerala is the highest peak in the Western Ghats and South India." },
    { "question": "Who composed the song 'Jana Gana Mana'?", "options": ["Bankim Chandra Chatterjee", "Rabindranath Tagore", "Sarojini Naidu", "Subhash Chandra Bose"], "correctAnswer": "B", "explanation": "Rabindranath Tagore wrote the National Anthem of India." }
];

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
async function generateAIResponse(modelName, prompt, schema = null, search = false, isRetry = false) {
    // Force gemini-2.0-flash as it's the only one working for this user
    const activeModel = (modelName === 'RETRY_INTERNAL' || modelName === 'gemini-1.5-flash-latest' || modelName === 'gemini-1.5-flash')
        ? 'gemini-2.0-flash'
        : modelName;

    console.log(`[AI Request] Model: ${activeModel}, Search: ${search}, Length: ${prompt.length}${isRetry ? ' (RETRY)' : ''}`);

    try {
        const model = genAI.getGenerativeModel({
            model: activeModel,
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
                temperature: 0.1
            } : {
                temperature: search ? 0.4 : 0.7
            }
        });

        const response = result.response;
        const text = response.text();
        console.log(`[AI Response] Status: Success, Length: ${text.length} chars`);

        let sources = [];
        if (search) {
            const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
            sources = chunks
                .filter((g) => g.web)
                .map((g) => ({ uri: g.web.uri, title: g.web.title }));
        }

        return { text, sources };
    } catch (error) {
        const isRateLimit = error.message.includes('429') || error.message.includes('Resource exhausted');
        console.error(`[AI Error] ${activeModel} failed${isRetry ? ` (Retry #${isRetry})` : ''}:`, error.message);

        // If it's a Rate Limit (429), we need to be very patient
        if (isRateLimit) {
            const retryCount = typeof isRetry === 'number' ? isRetry : (isRetry ? 1 : 0);
            if (retryCount < 3) {
                // Exponential backoff: 10s, 20s, 30s
                const waitTime = (retryCount + 1) * 10000;

                // If we've failed twice WITH search, try WITHOUT search on the next retry
                // Grounding (Google Search) often has very tight RPM limits.
                const nextSearchSetting = (retryCount >= 1) ? false : search;

                console.warn(`[Rate Limit] Waiting ${waitTime / 1000}s before retry #${retryCount + 1}... ${nextSearchSetting === false && search === true ? '(Disabling Grounding for stability)' : ''}`);

                await new Promise(r => setTimeout(r, waitTime));
                return generateAIResponse(activeModel, prompt, schema, nextSearchSetting, retryCount + 1);
            }
        }

        // For other errors, only retry once after 3s
        if (!isRetry && !isRateLimit && activeModel === 'gemini-2.0-flash') {
            console.warn(`[Retry] Transient error. Waiting 3s...`);
            await new Promise(r => setTimeout(r, 3000));
            return generateAIResponse(activeModel, prompt, schema, search, 1);
        }

        throw new Error(`AI Service (${activeModel}) failed (Final attempt): ${error.message}`);
    }
}

// Routes
app.post('/api/extract-syllabus', async (req, res) => {
    console.log("-> /api/extract-syllabus");
    try {
        const { text, lang } = req.body;
        // Increase context window for syllabus
        const contextText = text.length > 50000 ? text.substring(0, 50000) : text;
        const prompt = `Extract ${lang === 'ta' ? 'தமிழ்' : 'TNPSC'} syllabus into structured JSON. 
        Format: [{ "subject": "History", "topics": [{ "name": "Topic", "subtopics": ["Sub"], "weightage": "High" | "Medium" | "Low", "marksWeight": number }] }]. 
        Weightage Assignment Rules:
        - High: Core topics (e.g., Unit 8, Unit 9, Polity, INM, Aptitude). marksWeight should be 8-12.
        - Medium: Current Affairs, Geography, Economy. marksWeight should be 4-7.
        - Low: General Science core, specific minor units. marksWeight should be 1-3.
        Language: ${lang === 'ta' ? 'Tamil' : 'English'}. 
        Content: ${contextText}`;

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
LANGUAGE: ${lang === 'ta' ? 'Tamil' : 'English'}

SYLLABUS: ${JSON.stringify(syllabus).substring(0, 30000)}
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

Format:
{
  "id": "day-1",
  "date": "YYYY-MM-DD",
  "type": "STUDY" | "REVISION" | "MOCK_TEST",
  "tasks": ["Task 1", "Task 2"],
  "isCompleted": false,
  "weightageInfo": { "Task 1": "High", "Task 2": "Medium" }
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
        Relevance: High (Core syllabus), Medium (General awareness), Low (FYI).
        Return EXCLUSIVELY a JSON array of objects with keys: title, summary, category, date, relevance.
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
            relevance: (n.relevance || "Medium").charAt(0).toUpperCase() + (n.relevance || "Medium").slice(1).toLowerCase(),
            date: n.date || new Date().toISOString().split('T')[0],
            sources: sources.slice(0, 2)
        }));

        res.json({ success: true, data });
    } catch (error) {
        console.error("[ERROR]", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/topic-quiz', async (req, res) => {
    console.log("-> /api/topic-quiz");
    try {
        const { topic, lang } = req.body;
        const normalizedTopic = topic.trim().toLowerCase();

        // 1. Check Local Cache First
        let quizBank = {};
        if (fs.existsSync(QUIZ_BANK_PATH)) {
            try {
                quizBank = JSON.parse(fs.readFileSync(QUIZ_BANK_PATH, 'utf8'));
            } catch (err) {
                console.error("Quiz bank parse error:", err);
            }
        }

        const cacheKey = `${lang}_${normalizedTopic}`;
        if (quizBank[cacheKey]) {
            console.log(`[Cache Hit] Serving questions for: ${topic}`);
            return res.json({ success: true, data: quizBank[cacheKey] });
        }

        // 2. Fallback to AI if not in cache
        console.log(`[Cache Miss] Calling AI for: ${topic}`);
        const prompt = `As a TNPSC/Competitive Exam Expert, generate a Mastery Quiz (10 MCQs) specifically for the topic: "${topic}".
        INSTRUCTIONS:
        1. Search the internet for actual recent exam questions (2024-2025) related to this topic.
        2. Ensure the difficulty is High to test deep mastery.
        3. Follow standard exam format (Options A, B, C, D).
        4. Return EXCLUSIVELY a JSON array of objects with keys: question, options (array), correctAnswer (string, e.g., "A"), explanation.
        Language: ${lang === 'ta' ? 'Tamil' : 'English'}.`;

        const { text: responseText } = await generateAIResponse("gemini-2.0-flash", prompt, true, true);
        const quizData = cleanAndParseJSON(responseText);

        // 3. Save to Cache on success
        quizBank[cacheKey] = quizData;
        try {
            fs.writeFileSync(QUIZ_BANK_PATH, JSON.stringify(quizBank, null, 2));
        } catch (err) {
            console.error("Failed to save to quiz bank:", err);
        }

        res.json({ success: true, data: quizData });
    } catch (error) {
        console.error("[ERROR] Quiz generation failed:", error.message);

        // FINAL RESILIENCE: If AI fails and no cache, serve high-quality static questions
        console.warn(`[Failover] Serving Generic TNPSC Quiz as last resort for: ${topic}`);
        res.json({
            success: true,
            data: GENERIC_TNPSC_QUIZ,
            isFailover: true,
            originalError: error.message
        });
    }
});

app.post('/api/practice-question', async (req, res) => {
    console.log("-> /api/practice-question");
    try {
        const { topics, questionPapers, lang } = req.body;
        const prompt = `As a TNPSC/Competitive Exam Expert, find and generate 5 high-quality MCQs based on these topics: ${topics.join(', ')}. 
        IMPORTANT: These questions should be modeled after REAL Previous Year Questions (PYQs). Use the internet to check recent trends (2024-2025).
        
        Requirement: Include exactly 5 questions.
        Specific Requirement: One question MUST be of 'Assertion and Reason' type.
        Return EXCLUSIVELY a JSON array: [{ "question": "...", "explanation": "..." }].
        Language: ${lang === 'ta' ? 'Tamil' : 'English'}. 
        Context: ${questionPapers?.substring(0, 5000)}`;

        const { text: responseText } = await generateAIResponse("gemini-2.0-flash", prompt, true, true);
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
        const prompt = `As a TNPSC Senior Examiner, generate a formal Mock Test (10 MCQs) based on: ${completedTopics.join(', ')}.
        INSTRUCTIONS:
        1. Search the internet for actual TNPSC/UPSC questions related to these topics to ensure credibility.
        2. Follow the standard exam format (Options A, B, C, D).
        3. Match the difficulty level of 2024-2025 exams.
        
        Return EXCLUSIVELY a JSON array of objects with {question, options, correctAnswer, explanation}.
        Language: ${lang === 'ta' ? 'Tamil' : 'English'}. 
        Context: ${oldPapers?.substring(0, 5000)}.`;

        const { text: responseText } = await generateAIResponse("gemini-2.0-flash", prompt, true, true);
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
const STATE_DIR = path.join(__dirname, 'data', 'states');
const SETTINGS_FILE = path.join(__dirname, 'data', 'settings.json');

if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
}

// Initialize settings if not exists
if (!fs.existsSync(SETTINGS_FILE)) {
    const defaultSettings = {
        upiId: "officer@gpay",
        promoCodes: {
            "VETRI50": 50,
            "FIRSTOFFICER": 100,
            "DMR2026": 30
        },
        rateCard: [
            {
                name: 'Silver',
                rawPrice: 199,
                price: '₹199',
                period: '/month',
                features: ['Basic Study Plan', 'Weekly Practice Questions', 'Ad-free Experience'],
                color: 'bg-slate-100 text-slate-700',
                popular: false
            },
            {
                name: 'Gold Pro',
                rawPrice: 999,
                price: '₹999',
                period: '/year',
                features: ['AI Syllabus Analysis', 'Unlimited Mock Tests', 'Early Access to Updates'],
                color: 'bg-sky-600 text-white shadow-xl shadow-sky-200',
                popular: true
            },
            {
                name: 'Free Trial',
                rawPrice: 0,
                price: '₹0',
                period: '/7 days',
                features: ['Trial Study Plan', '1 Mock Test', 'Content Extraction'],
                color: 'bg-gray-50 text-gray-500',
                popular: false
            }
        ]
    };
    if (!fs.existsSync(path.dirname(SETTINGS_FILE))) {
        fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
    }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
}

app.get('/api/user/state', (req, res) => {
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const filePath = path.join(STATE_DIR, `${Buffer.from(email).toString('base64')}.json`);
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        const json = JSON.parse(data);
        // Handle both old format (pure state) and new format (wrapped object)
        const state = json.state || json;
        res.json({ success: true, data: state });
    } else {
        res.json({ success: true, data: null });
    }
});

app.post('/api/user/state', (req, res) => {
    const { email, state, user } = req.body;
    if (!email || !state) return res.status(400).json({ error: 'Email and state required' });

    const filePath = path.join(STATE_DIR, `${Buffer.from(email).toString('base64')}.json`);
    const dataToSave = user ? { state, user } : state;
    fs.writeFileSync(filePath, JSON.stringify(dataToSave), 'utf8');
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

app.post('/api/admin/upload-syllabus', (req, res) => {
    try {
        const { id, content } = req.body;
        const SYLLABUS_DIR = path.join(__dirname, 'data', 'syllabuses');
        if (!fs.existsSync(SYLLABUS_DIR)) fs.mkdirSync(SYLLABUS_DIR, { recursive: true });
        fs.writeFileSync(path.join(SYLLABUS_DIR, `${id}.txt`), content, 'utf8');
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/admin/settings', (req, res) => {
    try {
        const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
        res.json({ success: true, data: JSON.parse(data) });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/admin/settings', (req, res) => {
    try {
        const settings = req.body;
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/admin/subscribers', (req, res) => {
    try {
        const files = fs.readdirSync(STATE_DIR);
        const users = files.map(file => {
            try {
                const data = fs.readFileSync(path.join(STATE_DIR, file), 'utf8');
                const json = JSON.parse(data);

                // If we have the new format {state, user}
                if (json.user && json.user.email) return json.user;

                // Legacy format: just state. Extract UserConfig and try to match email
                const state = json.state || json;
                const emailBase64 = file.replace('.json', '');
                let email = 'Unknown';
                try {
                    email = Buffer.from(emailBase64, 'base64').toString('utf8');
                } catch (e) { }

                return {
                    fullName: (state.user && state.user.examName) ? `Candidate (${state.user.examName})` : 'Anonymous Aspirant',
                    email: email,
                    mobile: 'Not Provided',
                    subscriptionStatus: 'trial',
                    subscriptionExpiry: new Date().toISOString()
                };
            } catch (e) { return null; }
        }).filter(u => u);
        res.json({ success: true, data: users });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/leaderboard', (req, res) => {
    try {
        const files = fs.readdirSync(STATE_DIR);
        const entries = files.map(file => {
            try {
                const data = fs.readFileSync(path.join(STATE_DIR, file), 'utf8');
                const json = JSON.parse(data);
                const state = json.state || json;
                const user = json.user || state.user; // fallback to legacy user if within state

                if (!state || !state.user) return null;

                return {
                    name: `Candidate #${file.slice(0, 4)}`, // Anonymized
                    exam: state.user.examName || 'TNPSC',
                    level: state.level || 1,
                    xp: state.xp || 0,
                    streak: state.streak || 0
                };
            } catch (e) { return null; }
        }).filter(e => e)
            .sort((a, b) => (b.level * 1000 + b.xp) - (a.level * 1000 + a.xp)) // Sort by rank
            .slice(0, 10); // Top 10

        res.json({ success: true, data: entries });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
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
    console.log(`[Ready] Vetri Pathai Backend running on port ${PORT}`);
});
