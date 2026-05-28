import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export const EMBEDDING_MODEL = "text-embedding-3-small";

export async function createEmbedding(input: string) {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input,
  });

  return response.data[0].embedding;
}

export async function generateSummaryAndKeywords(transcript: string) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "Du bist ein präziser Content-Analyst. Antworte ausschließlich als valides JSON.",
      },
      {
        role: "user",
        content: `Analysiere dieses deutschsprachige Kurzvideo-Transkript und gib JSON zurück mit summary:string und keywords:string[].\n\nTranskript:\n${transcript}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0].message.content || "{}";
  return JSON.parse(content) as { summary?: string; keywords?: string[] };
}
