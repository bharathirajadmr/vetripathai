const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.API_KEY);

async function runTest(testName, fn) {
    console.log(`[TEST] ${testName}...`);
    try {
        await fn();
        console.log(`[PASS] ${testName}\n`);
    } catch (e) {
        console.error(`[FAIL] ${testName}: ${e.message}\n`);
    }
}

async function diagnostic() {
    console.log("--- Gemini Diagnostic Start ---\n");

    const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

    for (const m of models) {
        await runTest(`Model availability: ${m}`, async () => {
            const model = genAI.getGenerativeModel({ model: m });
            const result = await model.generateContent("Hi");
            console.log(`   Response: ${result.response.text().trim()}`);
        });
    }

    await runTest("JSON Mode on 2.0-flash", async () => {
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            generationConfig: { responseMimeType: "application/json" }
        });
        const result = await model.generateContent("Return JSON { 'test': true }");
        console.log(`   Response: ${result.response.text().trim()}`);
    });

    await runTest("Large Payload on 2.0-flash", async () => {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const largeText = "A".repeat(15000);
        const result = await model.generateContent(`Say OK and nothing else for this: ${largeText}`);
        console.log(`   Response: ${result.response.text().trim()}`);
    });

    console.log("--- Gemini Diagnostic End ---");
}

diagnostic().catch(e => console.error("FATAL:", e));
