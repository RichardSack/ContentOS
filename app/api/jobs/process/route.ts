import { NextRequest, NextResponse } from "next/server";
import { claimPendingJobs } from "@/lib/jobs/queue";
import { runJob } from "@/lib/jobs/handlers";
import { assertCron } from "@/lib/auth/admin";

export async function POST(req: NextRequest) {
  try {
    assertCron(req);
    const jobs = await claimPendingJobs(5);
    await Promise.all(jobs.map(runJob));
    return NextResponse.json({ processed: jobs.length });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      {
        status: error.message === "Unauthorized" ? 401 : 500,
      }
    );
  }
}
