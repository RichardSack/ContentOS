import { AssemblyAI } from "assemblyai";

export const assemblyClient = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY!,
});

export async function transcribeWithAssemblyAI(audioOrVideoUrl: string) {
  const transcript = await assemblyClient.transcripts.transcribe({
    audio: audioOrVideoUrl,
    language_code: "de",
    punctuate: true,
    format_text: true,
  });

  if (transcript.status === "error") {
    throw new Error(transcript.error || "AssemblyAI transcription failed");
  }

  return transcript.text || "";
}
