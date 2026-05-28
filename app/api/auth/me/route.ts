import { NextRequest, NextResponse } from "next/server";
import { getUserWithRole } from "@/lib/auth/user";

export async function GET(req: NextRequest) {
  const user = await getUserWithRole(req);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.displayName,
  });
}
