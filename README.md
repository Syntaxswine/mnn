# MNN: Mom News Network

A news site that looks and sounds exactly like the clickbait health sites Mom reads on her phone, except every
article's secret ingredient is sensible advice. The headline promises a miracle; the miracle is always
"listen to your doctor", "listen to your kids", or "drink a glass of water". The ads are fake, the sponsors are
fictional, and every ad lands on a page that tells you the "offer" was water all along.

## Layout

```
content/site.json          name, tagline, categories, ticker lines, footer disclaimer
content/ads.json           the chumbox ads (fictional sponsors only; each has a landing-page punchline)
content/articles/*.md      one article per file: frontmatter + a small markdown subset
assets/                    style.css, app.js (shuffles the feed and ads on each load), favicon
tools/build.mjs            content/ -> public/   (zero dependencies)
tools/write-article.mjs    Claude writes a new article in house style -> content/articles/
tools/serve.mjs            local preview of public/
.gitlab-ci.yml             GitLab Pages deploy of public/
```

## Build and preview

```bash
node tools/build.mjs
node tools/serve.mjs        # http://127.0.0.1:4680/
```

## Writing a new article

```bash
npm install
node tools/write-article.mjs --topic "chewing ice" --advice "mention it to your doctor; constant ice craving can be a sign of low iron"
node tools/write-article.mjs --topic "skipping breakfast" --advice "..." --audience dad
node tools/write-article.mjs --batch content/queue.json     # [{"topic": ..., "advice": ..., "audience": "mom"|"dad"|"all"}]
```

Needs `ANTHROPIC_API_KEY` in the environment (or an `ant auth login` profile). `MNN_MODEL` overrides the model.
The generator writes a markdown file; nothing is published until it's committed and the Pages build runs.
Read the new article before committing it. The style guide in `tools/write-article.mjs` forbids invented
studies, named experts, statistics, doses and product recommendations, but a human still reads every piece.

## Article format

```
---
title: Doctors HATE This One Weird Trick (It's Called ...)
deck: One-line subtitle that twists the knife.
category: Health | Family | Doctors Hate This | Kitchen | Dad Desk
date: 2026-10-14
hero: 💊                     emoji used as the "photo"
colors: [#ad1457, #f8bbd0]   gradient behind the hero
advice: The actual, boring, correct advice. Shown in the Bottom Line box.
tags: [a, b, c]
---
Body in markdown: paragraphs, "## " headings, "> " pull quotes, "- " / "1. " lists, **bold**, *italic*.
```

## House rules

- Clickbait in the form, never in the facts. No invented studies, experts, statistics or quotes.
- Generic, not prescriptive. "Ask your doctor" is always the punchline; never tell a reader to start or stop a medication.
- Fictional sponsors only in the ads. Nothing clickable leads anywhere but the joke landing page.
- Nothing scary. The reader is someone's mom.
- The footer says, quietly, that none of this is medical advice. Real sites say the same thing.
