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

Next 16.3.0 added an `other` field to each rule for directives Next doesn't know. They are written verbatim into that rule's group (after Allow/Disallow, which is fine):

```ts
import type { MetadataRoute } from "next";

const CONTENT_SIGNAL = "search=yes, ai-input=yes, ai-train=yes";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", other: { "Content-Signal": CONTENT_SIGNAL } },
      { userAgent: "GPTBot", allow: "/", other: { "Content-Signal": CONTENT_SIGNAL } },
    ],
    sitemap: "https://www.example.com/sitemap.xml",
  };
}
```

Docs: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots (version history lists `v16.3.0: Added other field`).

### Before Next 16.3: replace it with a route handler

`MetadataRoute.Robots` has no way to emit `Content-Signal`. Replace `app/robots.ts` with `app/robots.txt/route.ts` and **delete `app/robots.ts`** (both cannot exist together). If the project uses `src/app`, use `src/app/robots.txt/route.ts`.

Keep constants un-exported: Next 15+ route files may only export HTTP handlers and segment config (`dynamic`, `revalidate`...). Exporting anything else fails the build.

```ts
// app/robots.txt/route.ts
// Next's MetadataRoute.Robots can't emit Content-Signal, so robots.txt is written by hand.

const BASE = "https://www.example.com";

const AI_CRAWLERS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "CCBot"];

// Content Signals (https://contentsignals.org). Repeated in every group because a
// crawler only reads the group that matches its user agent.
const CONTENT_SIGNAL = "search=yes, ai-input=yes, ai-train=yes";

export const dynamic = "force-static";

export function GET() {
  const rules = [{ userAgent: "*", allow: "/" }, ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: "/" }))];

  const groups = rules.map(
    (rule) => `User-Agent: ${rule.userAgent}\nContent-Signal: ${CONTENT_SIGNAL}\nAllow: ${rule.allow}`,
  );
  const body = `${groups.join("\n\n")}\n\nSitemap: ${BASE}/sitemap.xml\n`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
```

Port the old file's rules exactly. Copy every user agent, every `allow` and `disallow`, and the sitemap and host lines.

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
  {%- endfor -%}


  {{ 'Content-Signal: search=yes, ai-input=yes, ai-train=yes' }}


  {%- if group.sitemap != blank -%}
    {{ group.sitemap }}
  {%- endif -%}
{% endfor %}
```

The signal lands after the group's rules rather than right after `User-agent`. That is still inside the group, which is what matters. The whitespace markers (`{%-`, `-%}`) are copied from Shopify's example; save a copy of the current `/robots.txt` first and compare the live output after publishing. Docs: https://shopify.dev/docs/storefronts/themes/seo/robots-txt

## Wix

In the Wix dashboard, open the SEO section (currently "SEO & GEO") > Tools and settings > Robots.txt Editor > View File. Add the line under each `User-agent:` line, then save. Wix calls this an advanced feature and its support team won't help with edits. "Reset to Default" undoes it. Docs: https://support.wix.com/en/article/editing-your-sites-robotstxt-file

We have not verified that Wix keeps a line it doesn't recognize. Check the live `/robots.txt` after saving.

## Webflow

Webflow has a robots.txt field in Site settings > SEO > Indexing. Add your groups with the signal line, save, then publish. Docs: https://help.webflow.com/hc/en-us/articles/41954080897683-Set-robots-txt-rules

We could not load that page directly to confirm every detail, and we have not verified that Webflow keeps a non-standard line. Check the live `/robots.txt` after publishing.

## Squarespace

We could not find a Squarespace help page that lets you edit robots.txt freely. Check your site's crawler settings. If there is no editor, the only route we know of is a proxy or CDN in front of the site that serves its own robots.txt (for example Cloudflare's managed robots.txt, below).

## Cloudflare managed robots.txt

If the site is behind Cloudflare, it can manage robots.txt for you. Cloudflare docs: https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/ and the policy announcement: https://blog.cloudflare.com/content-signals-policy/

What it does, per those docs:
- If your origin already serves a robots.txt, Cloudflare puts its managed content (rules for known AI crawlers plus its Content Signals Policy text) **before** your file in one response. If you have no file, it creates one.
- Its defaults come from Cloudflare, not from you. The docs show `search=yes` and `ai-train=no` under `User-Agent: *`, and Cloudflare deliberately leaves `ai-input` out.
- The settings live in the Cloudflare dashboard under the zone's security / bot settings (AI bot policies). Menu names change, so search the dashboard for "robots.txt".

Watch out:
- If you also add your own `Content-Signal` lines, the response can contain two policies. Pick one source. Either turn off the managed option and keep your own lines, or use the managed option and set its values to match what the owner chose.
- The managed option can also add `Disallow` rules for AI crawlers. That blocks access. If the owner wants AI tools to read and cite the site, check the live file for new `Disallow` lines.

## Anything else

Find where `/robots.txt` comes from: a file in the build output, a route in the app, a CMS setting, or a CDN rule. Add the line to every group there. Then prove it with curl as in SKILL.md steps 5 and 7.
