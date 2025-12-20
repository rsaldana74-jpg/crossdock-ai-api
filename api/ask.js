export default async function handler(req, res) {
  try {
    // Only allow POST
    if (req.method !== "POST") {
      return res.status(405).json({ error: "POST only" });
    }

    // Read body safely
    const { question } = req.body || {};
    if (!question) {
      return res.status(400).json({ error: "Missing question" });
    }

    // Check API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "OPENAI_API_KEY not set" });
    }

    // Call OpenAI Responses API
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content:
              "You are Crossdock AI, an expert logistics assistant for a Mexican 3PL. Answer clearly and practically about trucking, rail, intermodal freight, warehousing, US–Mexico cross-border logistics, Incoterms, customs documents, and freight basics."
          },
          {
            role: "user",
            content: question
          }
        ],
        max_output_tokens: 300
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        error: "OpenAI error",
        details: data
      });
    }

    // Extract text safely
    const answer =
      data.output_text ||
      data.output?.[0]?.content?.[0]?.text ||
      "No response generated.";

    return res.status(200).json({ answer });

  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      details: String(err)
    });
  }
}