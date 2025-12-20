export default async function handler(req, res) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "OPENAI_API_KEY not set in Vercel"
      });
    }

    // -------- GET SUPPORT (Browser / Demo) --------
    if (req.method === "GET") {
      const question = req.query.question;

      if (!question) {
        return res.status(200).json({
          status: "ok",
          message: "Crossdock AI is running",
          usage: "Use ?question=Your+question or POST with JSON body",
          example: "/api/ask?question=What+is+intermodal+freight"
        });
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
                "You are Crossdock AI, an expert logistics assistant for a Mexican 3PL. Answer clearly and practically about trucking, rail, intermodal freight, warehousing, and US–Mexico cross-border logistics."
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
          error: "OpenAI error",
          details: data
        });
      }

      return res.status(200).json({
        question,
        answer: data.choices[0].message.content
      });
    }

    // -------- POST SUPPORT (UI / ReqBin / Apps) --------
    if (req.method === "POST") {
      const { question } = req.body || {};

      if (!question) {
        return res.status(400).json({
          error: "Missing question"
        });
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
                "You are Crossdock AI, an expert logistics assistant for a Mexican 3PL. Answer clearly and practically about trucking, rail, intermodal freight, warehousing, and US–Mexico cross-border logistics."
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
          error: "OpenAI error",
          details: data
        });
      }

      return res.status(200).json({
        answer: data.choices[0].message.content
      });
    }

    // -------- BLOCK EVERYTHING ELSE --------
    return res.status(405).json({
      error: "Method not allowed"
    });

  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      details: String(err)
    });
  }
}