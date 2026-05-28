import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/auth/admin";
import { validateUpload } from "@/lib/upload/validate";
import { processUpload } from "@/lib/upload/service";

export async function POST(req: NextRequest) {
  try {
    assertAdmin(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();

  const file = formData.get("file") as File | null;
  const title = String(formData.get("title") || "");
  const description = String(formData.get("description") || "");
  const caption = String(formData.get("caption") || "");
  const scheduledAtRaw = String(formData.get("scheduledAt") || "");
  const platformIdsRaw = formData.getAll("platformId") as string[];
  const platformIds = platformIdsRaw.length > 0 ? platformIdsRaw : ["tiktok"];

  if (!file) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const validation = validateUpload(file);
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.error },
      { status: validation.status }
    );
  }

  let scheduledAt: string | null = null;
  if (scheduledAtRaw) {
    const d = new Date(scheduledAtRaw);
    if (isNaN(d.getTime())) {
      return NextResponse.json(
        { error: "Invalid scheduledAt" },
        { status: 400 }
      );
    }
    scheduledAt = d.toISOString();
  }

  try {
    const result = await processUpload(file, {
      title,
      description,
      caption,
      scheduledAt,
      platformIds,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Upload failed" },
      { status: 500 }
    );
  }
}
