// MNN static build. Zero dependencies.
//   content/site.json          site name, categories, ticker, footer
//   content/ads.json           the fake-but-realistic ads (fictional sponsors only)
//   content/articles/*.md      articles: YAML-ish frontmatter + a small markdown subset
//   assets/*                   copied verbatim into public/assets/
// Output: public/  (GitLab Pages serves this folder as-is)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public");
const site = JSON.parse(fs.readFileSync(path.join(ROOT, "content/site.json"), "utf8"));
const ads = JSON.parse(fs.readFileSync(path.join(ROOT, "content/ads.json"), "utf8"));

// ---------- content ----------
export function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error("missing frontmatter");
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.startsWith("[") && v.endsWith("]")) v = v.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    else v = v.replace(/^["']|["']$/g, "");
    meta[kv[1]] = v;
  }
  return { meta, body: m[2].trim() };
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
}

export function markdown(md) {
  const blocks = md.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return blocks.map((b) => {
    const lines = b.split("\n");
    if (/^### /.test(b)) return `<h3>${inline(b.slice(4))}</h3>`;
    if (/^## /.test(b)) return `<h2>${inline(b.slice(3))}</h2>`;
    if (b === "---") return "<hr>";
    if (lines.every((l) => /^> ?/.test(l))) return `<blockquote><p>${inline(lines.map((l) => l.replace(/^> ?/, "")).join(" "))}</p></blockquote>`;
    if (lines.every((l) => /^- /.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.slice(2))}</li>`).join("")}</ul>`;
    if (lines.every((l) => /^\d+\. /.test(l))) return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\d+\. /, ""))}</li>`).join("")}</ol>`;
    return `<p>${inline(lines.join(" "))}</p>`;
  }).join("\n");
}

function loadArticles() {
  const dir = path.join(ROOT, "content/articles");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  const out = [];
  for (const f of files) {
    const { meta, body } = parseFrontmatter(fs.readFileSync(path.join(dir, f), "utf8"));
    const slug = meta.slug || f.replace(/\.md$/, "");
    for (const k of ["title", "deck", "category", "date", "advice"]) if (!meta[k]) throw new Error(`${f}: missing ${k}`);
    if (!site.categories.includes(meta.category)) throw new Error(`${f}: unknown category ${meta.category}`);
    out.push({
      slug, ...meta, body,
      hero: meta.hero || "📰",
      colors: Array.isArray(meta.colors) ? meta.colors : ["#c62828", "#ffd180"],
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      url: `a/${slug}/`,
      words: body.split(/\s+/).length,
    });
  }
  out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return out;
}

// ---------- components ----------
// Every page is built with a `rel` prefix so the site works at any subpath (user.gitlab.io/mnn/).
const heroStyle = (c) => `style="--c1:${c[0]};--c2:${c[1]}"`;
const readTime = (a) => `${Math.max(1, Math.round(a.words / 180))} min read`;
const fmtDate = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

function card(a, rel, cls = "") {
  return `<a class="card ${cls}" href="${rel}${a.url}" data-slug="${a.slug}">
  <div class="thumb" ${heroStyle(a.colors)}><span>${a.hero}</span></div>
  <div class="card-body">
    <div class="kicker">${esc(a.category)}</div>
    <h3>${esc(a.title)}</h3>
    <p class="deck">${esc(a.deck)}</p>
    <div class="meta">${readTime(a)}</div>
  </div></a>`;
}

function adTile(ad, rel) {
  return `<a class="ad" href="${rel}offer/${ad.id}/" data-ad="${ad.id}">
  <div class="thumb" ${heroStyle(ad.colors)}><span>${ad.emoji}</span></div>
  <div class="ad-head">${esc(ad.headline)}</div>
  <div class="ad-sponsor">${esc(ad.sponsor)}</div></a>`;
}

function chumbox(rel, n = 4, label = "Around The Web") {
  return `<section class="chumbox" data-shuffle="ads"><div class="chum-label">${label} <span>Sponsored</span></div>
  <div class="chum-grid">${ads.slice(0, n).map((ad) => adTile(ad, rel)).join("")}</div></section>`;
}

function shell({ title, description, body, rel, extraHead = "" }) {
  const t = title ? `${title} | ${site.name}` : `${site.name}: ${site.longName}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t)}</title>
<meta name="description" content="${esc(description || site.tagline)}">
<meta property="og:title" content="${esc(title || site.longName)}">
<meta property="og:description" content="${esc(description || site.tagline)}">
<link rel="icon" href="${rel}assets/favicon.svg">
<link rel="stylesheet" href="${rel}assets/style.css">
${extraHead}
</head>
<body>
<header class="masthead">
  <a class="logo" href="${rel}"><span class="logo-box">${esc(site.name)}</span><span class="logo-text">${esc(site.longName)}</span></a>
  <nav class="nav">${site.categories.map((c) => `<a href="${rel}c/${slugify(c)}/">${esc(c)}</a>`).join("")}</nav>
</header>
<div class="ticker"><span class="ticker-tag">LIVE</span><div class="ticker-track"><span>${site.ticker.map(esc).join(" &nbsp;&nbsp;•&nbsp;&nbsp; ")}</span></div></div>
<main class="page">
${body}
</main>
<footer class="footer">
  <p>${esc(site.footer)}</p>
  <p>&copy; ${new Date().getFullYear()} ${esc(site.longName)}. Nothing here was written by a doctor. Everything here agrees with yours.</p>
</footer>
<script src="${rel}assets/app.js" defer></script>
</body>
</html>`;
}

function homePage(articles, rel = "") {
  const [top, ...rest] = articles;
  const trending = articles.slice(0, 5);
  const feed = rest.map((a) => card(a, rel)).join("");
  return shell({
    rel,
    body: `
<section class="hero-story">${card(top, rel, "card-hero")}</section>
<div class="layout">
  <section class="feed" data-shuffle="feed">${feed}</section>
  <aside class="sidebar">
    <div class="box"><h4>Trending Now</h4><ol class="trending">${trending.map((a) => `<li><a href="${rel}${a.url}">${esc(a.title)}</a></li>`).join("")}</ol></div>
    ${chumbox(rel, 4, "Recommended For You")}
  </aside>
</div>
${chumbox(rel, 8)}`,
  });
}

function categoryPage(cat, articles, rel = "../../") {
  const list = articles.filter((a) => a.category === cat);
  return shell({
    rel, title: cat, description: `${cat} stories from ${site.longName}`,
    body: `<h1 class="section-title">${esc(cat)}</h1>
<div class="layout"><section class="feed">${list.map((a) => card(a, rel)).join("") || "<p>Nothing here yet. Check back after you've had a glass of water.</p>"}</section>
<aside class="sidebar">${chumbox(rel, 4, "Recommended For You")}</aside></div>`,
  });
}

function articlePage(a, articles, rel = "../../") {
  const more = articles.filter((x) => x.slug !== a.slug).slice(0, 4);
  return shell({
    rel, title: a.title, description: a.deck,
    extraHead: `<meta property="og:type" content="article">`,
    body: `
<article class="article">
  <div class="kicker">${esc(a.category)}</div>
  <h1>${esc(a.title)}</h1>
  <p class="deck">${esc(a.deck)}</p>
  <div class="byline"><span>By <strong>MNN Staff</strong> &middot; Updated ${fmtDate(a.date)} &middot; ${readTime(a)}</span>
    <button class="share" data-share data-title="${esc(a.title)}">Share</button></div>
  <div class="hero" ${heroStyle(a.colors)}><span>${a.hero}</span></div>
  <div class="body">
    ${markdown(a.body)}
  </div>
  <aside class="bottom-line"><div class="bl-label">The Bottom Line</div><p>${inline(a.advice)}</p></aside>
  ${a.tags.length ? `<div class="tags">${a.tags.map((t) => `<span>#${esc(t)}</span>`).join("")}</div>` : ""}
</article>
${chumbox(rel, 4, "You Might Also Like")}
<section class="more"><h4>More From ${esc(site.name)}</h4><div class="feed">${more.map((x) => card(x, rel)).join("")}</div></section>`,
  });
}

function offerPage(ad, rel = "../../") {
  return shell({
    rel, title: "This offer has expired", description: ad.headline,
    body: `<article class="offer">
  <div class="hero" ${heroStyle(ad.colors)}><span>${ad.emoji}</span></div>
  <div class="kicker">${esc(ad.sponsor)}</div>
  <h1>${esc(ad.headline)}</h1>
  <p class="offer-body">${esc(ad.landing)}</p>
  <a class="btn" href="${rel}">Back to the news</a>
</article>`,
  });
}

// ---------- write ----------
function write(rel, html) {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, html);
}

export function build() {
  const articles = loadArticles();
  if (!articles.length) throw new Error("no articles");
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  fs.cpSync(path.join(ROOT, "assets"), path.join(OUT, "assets"), { recursive: true });

  write("index.html", homePage(articles));
  for (const a of articles) write(`${a.url}index.html`, articlePage(a, articles));
  for (const c of site.categories) write(`c/${slugify(c)}/index.html`, categoryPage(c, articles));
  for (const ad of ads) write(`offer/${ad.id}/index.html`, offerPage(ad));
  const base = site.basePath || "/";
  write("404.html", shell({ rel: base, title: "Page not found", body: `<article class="offer"><h1>This Page Is Gone</h1><p class="offer-body">Like the last of the good cookies. <a href="${base}">Back to the front page.</a></p></article>` }));
  write("feed.json", JSON.stringify({
    site: site.longName, generated: new Date().toISOString(),
    articles: articles.map(({ body, ...a }) => a),
  }, null, 2));
  console.log(`built ${articles.length} articles, ${site.categories.length} categories, ${ads.length} offers -> public/`);
  return articles;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) build();
