// Write a new MNN article with Claude and drop it in content/articles/.
//
//   node tools/write-article.mjs --topic "chewing ice" --advice "mention it to your doctor; it can be low iron"
//   node tools/write-article.mjs --topic "..." --advice "..." --audience dad --category "Dad Desk"
//   node tools/write-article.mjs --batch content/queue.json      # [{topic, advice, audience?, category?}, ...]
//   add --dry-run to print the brief instead of calling the API
//
// Needs ANTHROPIC_API_KEY (or an `ant auth login` profile). Model: MNN_MODEL env, default claude-opus-5-5.
// The guardrails live in the system prompt below. They are the point of the site; don't loosen them.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = JSON.parse(fs.readFileSync(path.join(ROOT, "content/site.json"), "utf8"));
const ARTICLES = path.join(ROOT, "content/articles");
const MODEL = process.env.MNN_MODEL || "claude-opus-5-5";

const STYLE_GUIDE = `You write for ${site.longName} (${site.name}), a site that looks and sounds exactly like the clickbait health sites a mom reads on her phone, except every article's actual content is sensible, generic, doctor-approved advice. The joke is that the breathless headline always resolves into "listen to your doctor" or "listen to your kids" or "drink some water." Readers should feel teased, then reassured, and should never be able to find a false claim.

VOICE
- Headline in full clickbait register: "Doctors HATE...", "You Won't BELIEVE...", "Experts STUNNED", "This One Weird Trick", "What Happened Next", numbered reveals, a capitalized word for emphasis. The headline promises a secret; the secret is always ordinary good advice.
- A deck (subtitle) that twists the knife a little further.
- Body of 300 to 450 words. Short paragraphs. Numbered sections with "## " headings ("## 1. ...", "## The part nobody tells you"). One pull quote as a "> " blockquote. Occasionally a numbered list. Dry, warm, a bit silly. The turn from tease to sensible advice should be the funniest moment of the piece.
- End on a small nudge toward the one action.

HARD RULES (these are the whole reason the site exists)
- Never invent a study, a statistic, a percentage, a doctor, an expert, an institution, or a quote from a named person. No "a Harvard study found". No "Dr. so-and-so says". Attribute only to "your doctor", "nurses", "dentists", "the kids", "every doctor who has ever been asked".
- Only well-established, pharmacy-pamphlet-level health facts: the kind no doctor would argue with. Hedge appropriately ("can be a sign of", "is often", "tends to").
- No specific doses, no product recommendations, no supplement regimes, no "cures", no diet rules, no claims that something prevents or treats a disease.
- The advice must always defer to the reader's own doctor. Never tell the reader to stop or start a medication; tell them to talk to the doctor about it.
- Nothing scary. The reader is someone's mother. Tease, don't frighten. No death statistics, no "silent killer" framing.
- No real brand names, companies, websites, or people. No mention of the reader's family by name, and no inside jokes.
- No emojis in the text. Plain prose. Use **bold** sparingly for the reveal.

OUTPUT
Return JSON matching the schema: title, deck, category (one of: ${site.categories.join(", ")}), hero_emoji (a single emoji that fits the topic), body_markdown (the article, using only paragraphs, "## " headings, "> " blockquotes, "- " or "1. " lists, **bold**, *italic*), advice (one or two plain sentences, the Bottom Line box: the actual, boring, correct advice), tags (3 to 5 short lowercase tags).`;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "deck", "category", "hero_emoji", "body_markdown", "advice", "tags"],
  properties: {
    title: { type: "string" },
    deck: { type: "string" },
    category: { type: "string", enum: site.categories },
    hero_emoji: { type: "string" },
    body_markdown: { type: "string" },
    advice: { type: "string" },
    tags: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 5 },
  },
};

const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const PALETTES = [["#c62828", "#ffcdd2"], ["#1565c0", "#bbdefb"], ["#2e7d32", "#c8e6c9"], ["#6a1b9a", "#e1bee7"], ["#ef6c00", "#ffe0b2"], ["#00695c", "#b2dfdb"], ["#ad1457", "#f8bbd0"], ["#37474f", "#cfd8dc"]];

function existingTitles() {
  return fs.readdirSync(ARTICLES).filter((f) => f.endsWith(".md")).map((f) => {
    const m = fs.readFileSync(path.join(ARTICLES, f), "utf8").match(/^title:\s*(.*)$/m);
    return m ? m[1] : f;
  });
}

async function writeOne(client, { topic, advice, audience = "mom", category }) {
  const brief = [
    `Topic: ${topic}`,
    `The actual advice the article must land on: ${advice}`,
    `Audience: ${audience === "dad" ? "a dad in his sixties; file it under Dad Desk" : audience === "all" ? "parents in general" : "a mom in her sixties"}`,
    category ? `Category: ${category}` : "",
    `Already published (do not repeat these angles or headlines):\n- ${existingTitles().join("\n- ")}`,
  ].filter(Boolean).join("\n");
  if (opts["dry-run"]) { console.log(`--- would send to ${MODEL} ---\n${brief}\n`); return null; }

  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema } },
    system: [{ type: "text", text: STYLE_GUIDE, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: brief }],
  });
  if (res.stop_reason === "refusal") throw new Error(`refused: ${res.stop_details?.explanation || "no explanation"}`);
  if (res.stop_reason === "max_tokens") throw new Error("ran out of tokens; the article is truncated");
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const a = JSON.parse(text);

  const slug = slugify(a.title);
  const file = path.join(ARTICLES, `${slug}.md`);
  if (fs.existsSync(file)) throw new Error(`already exists: ${file}`);
  const colors = PALETTES[Math.floor(Math.random() * PALETTES.length)];
  const date = new Date().toISOString().slice(0, 10);
  const md = `---
title: ${a.title.replace(/\s+/g, " ")}
deck: ${a.deck.replace(/\s+/g, " ")}
category: ${a.category}
date: ${date}
hero: ${a.hero_emoji}
colors: [${colors.join(", ")}]
advice: ${a.advice.replace(/\s+/g, " ")}
tags: [${a.tags.map(slugify).join(", ")}]
---
${a.body_markdown.trim()}
`;
  fs.writeFileSync(file, md);
  const served = res.usage?.iterations?.some((i) => i.type === "fallback_message") ? ` (served by ${res.model})` : "";
  console.log(`wrote content/articles/${slug}.md${served}`);
  return file;
}

function args() {
  const out = {};
  const av = process.argv.slice(2);
  for (let i = 0; i < av.length; i++) if (av[i].startsWith("--")) out[av[i].slice(2)] = av[i + 1] && !av[i + 1].startsWith("--") ? av[++i] : true;
  return out;
}

const opts = args();
const client = opts["dry-run"] ? null : new Anthropic();
const jobs = opts.batch ? JSON.parse(fs.readFileSync(path.resolve(opts.batch), "utf8")) : [opts];
let failed = 0;
for (const job of jobs) {
  if (!job.topic || !job.advice) { console.error("need --topic and --advice (or a --batch file of {topic, advice})"); process.exit(2); }
  try { await writeOne(client, job); }
  catch (e) { failed++; console.error(`FAILED "${job.topic}": ${e.message}`); }
}
process.exit(failed ? 1 : 0);
