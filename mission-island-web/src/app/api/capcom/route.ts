// POST /api/capcom — Ask CAPCOM. Validates input, rate-limits, then answers with Claude
// (tools call the simulator) or, without a key / on error, with the offline simulator answer.
import { NextResponse } from "next/server";
import { z } from "zod";
import { aiAnswer, cleanDesign, offlineAnswer } from "@/game/server/capcom";

export const maxDuration = 60;

const Body = z.object({
  design: z.unknown(),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(2000) })).min(1).max(20),
});

// Simple per-IP limit for the prototype. Production: Upstash Redis (shared across instances).
const hits = new Map<string, number[]>();
const LIMIT = 20, WINDOW_MS = 10 * 60 * 1000;
function limited(ip: string) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter(t => now - t < WINDOW_MS);
  list.push(now); hits.set(ip, list);
  return list.length > LIMIT;
}

export async function POST(req: Request) {
  let body: z.infer<typeof Body>, design;
  try {
    body = Body.parse(await req.json());
    design = cleanDesign(body.design);
  } catch {
    return NextResponse.json({ error: "That request didn't look like a mission design." }, { status: 400 });
  }

  const mode = process.env.AI_MODE ?? "live";
  const hasKey = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

  if (mode !== "live" || !hasKey || limited(ip)) return NextResponse.json(offlineAnswer(design));

  try {
    return NextResponse.json(await aiAnswer(design, body.messages));
  } catch (err) {
    console.error("CAPCOM AI error:", err instanceof Error ? err.message : err);
    const off = offlineAnswer(design);
    return NextResponse.json({ ...off, text: "My AI link is down right now, so here is the simulator's answer:\n" + off.text });
  }
}
