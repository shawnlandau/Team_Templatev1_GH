import { useState } from 'react';

function App() {
  const [resume, setResume] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [linkedIn, setLinkedIn] = useState('');
  const [output, setOutput] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await fetch('http://localhost:3001/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeText: resume, jobDesc, linkedInUrl: linkedIn }),
    });
    const data = await res.json();
    setOutput(data.output);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: 'auto' }}>
      <h2>AI Resume + STAR Generator</h2>
      <form onSubmit={handleSubmit}>
        <textarea
          placeholder="Paste your resume..."
          value={resume}
          onChange={(e) => setResume(e.target.value)}
          rows="10"
          style={{ width: '100%', marginBottom: '1rem' }}
        />
        <textarea
          placeholder="Paste job description..."
          value={jobDesc}
          onChange={(e) => setJobDesc(e.target.value)}
          rows="10"
          style={{ width: '100%', marginBottom: '1rem' }}
        />
        <input
          placeholder="LinkedIn URL of interviewer (optional)"
          value={linkedIn}
          onChange={(e) => setLinkedIn(e.target.value)}
          style={{ width: '100%', marginBottom: '1rem' }}
        />
        <button type="submit">Generate</button>
      </form>
      <pre style={{ whiteSpace: 'pre-wrap', marginTop: '2rem' }}>{output}</pre>
    </div>
  );
}

export default App;