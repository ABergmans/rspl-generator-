export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY is niet ingesteld in Vercel Environment Variables." });
  }

  try {
    const { system, messages, max_tokens } = req.body;

    // Bouw parts op vanuit messages
    const parts = [];

    if (system) {
      parts.push({ text: "INSTRUCTIES:\n" + system + "\n\n" });
    }

    for (const msg of (messages || [])) {
      if (typeof msg.content === "string") {
        parts.push({ text: msg.content });
      } else if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === "text") {
            parts.push({ text: block.text });
          } else if (block.type === "document" && block.source?.type === "base64") {
            parts.push({
              inlineData: {
                mimeType: block.source.media_type || "application/pdf",
                data: block.source.data,
              },
            });
          }
        }
      }
    }

    const geminiBody = {
      contents: [{ role: "user", parts }],
      generationConfig: {
        maxOutputTokens: max_tokens || 4000,
        temperature: 0.2,
      },
    };

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiBody),
      }
    );

    const geminiData = await geminiRes.json();

    if (!geminiRes.ok) {
      const msg = geminiData?.error?.message || JSON.stringify(geminiData);
      return res.status(geminiRes.status).json({ error: msg });
    }

    const text = geminiData.candidates?.[0]?.content?.parts
      ?.map(p => p.text || "")
      .join("") || "";

    return res.status(200).json({
      content: [{ type: "text", text }]
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
