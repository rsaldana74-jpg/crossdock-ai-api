import OpenAI from "openai";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "POST only" });
    }

    const { question } = req.body || {};
    if (!question) {
      return res.status(400).json({ error: "Missing question" });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "You are Crossdock AI, an expert logistics assistant for a Mexican 3PL. Answer clearly and practically about trucking, rail, intermodal, warehousing, cross-border US–Mexico shipping, Incoterms, customs documents, and freight pricing basics. If unsure, ask 1 clarifying question."
        },
        { role: "user", content: question }
      ],
      max_output_tokens: 250
    });

    return res.status(200).json({ answer: response.output_text });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "AI error" });
  }
}