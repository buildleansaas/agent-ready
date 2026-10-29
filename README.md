# agent-ready

A Claude Code skill that makes your website agent-ready. It scores the site on [isitagentready.com](https://isitagentready.com) (Cloudflare's scanner) and adds Content Signals to your robots.txt.

Before (a typical robots.txt, and a real scan of a site without signals):

```
User-agent: *
Allow: /
```

```
$ node scripts/scan.mjs https://www.gnu.org
Level 1 "Basic Web Presence" (target 2: not met)
...
contentSignals       FAIL    No Content Signals found in robots.txt

Next: Level 2 "Bot-Aware" needs:
- contentSignals: Declare AI content usage preferences with Content Signals in robots.txt
```

After:

```
User-agent: *
Content-Signal: search=yes, ai-input=yes, ai-train=yes
Allow: /
```

```
$ node scripts/scan.mjs https://www.pedscalc.com
Level 2 "Bot-Aware" (target 2: met)
...
contentSignals       PASS    Content Signals found in robots.txt
```

## How to use it

Install the skill (below), open Claude Code in your site's repo, and ask:

- "Is my site agent ready?"
- "Add content signals to robots.txt"
- "Let AI tools cite my site"

The skill then:

1. Scans the site and shows what's missing.
2. Explains the three signals and asks you to pick:
   - `search`: show my pages in search results
   - `ai-input`: let AI tools use my pages to answer questions and cite them
   - `ai-train`: let AI companies train on my content
3. Finds how your robots.txt is made: a static file, Next.js `robots.ts` or a route handler, WordPress, Shopify, Wix, Webflow, or Cloudflare's managed robots.txt.
4. Adds the line to every group in robots.txt and changes nothing else.
5. Proves it locally (one signal per group, nothing else in the file changed), then after deploy proves it live and rescans.

You can also run the scanner on its own from this folder (`~/.claude/skills/agent-ready` if you installed it there). It needs Node 18 or later and has no dependencies:

```sh
node scripts/scan.mjs https://your-site.com                 # exit 0 if Level 2 or higher, 1 if lower, 2 on error
node scripts/scan.mjs https://your-site.com --preset all    # every check, not just the ones a content site needs
node scripts/scan.mjs https://your-site.com --target 1 --json
```

## Why

robots.txt is the plain text file that tells crawlers (programs like Googlebot or GPTBot that download pages) what they may fetch. It has never said what they may *do* with what they fetch. Content Signals ([contentsignals.org](https://contentsignals.org)) add one line for that: may you index me for search, use me in AI answers, train on me.

For most sites that already have a robots.txt and a sitemap, that one line is the only thing between Level 1 and Level 2 on Cloudflare's scanner. We added it to six of our sites in an afternoon. Under the robots.txt standard (RFC 9309), an extra line like this must not interfere with the rules around it, so it doesn't change how anything else crawls you.

## What it won't do

- Pick your policy for you. `ai-train` especially is your call.
- Block crawlers or add `Disallow` rules.
- Chase the scanner's higher levels. Markdown for Agents gives agents your content without your ads. DNS-AID has no adoption yet. MCP, A2A, OAuth and commerce checks only matter if your site has an API or store for agents. [references/policy.md](references/policy.md) explains each.
- Open your site in a browser. It uses curl.

The scanner's score isn't the goal. Search and AI-answer traffic is.

## Install

Clone it into your Claude Code skills folder:

```sh
git clone https://github.com/buildleansaas/agent-ready ~/.claude/skills/agent-ready
```

Or for one project only: clone it into `.claude/skills/agent-ready` inside that repo.

## What's inside

- [`SKILL.md`](SKILL.md): the steps Claude follows.
- [`scripts/scan.mjs`](scripts/scan.mjs): the scanner client.
- [`references/fixes.md`](references/fixes.md): copy-paste fixes for each platform.
- [`references/policy.md`](references/policy.md): the three signals in plain words, and what to skip.

## Develop

```sh
npm test         # scanner tests on saved real responses, no network
npm run check    # tests + the CLI's help
```

Found a platform the fixes don't cover, or a scanner response the script misreads? [Open an issue](https://github.com/buildleansaas/agent-ready/issues) with the site URL and what you saw.

## Buy me a beer

agent-ready is free and stays free. If it saved you some hassle: [🍺 buy me a beer](https://donate.stripe.com/8x26oJ0iKdq0bLq8QS2VG06).

Want this checked on every site, every week? ScaleSleek is coming soon: https://www.scalesleek.com

MIT licensed. Built by [Build Lean SaaS](https://vibehowto.com/projects/robots-txt-for-ai).
