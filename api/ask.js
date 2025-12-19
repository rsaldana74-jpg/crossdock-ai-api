export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { question } = req.body || {};

    if (!question) {
      return res.status(400).json({ error: 'Missing question' });
    }

    // TEMP response (no OpenAI yet)
    return res.status(200).json({
      answer: `Crossdock AI received: ${question}`
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}