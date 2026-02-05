# Vetri Pathai - Backend API

Node.js/Express backend for Vetri Pathai TNPSC exam preparation app.

## 🚀 Features

- Secure Gemini AI integration
- Progressive schedule generation
- Adaptive learning based on user progress
- Current affairs with grounding
- Mock test generation

## 📋 Prerequisites

- Node.js 18+ 
- Google Gemini API key

## 🛠️ Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Create `.env` file**:
   ```bash
   GEMINI_API_KEY=your_api_key_here
   PORT=5000
   ```

3. **Start server**:
   ```bash
   npm start
   ```

Server will run on `http://localhost:5000`

## 🌐 API Endpoints

- `POST /api/extract-syllabus` - Extract syllabus from text
- `POST /api/generate-schedule` - Generate adaptive study schedule
- `GET /api/current-affairs` - Fetch TNPSC news
- `POST /api/practice-question` - Generate practice questions
- `POST /api/mock-test` - Generate mock tests
- `GET /api/motivation` - Get motivational quotes
- `POST /api/parse-schedule` - Parse manual schedules
- `GET /health` - Health check

## 🚢 Deployment (Render)

1. Push to GitHub
2. Create new Web Service on Render
3. Connect repository
4. Set environment variables:
   - `GEMINI_API_KEY`
   - `PORT` (optional, defaults to 5000)
5. Deploy!

## 📝 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini API key | Yes |
| `PORT` | Server port | No (default: 5000) |

## 🔒 Security

- API keys stored server-side only
- CORS configured for frontend
- No sensitive data in logs
- `.env` excluded from git

## 📄 License

MIT
