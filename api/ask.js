export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "POST only" });
    }

    const { question } = req.body || {};
    if (!question) {
      return res.status(400).json({ error: "Missing question" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "OPENAI_API_KEY not set" });
    }

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are Crossdock AI, an expert logistics assistant for a Mexican 3PL. Answer clearly about trucking, rail, intermodal freight, warehousing, US–Mexico cross-border logistics, Incoterms, and customs documents."
          },
          {
            role: "user",
            content: question
          }
        ],
        temperature: 0.2
      })
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(500).json({
        error: "OpenAI API error",
        details: data
      });
    }

    return res.status(200).json({
      answer: data.choices[0].message.content
    });

  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      details: String(err)
    });
  }
}