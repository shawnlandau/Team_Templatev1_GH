# AI Resume + STAR Generator

This app takes a resume, job description, and optional LinkedIn profile and uses AI to:
- Rewrite the resume with ATS keywords
- Generate STAR interview answers
- Suggest questions for the interviewer

## Setup

### Backend
```
cd server
npm install
echo "OPENAI_API_KEY=your_api_key" > .env
node index.js
```

### Frontend
```
cd client
npm install
npm run dev
```