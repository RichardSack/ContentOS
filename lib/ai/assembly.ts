import { AssemblyAI } from "assemblyai";

let _assemblyClient: AssemblyAI | null = null;

function getAssemblyClient(): AssemblyAI {
  if (_assemblyClient) return _assemblyClient;
  const key = process.env.ASSEMBLYAI_API_KEY;
  if (!key) {
    throw new Error("ASSEMBLYAI_API_KEY not set");
  }
  _assemblyClient = new AssemblyAI({ apiKey: key });
  return _assemblyClient;
}

export async function transcribeWithAssemblyAI(audioOrVideoUrl: string) {
  const transcript = await getAssemblyClient().transcripts.transcribe({
    audio: audioOrVideoUrl,
    language_code: "de",
    punctuate: true,
    format_text: true,
  });

  if (transcript.status === "error") {
    throw new Error(`AssemblyAI transcription failed: ${transcript.error}`);
  }

  return transcript.text || "";
}
