import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { supabaseAdmin } from "@/lib/supabase/admin";

vi.mock("@/lib/auth/admin", () => ({
  assertAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

function makeReq(body: object): any {
  return new Request("http://localhost/api/admin/disconnect", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("disconnect route", () => {
  it("sets is_active=false for the account", async () => {
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    (supabaseAdmin.from as any).mockReturnValue({ update });

    const res = await POST(makeReq({ accountId: "acc-1" }));
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ is_active: false });
  });

  it("returns 400 if accountId missing", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 500 on DB error", async () => {
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: "db error" } }),
    });
    (supabaseAdmin.from as any).mockReturnValue({ update });

    const res = await POST(makeReq({ accountId: "x" }));
    expect(res.status).toBe(500);
  });
});
