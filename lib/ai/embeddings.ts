import OpenAI from "openai";

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (_openai) return _openai;
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY not set");
  }
  _openai = new OpenAI({ apiKey: key });
  return _openai;
}

export const EMBEDDING_MODEL = "text-embedding-3-small";

export async function createEmbedding(input: string) {
  const response = await getOpenAI().embeddings.create({
    model: EMBEDDING_MODEL,
    input,
  });

  return response.data[0].embedding;
}

export async function generateSummaryAndKeywords(text: string) {
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Du bist ein deutscher Content-Editor. Erstelle eine kurze Zusammenfassung (max 200 Wörter) und 5-10 Keywords für ein Video. Antworte NUR im JSON-Format: {\"summary\":\"...\",\"keywords\":[\"...\",\"...\"]}.",
      },
      { role: "user", content: text },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0].message.content || "{}";
  return JSON.parse(content) as { summary: string; keywords: string[] };
}
