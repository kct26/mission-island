// Ask CAPCOM: the AI tutor. Claude explains; the simulator (`evaluate`) decides every number.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
// Pure game engine (plain JS, shared with the browser).
import * as modelMod from "@/game/sim/model.js";
import * as dataMod from "@/game/sim/data.js";
import * as nasaMod from "@/game/sim/nasa.js";
// The engine is untyped JS for now (typed port is build step 2); treat it as `any` here.
const { evaluate, fmt } = modelMod as any;
const { SCENARIOS, DIFFICULTY, ORBITS, LAUNCHERS, PARTS, INSTRUMENTS, catsFor, FACTS } = dataMod as any;
const { MISSIONS, REAL_CASES, closestMissions } = nasaMod as any;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Design = Record<string, any>;
type Suggestion = { label: string; changes: Design };
export type CapcomReply = { text: string; tools: string[]; suggestions: Suggestion[]; mode: "ai" | "offline" };

const MODEL = "claude-opus-5-5";
const PART_KEYS = Object.keys(PARTS);
const INST_IDS = INSTRUMENTS.map((i: any) => i.id);

// ── Input validation ───────────────────────────────────────
const DesignSchema = z.object({
  scenario: z.enum(Object.keys(SCENARIOS) as [string, ...string[]]),
  difficulty: z.enum(Object.keys(DIFFICULTY) as [string, ...string[]]),
  orbit: z.string().nullable().optional(),
  lv: z.string().nullable().optional(),
  instruments: z.array(z.string()).max(INST_IDS.length),
  duty: z.number().min(20).max(100),
  grants: z.number().min(0).max(100).optional(),
}).catchall(z.unknown());

/** Keep only known option ids so nothing odd reaches the engine. */
export function cleanDesign(raw: unknown): Design {
  const d = DesignSchema.parse(raw) as Design;
  const out: Design = { scenario: d.scenario, difficulty: d.difficulty, duty: d.duty, grants: d.grants ?? 0,
    orbit: d.orbit && ORBITS[d.orbit] ? d.orbit : null, lv: d.lv && LAUNCHERS[d.lv] ? d.lv : null,
    instruments: [...new Set(d.instruments.filter((i: string) => INST_IDS.includes(i)))] };
  for (const k of PART_KEYS) {
    const v = d[k];
    out[k] = typeof v === "string" && PARTS[k].options.some((o: any) => o.id === v) ? v : null;
  }
  return out;
}

function applyChanges(design: Design, changes: Design): Design {
  return cleanDesign({ ...design, ...changes, instruments: changes.instruments ?? design.instruments });
}

/** Compact, number-only summary of a design for the model. */
function summarize(m: any) {
  return {
    massKg: Math.round(m.mass.total), rocketCapacityKg: m.mass.lvCap, busLoadKg: Math.round(m.mass.payload), busLimitKg: m.mass.busCap,
    powerUsedW: Math.round(m.power.cons), powerAvgW: Math.round(m.power.genAvg), powerMarginPct: Math.round(m.power.margin * 100),
    batteryCoversShadowPct: Math.round(m.power.battFrac * 100),
    dataMadeGbPerDay: +fmt(m.data.gen), dataSentGbPerDay: +fmt(m.data.down), downlinkPct: Math.round(m.data.ratio * 100),
    costM: Math.round(m.cost.total), budgetM: m.cost.budget, reserveM: Math.round(m.cost.reserve),
    scienceEstimate: +fmt(m.science.est), scienceGoal: m.science.goal, orbitFitPct: Math.round(m.science.fit * 100),
    launchBlockers: m.blocking.map((c: any) => c.label),
    warnings: m.checks.filter((c: any) => !c.ok && c.level !== "block").map((c: any) => c.label),
  };
}

const issueScore = (m: any) => m.blocking.length * 100 + m.checks.filter((c: any) => !c.ok).length * 10 - Math.min(m.science.est, m.science.goal * 1.3);

function changeLabel(changes: Design): string {
  return Object.entries(changes).map(([k, v]) => {
    if (k === "instruments") return `instruments: ${(v as string[]).map(id => INSTRUMENTS.find((i: any) => i.id === id)?.name ?? id).join(", ") || "none"}`;
    if (k === "orbit") return ORBITS[v as string]?.name ?? String(v);
    if (k === "lv") return LAUNCHERS[v as string]?.name ?? String(v);
    if (k === "duty") return `duty cycle ${v}%`;
    const opt = PARTS[k]?.options.find((o: any) => o.id === v);
    return opt ? `${PARTS[k].label}: ${opt.name}` : `${k}: ${v}`;
  }).join(" · ");
}

/** Try every single-part swap and keep the ones that help most. Used offline and to rank AI suggestions. */
export function bestSingleChanges(design: Design, limit = 3): { changes: Design; before: any; after: any }[] {
  const base = evaluate(design);
  const baseScore = issueScore(base);
  const tries: Design[] = [];
  for (const k of ["orbit", "lv", ...catsFor("hangar", design.scenario), ...catsFor("ground", design.scenario)]) {
    const opts = k === "orbit" ? Object.keys(ORBITS) : k === "lv" ? Object.keys(LAUNCHERS) : PARTS[k].options.map((o: any) => o.id);
    for (const v of opts) if (design[k] !== v) tries.push({ [k]: v });
  }
  for (const id of INST_IDS) {
    const has = design.instruments.includes(id);
    tries.push({ instruments: has ? design.instruments.filter((x: string) => x !== id) : [...design.instruments, id] });
  }
  return tries.map(changes => {
    const after = evaluate(applyChanges(design, changes));
    return { changes, before: base, after, gain: baseScore - issueScore(after) };
  }).filter(t => t.gain > 0 && keepsScience(t.before, t.after)).sort((a, b) => b.gain - a.gain)
    // one suggestion per system, so the player sees different ways to fix things
    .filter((t, i, all) => all.findIndex(u => Object.keys(u.changes)[0] === Object.keys(t.changes)[0]) === i)
    .slice(0, limit);
}

/** A fix must not abandon the mission: no change that cuts the science estimate by more than 10%. */
function keepsScience(before: any, after: any) {
  return after.science.est >= before.science.est * 0.9 - 1e-9;
}

// ── Offline CAPCOM (no API key, AI switched off, or AI error) ─────────
export function offlineAnswer(design: Design): CapcomReply {
  const m = evaluate(design);
  const s = summarize(m);
  const lines: string[] = [];
  if (s.launchBlockers.length) lines.push(`**${s.launchBlockers.length} thing(s) stop the launch:** ${s.launchBlockers.join("; ")}.`);
  if (s.warnings.length) lines.push(`**Warnings:** ${s.warnings.slice(0, 4).join("; ")}.`);
  if (!s.launchBlockers.length && !s.warnings.length) lines.push(`Your design passes every check. Science estimate ${s.scienceEstimate} vs goal ${s.scienceGoal}, with $${s.reserveM}M left in reserve.`);
  const best = bestSingleChanges(design);
  if (best.length) {
    lines.push("**Changes I tested in the simulator:**");
    for (const b of best) {
      const a = summarize(b.after);
      lines.push(`• ${changeLabel(b.changes)} → blockers ${s.launchBlockers.length}→${a.launchBlockers.length}, science ${s.scienceEstimate}→${a.scienceEstimate}, cost $${s.costM}M→$${a.costM}M`);
    }
  }
  return { text: lines.join("\n"), tools: ["get_metrics", "what_if × " + (best.length ? "all single swaps" : "0")], mode: "offline",
    suggestions: best.map(b => ({ label: changeLabel(b.changes), changes: b.changes })) };
}

// ── Claude-powered CAPCOM ────────────────────────────────────
const SYSTEM = `You are CAPCOM, the friendly mission controller in Mission Island, an educational space-mission design game for students around 12–16.
The player is designing a mission. You help them understand trade-offs (mass, power, budget, data, comms, time, science).

Rules:
- Every number you mention must come from a tool result in this conversation. Never estimate or invent numbers.
- Before recommending a change, test it with what_if and quote the before/after numbers.
- Explain WHY in plain words a 14-year-old understands. Short sentences. Under about 120 words unless asked for more.
- Only state NASA facts returned by lookup_fact or compare_missions.
- Suggest at most 2 changes. Never claim a change was applied: the player applies it with a button.
- Stay on space and engineering topics; politely steer anything else back to the mission.
- Use **bold** sparingly for key numbers. No headings, no tables.`;

export async function aiAnswer(design: Design, history: { role: "user" | "assistant"; text: string }[]): Promise<CapcomReply> {
  const used: string[] = [];
  const tested: { changes: Design; before: any; after: any }[] = [];

  const tools = [
    betaZodTool({
      name: "get_metrics",
      description: "Current design numbers from the mission simulator: mass, power, battery, data, downlink, cost, science estimate, launch blockers and warnings.",
      inputSchema: z.object({}),
      run: async () => { used.push("get_metrics"); return JSON.stringify(summarize(evaluate(design))); },
    }),
    betaZodTool({
      name: "what_if",
      description: `Test a change in the simulator without applying it. Returns before/after numbers. Keys: orbit (${Object.keys(ORBITS).join("|")}), lv (${Object.keys(LAUNCHERS).join("|")}), ${PART_KEYS.map(k => `${k} (${PARTS[k].options.map((o: any) => o.id).join("|")})`).join(", ")}, instruments (full list of ids: ${INST_IDS.join("|")}), duty (20-100).`,
      inputSchema: z.object({ changes: z.record(z.string(), z.union([z.string(), z.number(), z.array(z.string())])) }),
      run: async ({ changes }) => {
        used.push(`what_if ${changeLabel(changes)}`);
        const before = evaluate(design), after = evaluate(applyChanges(design, changes));
        tested.push({ changes, before, after });
        return JSON.stringify({ change: changeLabel(changes), before: summarize(before), after: summarize(after) });
      },
    }),
    betaZodTool({
      name: "explain_check",
      description: "Explain one design-review check (blocker or warning): the rule and why it matters. Pass words from its label.",
      inputSchema: z.object({ label: z.string() }),
      run: async ({ label }) => {
        used.push("explain_check");
        const c = evaluate(design).checks.find((x: any) => x.label.toLowerCase().includes(label.toLowerCase()));
        return c ? JSON.stringify({ label: c.label, passing: c.ok, level: c.level, why: c.why }) : "No check matches that label.";
      },
    }),
    betaZodTool({
      name: "compare_missions",
      description: "The real NASA missions most similar to the current design, with facts and lessons.",
      inputSchema: z.object({}),
      run: async () => {
        used.push("compare_missions");
        const m = evaluate(design);
        return JSON.stringify(closestMissions(design, m.mass.total).map(({ ms }: any) => ({ name: ms.name, year: ms.year, orbit: ms.orbitText, massKg: ms.mass, instruments: ms.instText, fact: ms.fact, lesson: ms.lesson })));
      },
    }),
    betaZodTool({
      name: "lookup_fact",
      description: "Search the game's NASA knowledge base (missions, real-world cases, space facts) for a topic.",
      inputSchema: z.object({ topic: z.string() }),
      run: async ({ topic }) => {
        used.push("lookup_fact");
        const q = topic.toLowerCase();
        const hits = [
          ...MISSIONS.filter((ms: any) => (ms.name + ms.fact + ms.instText).toLowerCase().includes(q)).map((ms: any) => `${ms.name} (${ms.year}): ${ms.fact}`),
          ...Object.values(REAL_CASES as Record<string, string>).filter(t => t.toLowerCase().includes(q)),
          ...(FACTS as string[]).filter(t => t.toLowerCase().includes(q)),
        ].slice(0, 5);
        return hits.length ? hits.join("\n") : "Nothing in the knowledge base on that topic.";
      },
    }),
  ];

  // Conversation: plain text turns; the current design goes with the latest question (after the cached prefix).
  const msgs = history.slice(-10).filter(h => h.text.trim());
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  const sc = SCENARIOS[design.scenario];
  const messages: Anthropic.Beta.BetaMessageParam[] = msgs.map((h, i) => ({
    role: h.role,
    content: i === msgs.length - 1 && h.role === "user"
      ? `Mission: ${sc.name} (goal: science ${sc.goal}, ${sc.years} years). Current design ids: ${JSON.stringify(design)}\n\nPlayer question: ${h.text}`
      : h.text,
  }));

  const client = new Anthropic();
  const final = await client.beta.messages.toolRunner({
    model: MODEL,
    max_tokens: 4000,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { effort: "low" },
    // If the model declines, the API retries on a fallback model chosen by refusal category.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    tools,
    messages,
    max_iterations: 8,
  } as any);

  if (final.stop_reason === "refusal") return { ...offlineAnswer(design), text: "I can only help with the mission design. Here is what the simulator says:\n" + offlineAnswer(design).text };
  const text = final.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();

  // Offer only tested changes that really improve the design.
  const suggestions = tested
    .filter(t => issueScore(t.after) < issueScore(t.before) && keepsScience(t.before, t.after))
    .slice(-2)
    .map(t => ({ label: changeLabel(t.changes), changes: t.changes }));
  return { text: text || offlineAnswer(design).text, tools: [...new Set(used)], suggestions, mode: "ai" };
}
