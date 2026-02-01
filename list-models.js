
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const api_key = process.env.GEMINI_API_KEY || process.env.API_KEY;
const genAI = new GoogleGenerativeAI(api_key);

async function listModels() {
    try {
        // List models is not directly available in the simplified SDK sometimes
        // But we can try to fetch it via the underlying client
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${api_key}`);
        const data = await response.json();
        console.log("Available Models:", JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
