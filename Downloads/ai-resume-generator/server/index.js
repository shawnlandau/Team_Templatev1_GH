const express = require('express');
const cors = require('cors');
const { Configuration, OpenAIApi } = require('openai');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAIApi(new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
}));

app.post('/api/generate', async (req, res) => {
  const { resumeText, jobDesc, linkedInUrl } = req.body;

  const prompt = `
Rewrite this resume to align with the job description using ATS keywords.
Then, generate 2 STAR interview answers and 3 tailored questions for the interviewer.

Resume: ${resumeText}
Job Description: ${jobDesc}
Interviewer LinkedIn URL: ${linkedInUrl || "N/A"}
`;

  try {
    const completion = await openai.createChatCompletion({
      model: "gpt-4-turbo",
      messages: [{ role: "user", content: prompt }],
    });
    res.json({ output: completion.data.choices[0].message.content });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

app.listen(3001, () => console.log("Server listening on http://localhost:3001"));