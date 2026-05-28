import { NextRequest } from "next/server";

export function assertAdmin(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.ADMIN_SECRET}`) {
    throw new Error("Unauthorized");
  }
}

export function assertCron(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    throw new Error("Unauthorized");
  }
}
