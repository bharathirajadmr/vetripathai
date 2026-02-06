
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const QUIZ_BANK_PATH = path.join(__dirname, 'data', 'quiz_bank.json');
const CA_DB_PATH = path.join(__dirname, 'data', 'current_affairs_db.json');
const MOCK_BANK_PATH = path.join(__dirname, 'data', 'mock_bank.json');
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// Initialize users file if missing
if (!fs.existsSync(USERS_FILE)) {
    const adminExpiry = new Date();
    adminExpiry.setFullYear(adminExpiry.getFullYear() + 10);
    const initialUsers = [
        {
            fullName: 'VetriPathai Admin',
            email: 'admin@vetripathai.pro',
            mobile: '9884664436',
            password: 'admin',
            subscriptionStatus: 'active',
            subscriptionExpiry: adminExpiry.toISOString(),
            deviceId: 'ADMIN_DEVICE',
            lastLoginTime: new Date().toISOString()
        }
    ];
    if (!fs.existsSync(path.dirname(USERS_FILE))) fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(initialUsers, null, 2));
}

function getAllUsers() {
    try {
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
}

function saveUser(user) {
    const users = getAllUsers();
    const index = users.findIndex(u => u.email === user.email);
    if (index > -1) {
        users[index] = { ...users[index], ...user };
    } else {
        users.push(user);
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

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
        // 1. First try simple markdown block removal
        let cleaned = text.replace(/```json|```/g, '').trim();
        try {
            return JSON.parse(cleaned);
        } catch (e) {
            // 2. If that fails, try to find the first '{' or '[' and last '}' or ']'
            const firstBrace = text.indexOf('{');
            const firstBracket = text.indexOf('[');
            const start = (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) ? firstBrace : firstBracket;

            const lastBrace = text.lastIndexOf('}');
            const lastBracket = text.lastIndexOf(']');
            const end = (lastBrace > lastBracket) ? lastBrace : lastBracket;

            if (start !== -1 && end !== -1 && end > start) {
                cleaned = text.substring(start, end + 1);
                return JSON.parse(cleaned);
            }
            throw e; // Rethrow if no JSON structure found
        }
    } catch (e) {
        console.error("JSON Parse Error. First 500 chars:", text.substring(0, 500));
        console.error("Parse error details:", e.message);
        throw new Error("AI returned invalid JSON format. Please try again.");
    }
}

// Helper for AI generation with JSON schema Support
async function generateAIResponse(modelName, prompt, schema = null, search = false, isRetry = false) {
    // Priority Pool: If we are retrying, escalate to Pro for reliability
    let activeModel = modelName;

    if (isRetry && activeModel.includes('flash')) {
        activeModel = 'gemini-1.5-pro-latest'; // Escalate to most powerful model on failure
        console.log(`[Escalation] Switching to ${activeModel} for reliability.`);
    }

    // Default to 2.0 Flash for speed
    if (activeModel === 'gemini-1.5-flash' || activeModel === 'gemini-1.5-flash-latest') {
        activeModel = 'gemini-2.0-flash';
    }

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
                temperature: 0.1,
                maxOutputTokens: 8192
            } : {
                temperature: search ? 0.4 : 0.7,
                maxOutputTokens: 4096
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

// Auth Routes
app.post('/api/auth/signup', (req, res) => {
    const userData = req.body;
    const users = getAllUsers();
    if (users.find(u => u.email === userData.email)) {
        return res.status(400).json({ success: false, error: 'Email already registered' });
    }
    saveUser(userData);
    res.json({ success: true, user: userData });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = getAllUsers().find(u => u.email === email);
    if (!user || user.password !== password) {
        return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }
    // Update last login
    const updatedUser = { ...user, lastLoginTime: new Date().toISOString() };
    saveUser(updatedUser);
    res.json({ success: true, user: updatedUser });
});

app.post('/api/auth/reset-password', (req, res) => {
    const { email, newPassword } = req.body;
    const user = getAllUsers().find(u => u.email === email);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    user.password = newPassword;
    saveUser(user);
    res.json({ success: true });
});

app.post('/api/auth/update-user', (req, res) => {
    const userData = req.body;
    saveUser(userData);
    res.json({ success: true });
});

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

        if (!config || !syllabus) {
            console.warn("[WARN] Missing config or syllabus in request");
            return res.status(400).json({ success: false, error: "Missing configuration or syllabus" });
        }

        const today = new Date();
        const examDate = new Date(config.examDate);
        const daysUntilExam = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));

        const lastGeneratedDate = progressData?.lastGeneratedDate;
        let startDate;
        try {
            startDate = (lastGeneratedDate && !isNaN(new Date(lastGeneratedDate).getTime()))
                ? new Date(new Date(lastGeneratedDate).getTime() + 86400000)
                : today;
        } catch (e) {
            startDate = today;
        }

        const periodDays = config.daysToGenerate || 15;
        const endDate = new Date(startDate.getTime() + (periodDays * 86400000));

        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];

        console.log(`[Schedule Gen] Exam: ${config.examDate}, Days Left: ${daysUntilExam}, Period: ${startStr} to ${endStr} (${periodDays} days)`);

        const completedTopics = progressData?.completedTopics || [];
        const missedTopics = progressData?.missedTopics || [];
        const hardTopics = progressData?.hardTopics || [];

        let progressContext = "";
        if (completedTopics.length > 0) {
            progressContext += `\nCompleted topics (don't repeat): ${completedTopics.slice(-20).join(', ')}`; // Last 20 for context
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

        const prompt = `As a TNPSC Expert, generate a ${periodDays}-day Study Plan segment.
        
START DATE: ${startStr}
END DATE: ${endStr}
EXAM DATE: ${config.examDate} (${daysUntilExam} days remaining)
STUDY HOURS/DAY: ${config.studyHoursPerDay}
TECHNIQUES: ${config.preferredMethods?.join(', ')}
LANGUAGE: ${lang === 'ta' ? 'Tamil' : 'English'}

SYLLABUS: ${JSON.stringify(syllabus).substring(0, 30000)}
${progressContext}

${intensityNote}

RULES:
1. Generate EXACTLY ${periodDays} days starting from ${startStr}.
2. Each "tasks" array MUST have 3 items:
   - Slot 1: Core Subject (e.g. History/Polity)
   - Slot 2: Aptitude/Unit 10
   - Slot 3: Current Affairs or Revision
3. PRIORITIZE missed topics and "Hard" subjects in first week.
4. PRIORITY INTENSITY: 
   - Allocation: For "Hard" subjects, allocate 2x more frequency in Slot 1/2.
   - For "Easy" subjects, space them out more to avoid cognitive overload.
5. SATURDAYS: MOCK_TEST on topics studied THIS WEEK.
6. SUNDAYS: MOCK_TEST on ALL COMPLETED SUBJECTS (Comprehensive Mock Test).
7. DIVERSITY & STOCHASTIC ORDER: Do not follow the linear order of the provided SYLLABUS list. Rotate core subjects daily (e.g. Day 1: History, Day 2: Polity) to ensure variety.
8. TECHNIQUE ADHERENCE: If "Interleaved Study" is chosen, strictly mix 3 different subjects per day as defined in Slot 1, 2, 3.
9. Don't repeat completed topics.
10. Return ONLY valid JSON array.

Format:
{
  "id": "day-YYYY-MM-DD",
  "date": "YYYY-MM-DD",
  "type": "STUDY" | "REVISION" | "MOCK_TEST",
  "tasks": ["Task 1", "Task 2"],
  "isCompleted": false,
  "weightageInfo": { "Task 1": "High", "Task 2": "Medium" }
}`;

        const { text: responseText } = await generateAIResponse("gemini-2.0-flash", prompt, true);
        const parsedData = cleanAndParseJSON(responseText);
        console.log(`[Schedule Gen] Success! Generated ${parsedData.length} days. Sending response...`);
        res.json({ success: true, data: parsedData });
    } catch (error) {
        console.error("[ERROR] Generate Schedule Failed:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Helper to sync Current Affairs
async function syncCurrentAffairs(lang = 'en') {
    console.log(`[CA Sync] Syncing Current Affairs for ${lang}...`);
    try {
        const prompt = `Find 6-8 latest TNPSC current affairs for today (${new Date().toISOString().split('T')[0]}).
        Categories: STATE (Tamil Nadu), NATIONAL (India), ECONOMY, SCIENCE, INTERNATIONAL.
        Relevance: High (Core syllabus), Medium (General awareness), Low (FYI).
        Return EXCLUSIVELY a JSON array of objects with keys: title, summary, category, date, relevance.
        Language: ${lang === 'ta' ? 'Tamil' : 'English'}.
        Ensure dates are in YYYY-MM-DD format.`;

        const { text: responseText, sources } = await generateAIResponse("gemini-2.0-flash", prompt, true, true);
        const news = cleanAndParseJSON(responseText);

        let currentDB = { en: [], ta: [] };
        if (fs.existsSync(CA_DB_PATH)) {
            currentDB = JSON.parse(fs.readFileSync(CA_DB_PATH, 'utf8'));
        }

        const formattedNews = news.map((n, idx) => ({
            id: `ca-${Date.now()}-${idx}`,
            title: n.title || "Current Event",
            summary: n.summary || "",
            category: (n.category || "GENERAL").toUpperCase(),
            relevance: (n.relevance || "Medium"),
            date: n.date || new Date().toISOString().split('T')[0],
            sources: sources.slice(0, 2)
        }));

        // Merge and deduplicate by title
        const existingTitles = new Set(currentDB[lang].map(item => item.title));
        const uniqueNews = formattedNews.filter(item => !existingTitles.has(item.title));

        currentDB[lang] = [...uniqueNews, ...currentDB[lang]].slice(0, 100); // Keep last 100

        fs.writeFileSync(CA_DB_PATH, JSON.stringify(currentDB, null, 2));
        console.log(`[CA Sync] Success! Added ${uniqueNews.length} new items for ${lang}.`);
        return currentDB[lang];
    } catch (error) {
        console.error(`[CA Sync] Failed for ${lang}:`, error.message);
        return [];
    }
}

// Daily Schedule at 8:00 AM
cron.schedule('0 8 * * *', () => {
    console.log("[Cron] Running daily Current Affairs sync...");
    syncCurrentAffairs('en');
    syncCurrentAffairs('ta');
});

app.get('/api/current-affairs', async (req, res) => {
    const { lang = 'en' } = req.query;
    console.log(`-> GET /api/current-affairs (Lang: ${lang})`);

    try {
        if (!fs.existsSync(CA_DB_PATH)) {
            // If DB doesn't exist, do an initial sync
            await syncCurrentAffairs('en');
            await syncCurrentAffairs('ta');
        }

        const db = JSON.parse(fs.readFileSync(CA_DB_PATH, 'utf8'));
        const items = db[lang] || [];

        // Return last 7 days of data
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysStr = sevenDaysAgo.toISOString().split('T')[0];

        const filtered = items.filter(item => item.date >= sevenDaysStr);

        // If results are thin (e.g. just started), return at least 5 latest
        const finalData = filtered.length >= 5 ? filtered : items.slice(0, 8);

        res.json({ success: true, data: finalData });
    } catch (error) {
        console.error("[ERROR] CA Fetch failed:", error);
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
        const { completedTopics, oldPapers, lang, subject = 'General' } = req.body;

        // 1. Check Cache First
        let mockBank = {};
        if (fs.existsSync(MOCK_BANK_PATH)) {
            mockBank = JSON.parse(fs.readFileSync(MOCK_BANK_PATH, 'utf8'));
        }

        // Cache Key based on topics
        const cacheKey = `${subject}_${lang}_${Buffer.from((completedTopics || []).sort().join(',')).toString('base64').substring(0, 32)}`;

        if (mockBank[cacheKey]) {
            console.log(`[Mock Bank] Cache Hit for: ${subject}`);
            return res.json({ success: true, data: mockBank[cacheKey] });
        }

        console.log(`[Mock Bank] Cache Miss. Acting as Exam Preparer for: ${subject}`);

        // 2. AI Generation
        const prompt = `Act as an Expert Exam Question Paper Preparer for TNPSC/Competitive Exams.
        Your task is to generate 20 high-quality MCQs based on these completed topics: ${completedTopics.join(', ')}.
        
        GUIDELINES:
        1. Base the questions on actual Previous Year Question (PYQ) trends.
        2. Difficulty: Mix of 40% Moderate, 40% High, 20% Very High (Exam level).
        3. Format: ONE question must be 'Match the following', TWO must be 'Assertion & Reason', and others standard MCQs.
        4. VARIETY: 80% should be from provided topics, 20% should be GENERAL COMMON TNPSC topics (Aptitude, Ethics, Current Affairs) even if not in the "completed" list.
        5. Questions must be unique and historically/scientifically accurate.
        
        CONTEXT (PYQ Data): ${oldPapers?.substring(0, 8000) || "Follow standard 2024-2025 exam patterns."}
        
        Return EXCLUSIVELY a JSON array of 20 objects:
        { "question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": "Letter (A/B/C/D)", "explanation": "..." }
        
        Language: ${lang === 'ta' ? 'Tamil' : 'English'}.`;

        const { text: responseText } = await generateAIResponse("gemini-2.0-flash", prompt, true, true);
        const questions = cleanAndParseJSON(responseText);

        // 3. Save to Bank
        mockBank[cacheKey] = questions;
        try {
            if (!fs.existsSync(path.dirname(MOCK_BANK_PATH))) fs.mkdirSync(path.dirname(MOCK_BANK_PATH), { recursive: true });
            fs.writeFileSync(MOCK_BANK_PATH, JSON.stringify(mockBank, null, 2));
        } catch (err) {
            console.error("Failed to save to mock bank:", err);
        }

        res.json({ success: true, data: questions });
    } catch (error) {
        console.error("[ERROR] Mock Test Generation Failed:", error);
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

    console.log(`-> GET /api/user/state (User: ${email})`);
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

    console.log(`-> POST /api/user/state (User: ${email})`);
    const filePath = path.join(STATE_DIR, `${Buffer.from(email).toString('base64')}.json`);
    const dataToSave = user ? { state, user } : state;
    try {
        fs.writeFileSync(filePath, JSON.stringify(dataToSave), 'utf8');
        console.log(`   [State Saved] Size: ${Math.round(JSON.stringify(dataToSave).length / 1024)} KB`);
        res.json({ success: true });
    } catch (e) {
        console.error(`   [Save Error] ${e.message}`);
        res.status(500).json({ success: false, error: e.message });
    }
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

app.post('/api/mentor/weekly-report', async (req, res) => {
    console.log("-> /api/mentor/weekly-report");
    try {
        const { history, syllabus, lang } = req.body;

        const prompt = `As a strict and honest TNPSC Mentor, analyze this user's study performance.
        
SYLLABUS TOTAL: ${syllabus.length} Subjects
RECENT HISTORY (Last 14 days): ${JSON.stringify(history).substring(0, 20000)}

Analyze:
1. Syllabus coverage vs pace required for the exam date.
2. Patterns of time wastage (days missed, subjects skipped).
3. Identify exactly which subject is strongest and which is being dangerously neglected.
4. Provide a "Blunt Conclusion": A direct, no-excuses assessment of their current clearance probability. If they are failing, say it. If they are lazy, call it out.

Return ONLY a JSON object with keys:
"coverageVsRequired": string (e.g. "15% behind scheduled pace"),
"timeWastagePatterns": string (e.g. "Frequent 2-day gaps observed after Sundays"),
"strongestArea": string,
"weakestArea": string,
"bluntConclusion": string (The direct feedback)

Language: ${lang === 'ta' ? 'Tamil' : 'English'}.`;

        const { text: responseText } = await generateAIResponse("gemini-1.5-pro-latest", prompt, true); // Use Pro for deep analysis
        const report = cleanAndParseJSON(responseText);
        res.json({ success: true, data: { ...report, generatedAt: new Date().toISOString() } });
    } catch (error) {
        console.error("[ERROR] Mentor Report Failed:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/admin/subscribers', (req, res) => {
    try {
        const users = getAllUsers();
        // Also check for legacy users who might have states but aren't in users.json yet
        const files = fs.readdirSync(STATE_DIR);
        files.forEach(file => {
            try {
                const emailBase64 = file.replace('.json', '');
                const email = Buffer.from(emailBase64, 'base64').toString('utf8');
                if (!users.find(u => u.email === email)) {
                    const data = JSON.parse(fs.readFileSync(path.join(STATE_DIR, file), 'utf8'));
                    const userObj = data.user || {
                        fullName: 'Legacy User',
                        email: email,
                        subscriptionStatus: 'trial'
                    };
                    users.push(userObj);
                }
            } catch (err) { }
        });
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

// AI Question Factory (Background Worker)
let factoryState = {
    isProcessing: false,
    syllabusId: null,
    queue: [],
    completed: 0,
    total: 0,
    currentTopic: null
};

app.post('/api/admin/start-generation', async (req, res) => {
    const { id } = req.body;
    if (factoryState.isProcessing) return res.status(400).json({ success: false, error: "A generation is already in progress." });

    const filePath = path.join(__dirname, 'data', 'syllabuses', `${id}.txt`);
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, error: "Syllabus not found" });

    const text = fs.readFileSync(filePath, 'utf8');
    console.log(`[Factory] Starting for: ${id}`);

    try {
        // Step 1: Extract flat list of topics to generate for
        const extractPrompt = `Extract a flat list of all specific study topics from this syllabus text. 
        Return ONLY a JSON array of strings. Example: ["Harappan Civilization", "Vedic Age", ...].
        Syllabus: ${text.substring(0, 5000)}`;

        const { text: responseText } = await generateAIResponse("gemini-2.0-flash", extractPrompt, true);
        const topics = cleanAndParseJSON(responseText);

        factoryState = {
            isProcessing: true,
            syllabusId: id,
            queue: topics,
            completed: 0,
            total: topics.length,
            currentTopic: null
        };

        // Start background process
        processFactoryQueue();

        res.json({ success: true, count: topics.length });
    } catch (error) {
        console.error("[Factory Error]", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/admin/generation-status', (req, res) => {
    res.json({ success: true, data: factoryState });
});

async function processFactoryQueue() {
    if (!factoryState.isProcessing || factoryState.queue.length === 0) {
        console.log("[Factory] Done.");
        factoryState.isProcessing = false;
        return;
    }

    const topic = factoryState.queue.shift();
    factoryState.currentTopic = topic;
    console.log(`[Factory] Generating for: ${topic} (${factoryState.completed + 1}/${factoryState.total})`);

    try {
        // Check if already in bank to save tokens
        let quizBank = {};
        if (fs.existsSync(QUIZ_BANK_PATH)) {
            quizBank = JSON.parse(fs.readFileSync(QUIZ_BANK_PATH, 'utf8'));
        }

        const cacheKey = `MASTER_${topic.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

        if (!quizBank[cacheKey]) {
            const prompt = `As a Competitive Exam Expert, generate a formal High-Difficulty Quiz (10 MCQs) for the topic: "${topic}".
            Requirements: 10 MCQs, standard Options (A, B, C, D), Correct Answer, Detailed Explanation.
            Return EXCLUSIVELY JSON array: [{question, options, correctAnswer, explanation}].`;

            const { text: responseText } = await generateAIResponse("gemini-2.0-flash", prompt, true, true);
            const questions = cleanAndParseJSON(responseText);

            quizBank[cacheKey] = questions;
            fs.writeFileSync(QUIZ_BANK_PATH, JSON.stringify(quizBank, null, 2));
            console.log(`   [Factory] Saved ${questions.length} questions.`);
        } else {
            console.log(`   [Factory] Topic already exists in bank. Skipping AI call.`);
        }

        factoryState.completed++;
    } catch (e) {
        console.error(`   [Factory] Failed topic ${topic}:`, e.message);
        // Put back in queue if it's a transient failure? No, skip for now to avoid loops, or use retry logic.
    }

    // Wait 20 seconds before next topic to be VERY safe with API limits
    setTimeout(processFactoryQueue, 20000);
}

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Self-ping to keep Render awake
const https = require('https');
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL;
if (RENDER_EXTERNAL_URL) {
    setInterval(() => {
        https.get(`${RENDER_EXTERNAL_URL}/health`, (res) => {
            console.log(`[Self-Ping] Status: ${res.statusCode}`);
        }).on('error', (err) => {
            console.error('[Self-Ping] Error:', err.message);
        });
    }, 14 * 60 * 1000); // 14 minutes
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`[Ready] Vetri Pathai Backend running on port ${PORT}`);
    syncCurrentAffairs('en');
    syncCurrentAffairs('ta');
});
