# Fixes by platform

Each fix does one thing: it adds a `Content-Signal:` line to every User-Agent group in robots.txt. Replace the example policy with the one the owner picked.

```
Content-Signal: search=yes, ai-input=yes, ai-train=yes
```

Platform details below were checked against each platform's own docs on 2026-10-29 (links given). Platforms change their settings pages. If a menu isn't where it says, look for your platform's robots.txt settings, and always check the live `/robots.txt` after saving.

## Static file (any host, Next.js `public/`, Astro `public/`, Hugo/Jekyll/11ty)

Edit the file. Add the line right after each group's `User-Agent:` line(s).

Before:

```
User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

Sitemap: https://www.example.com/sitemap.xml
```

After:

```
User-agent: *
Content-Signal: search=yes, ai-input=yes, ai-train=yes
Allow: /

User-agent: GPTBot
Content-Signal: search=yes, ai-input=yes, ai-train=yes
Allow: /

Sitemap: https://www.example.com/sitemap.xml
```

If several `User-agent:` lines share one group, the signal goes once, after the last of them.

- Next.js serves files in `public/` at the site root.
- Astro copies files in `public/` into the build untouched, and its docs name `robots.txt` as a typical example: https://docs.astro.build/en/basics/project-structure/
- Next.js also serves a static `app/robots.txt` file: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots

## Next.js App Router: `app/robots.ts`

Check the installed version: `npm ls next` (or read `package.json`).

### Next 16.3 or later: use `other`

Next 16.3.0 added an `other` field to each rule for directives Next doesn't know. They are written verbatim into that rule's group (after Allow/Disallow, which is fine). Add `other` to every rule that already exists, and don't add new rules:

```ts
import type { MetadataRoute } from "next";

const CONTENT_SIGNAL = "search=yes, ai-input=yes, ai-train=yes";

export default function robots(): MetadataRoute.Robots {
  return {
    // Keep the existing rules exactly as they were. Only add `other` to each one.
    rules: [
      { userAgent: "*", allow: "/", disallow: "/api/", other: { "Content-Signal": CONTENT_SIGNAL } },
    ],
    sitemap: "https://www.example.com/sitemap.xml",
  };
}
```

Docs: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots (version history lists `v16.3.0: Added other field`).

### Before Next 16.3: replace it with a route handler

`MetadataRoute.Robots` has no way to emit `Content-Signal`. Replace `app/robots.ts` with `app/robots.txt/route.ts` and **delete `app/robots.ts`** (both cannot exist together). If the project uses `src/app`, use `src/app/robots.txt/route.ts`.

Keep constants un-exported: Next 15+ route files may only export HTTP handlers and segment config (`dynamic`, `revalidate`...). Exporting anything else fails the build.

**Port the site's existing rules. Don't invent new ones.** Copy every group from the old `robots.ts` (or from the live `/robots.txt`) as it is: the same user agents, the same `Allow` and `Disallow` lines, the same `Sitemap` and `Host` lines. The only new line is `Content-Signal`.

> Warning: do not add groups for AI crawlers (GPTBot, ClaudeBot...) that weren't there before. A crawler obeys only the most specific group that matches it. Give GPTBot its own `User-agent: GPTBot` / `Allow: /` group and it stops reading the `User-agent: *` group, so every `Disallow` there (`/admin`, `/api`, `/checkout`...) no longer applies to it.

The template below holds the rules as data. Fill `GROUPS` with the old file's groups:

```ts
// app/robots.txt/route.ts
// Next's MetadataRoute.Robots (before 16.3) can't emit Content-Signal, so robots.txt is written by hand.

// Content Signals (https://contentsignals.org). Repeated in every group because a
// crawler only reads the group that matches its user agent.
const CONTENT_SIGNAL = "search=yes, ai-input=yes, ai-train=yes";

// Ported 1:1 from the old app/robots.ts. Same groups, same order, same rules.
const GROUPS: { userAgents: string[]; allow?: string[]; disallow?: string[] }[] = [
  { userAgents: ["*"], allow: ["/"], disallow: ["/api/", "/admin/"] }, // example: replace with the old rules
];

const SITEMAPS = ["https://www.example.com/sitemap.xml"]; // from the old file

export const dynamic = "force-static";

export function GET() {
  const groups = GROUPS.map((g) =>
    [
      ...g.userAgents.map((ua) => `User-Agent: ${ua}`),
      `Content-Signal: ${CONTENT_SIGNAL}`,
      ...(g.allow ?? []).map((path) => `Allow: ${path}`),
      ...(g.disallow ?? []).map((path) => `Disallow: ${path}`),
    ].join("\n"),
  );
  const sitemaps = SITEMAPS.map((url) => `Sitemap: ${url}`).join("\n");
  const body = `${groups.join("\n\n")}\n\n${sitemaps}\n`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
```

Prove the port with the whole-file diff in SKILL.md step 5. Apart from the `Content-Signal` lines, the old and new output must match. Small differences are fine, such as `User-agent` spelled `User-Agent` (both work) or a different blank line. A changed, added or missing rule is not fine.

If the old `robots.ts` changed its output by environment (for example `Disallow: /` when `VERCEL_ENV !== "production"`), keep that logic. With `force-static`, the file is built once per deploy, so a build-time env check still works. Drop `force-static` only if the old file read request-time data.

## Next.js Pages Router

- If there is `public/robots.txt`, edit it as a static file.
- If robots.txt is generated (for example `pages/robots.txt.js` with `getServerSideProps`, an API route plus a rewrite, or `next-sitemap`), find the code that writes the text and add the line to each group there.
- `next-sitemap` writes robots.txt at build time from its config. Check whether your version's config has a way to add custom lines to each policy. If it doesn't, turn off its robots.txt output and ship a static `public/robots.txt`.

## WordPress

WordPress serves a virtual robots.txt only when there is no physical `robots.txt` file in the site root. A physical file wins. Check which you have first (SFTP or your host's file manager).

**Yoast SEO**: Yoast SEO > Tools > File editor > "Create robots.txt file" (or edit the existing one). This writes a physical file. The menu is hidden if file editing is disabled (`DISALLOW_FILE_EDIT`). Docs: https://yoast.com/help/how-to-edit-robots-txt-through-yoast-seo/

**Rank Math**: Rank Math SEO > General Settings > Edit robots.txt (Advanced Mode must be on). This edits the virtual file, so a physical `robots.txt` must be deleted first or it overrides the editor. Docs: https://rankmath.com/kb/how-to-edit-robots-txt-with-rank-math/

**No SEO plugin: the `robots_txt` filter** (in a small plugin or the theme's `functions.php`). It only runs for the virtual file:

```php
add_filter( 'robots_txt', function ( $output, $public ) {
    $signal = 'Content-Signal: search=yes, ai-input=yes, ai-train=yes';
    // Add the signal after each run of User-agent lines (one per group).
    return preg_replace( '/((?:^User-agent:[^\n]*\n)+)/mi', "$1{$signal}\n", $output );
}, 99, 2 );
```

Hook reference: https://developer.wordpress.org/reference/hooks/robots_txt/

After saving, curl `/robots.txt`. Caching plugins and CDNs may serve the old copy for a while.

## Shopify

Edit the theme's `templates/robots.txt.liquid` (create it in the theme code editor under Templates if it doesn't exist). Shopify's docs show how to add a rule to a group after the default rules. Use the same pattern without the `if`, so the line goes into every group:

```liquid
{% for group in robots.default_groups %}
  {{- group.user_agent }}

  {%- for rule in group.rules -%}
    {{ rule }}
  {%- endfor %}
Content-Signal: search=yes, ai-input=yes, ai-train=yes
{% if group.sitemap != blank -%}
{{ group.sitemap }}
{% endif %}
{% endfor %}
```

The signal lands after the group's rules rather than right after `User-agent`. It is still inside the group, which is what matters.

Mind the whitespace markers. The tags around the signal line deliberately have no `-` on the side touching it (`{%- endfor %}` before it, `{% if` after it). A `-` there would strip the line break and could join the signal onto the next group's `User-agent` line, which breaks that group. An extra blank line in the output is harmless.

Test it safely:
1. Save a copy of the current live `/robots.txt`.
2. Duplicate the live theme and make the change in the unpublished copy first. Get the template right there before touching the live theme.
3. After you publish, curl `/robots.txt` and run the checks in SKILL.md steps 5 and 7. Every `Content-Signal` line should be on its own line, and nothing else should have changed.

We have not rendered this template on a real store. Docs: https://shopify.dev/docs/storefronts/themes/seo/robots-txt

## Wix

In the Wix dashboard, open the SEO section (currently "SEO & GEO") > Tools and settings > Robots.txt Editor > View File. Add the line under each `User-agent:` line, then save. Wix calls this an advanced feature and its support team won't help with edits. "Reset to Default" undoes it. Docs: https://support.wix.com/en/article/editing-your-sites-robotstxt-file

We have not verified that Wix keeps a line it doesn't recognize. Check the live `/robots.txt` after saving.

## Webflow

Webflow has a robots.txt field in Site settings > SEO > Indexing. Add your groups with the signal line, save, then publish. Docs: https://help.webflow.com/hc/en-us/articles/41954080897683-Set-robots-txt-rules

We could not load that page directly to confirm every detail, and we have not verified that Webflow keeps a non-standard line. Check the live `/robots.txt` after publishing.

## Squarespace

We could not find a Squarespace help page that lets you edit robots.txt freely. Check your site's crawler settings. If there is no editor, the only route we know of is a proxy or CDN in front of the site that rewrites `/robots.txt`. Cloudflare's managed robots.txt (below) is **not** that route if you want to allow AI use: it adds nothing unless you block something.

## Cloudflare managed robots.txt

If the site is behind Cloudflare, check whether this feature is on before you change anything, because it changes what `/robots.txt` returns. Source: https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/ (last updated Oct 22, 2026, checked Oct 29, 2026).

When it adds anything, quoted from that page:

> Cloudflare prepends managed directives and the Content Signals Policy to your `robots.txt` only when **Enable Bot Preference Sync** is turned on and at least one of your Search, Agent, or Training policies is set to **Block**, **Block on pages with ads**, or, for Training, **Disallow**. With every policy set to allow, there is nothing to prepend and your `robots.txt` is served unchanged.

What that means for this skill:
- **If the owner wants all three signals set to `yes`, this feature can't do it.** With every policy on allow, Cloudflare adds no `Content-Signal` line. Put the lines in your own robots.txt (the sections above).
- **If it is on, it does more than add signals.** The example on that page prepends `Content-signal: search=yes, ai-train=no, use=reference` under `User-Agent: *`, then `Disallow: /` groups for Amazonbot, Applebot-Extended, Bytespider, CCBot, ClaudeBot, Google-Extended, GPTBot and meta-externalagent. Those `Disallow` lines block those crawlers entirely. If the owner wants AI tools to read and cite the site, check the live file for them.
- Cloudflare's block goes **before** your own file in the same response, so your groups and its groups can both apply. Pick one source of signals. If you write your own `Content-Signal` lines, turn off Bot Preference Sync or make its policies match the owner's choice.
- Cloudflare writes `Content-signal` (lowercase s). Match case-insensitively when you count lines.
- The settings are in the Cloudflare dashboard: Security Settings, filter by Bot traffic, then Configure AI bot policies (as of that doc's date).

Separately, the page says Free plan domains that have no robots.txt and don't use this feature serve Cloudflare's Content Signals Policy text at `/robots.txt`. That text defines the signals but sets no preferences.

## Anything else

Find where `/robots.txt` comes from: a file in the build output, a route in the app, a CMS setting, or a CDN rule. Add the line to every group there. Then prove it with curl as in SKILL.md steps 5 and 7.
