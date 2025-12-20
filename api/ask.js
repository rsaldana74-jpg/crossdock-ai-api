export const config = {
  runtime: "edge" // faster + streaming support
};

const MAX_QUESTION_LEN = 4000;
const MAX_HISTORY_MESSAGES = 12;

/**
 * Simple in-memory rate limit (per edge instance)
 * Not perfect, but protects you cheaply
 */
const rateBucket = new Map();
const RATE_LIMIT = 30; // requests
const RATE_WINDOW = 60_000; // 1 min

function rateLimit(ip) {
  const now = Date.now();
  const bucket = rateBucket.get(ip) || [];
  const recent = bucket.filter(t => now - t < RATE_WINDOW);
  recent.push(now);
  rateBucket.set(ip, recent);
  return recent.length <= RATE_LIMIT;
}

function cors(res) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req) {
  const res = new Response();
  cors(res);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: res.headers });
  }

  const ip =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";

  if (!rateLimit(ip)) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded" }),
      { status: 429, headers: res.headers }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
      { status: 500, headers: res.headers }
    );
  }

  let question, language = "en", history = [], stream = false;

  try {
    if (req.method === "POST") {
      const body = await req.json();
      question = body.question;
      language = body.language || "en";
      history = Array.isArray(body.history) ? body.history : [];
      stream = Boolean(body.stream);
    } else if (req.method === "GET") {
      const url = new URL(req.url);
      question = url.searchParams.get("question");
      language = url.searchParams.get("language") || "en";
    } else {
      return new Response(
        JSON.stringify({ error: "Use GET or POST" }),
        { status: 405, headers: res.headers }
      );
    }
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: res.headers }
    );
  }

  if (!question || typeof question !== "string") {
    return new Response(
      JSON.stringify({ error: "Missing question" }),
      { status: 400, headers: res.headers }
    );
  }

  if (question.length > MAX_QUESTION_LEN) {
    return new Response(
      JSON.stringify({ error: "Question too long" }),
      { status: 413, headers: res.headers }
    );
  }

  // Limit history size
  history = history.slice(-MAX_HISTORY_MESSAGES).filter(m =>
    m && typeof m.content === "string"
  );

  // ---- CROSSDOCK SYSTEM BRAIN ----
  const systemPrompt = `
You are Crossdock AI, a senior logistics advisor for a Mexican 3PL.

Expertise:
- Truckload, LTL, intermodal rail (53', boxcars)
- Cross-border US–Mexico operations
- Steel, automotive, industrial commodities
- Cost-per-pound optimization
- Transit times, lanes, routing, claims prevention

Rules:
- Be precise and practical
- Use real logistics terminology
- State assumptions when giving estimates
- Never hallucinate rates or transit times
- Answer ONLY in language: ${language}
`.trim();

  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: question }
  ];

  // ---- STREAMING MODE (OPTIONAL) ----
  if (stream) {
    const encoder = new TextEncoder();

    const openaiRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          stream: true,
          messages
        })
      }
    );

    if (!openaiRes.ok) {
      return new Response(
        JSON.stringify({ error: "OpenAI stream error" }),
        { status: 500, headers: res.headers }
      );
    }

    const streamBody = new ReadableStream({
      async start(controller) {
        const reader = openaiRes.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter(Boolean);

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.replace("data: ", "");
              if (data === "[DONE]") {
                controller.close();
                return;
              }
              try {
                const json = JSON.parse(data);
                const token = json.choices?.[0]?.delta?.content;
                if (token) {
                  controller.enqueue(encoder.encode(token));
                }
              } catch {}
            }
          }
        }
        controller.close();
      }
    });

    return new Response(streamBody, {
      headers: {
        ...Object.fromEntries(res.headers),
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache"
      }
    });
  }

  // ---- STANDARD RESPONSE ----
  const openaiRes = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages
      })
    }
  );

  const data = await openaiRes.json();

  if (!openaiRes.ok) {
    return new Response(
      JSON.stringify({
        error: "OpenAI error",
        details: data
      }),
      { status: 500, headers: res.headers }
    );
  }

  const answer = data?.choices?.[0]?.message?.content;
  if (!answer) {
    return new Response(
      JSON.stringify({ error: "Empty response from model" }),
      { status: 500, headers: res.headers }
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      answer,
      language,
      usage: data.usage || null
    }),
    { status: 200, headers: res.headers }
  );
}