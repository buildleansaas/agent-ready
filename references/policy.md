# Choosing a Content Signals policy

Content Signals are one line in robots.txt that says what may be done with your content after a crawler fetches it. robots.txt already says *whether* a crawler may fetch a page (`Allow`, `Disallow`). Content Signals say *how* the content may be used.

```
User-Agent: *
Content-Signal: search=yes, ai-input=yes, ai-train=no
Allow: /
```

Sources: https://contentsignals.org, Cloudflare's announcement https://blog.cloudflare.com/content-signals-policy/, and the IETF draft `draft-romm-aipref-contentsignals` (https://datatracker.ietf.org/doc/draft-romm-aipref-contentsignals/).

## The three signals

**`search`**: building a search index and showing search results, such as links and short excerpts from your pages. It does not include AI-written search summaries.

**`ai-input`**: feeding your content into an AI model to answer a question right now. Examples are retrieval and grounding: ChatGPT, Claude or Perplexity fetching your page to answer a user and (usually) citing it.

**`ai-train`**: using your content to train or fine-tune AI models.

Each value is `yes` or `no`. If you leave a signal out, you haven't stated a preference for it. Leaving it out does not mean `no`.

## What the signals do and don't do

- They are a stated preference, not a lock. A crawler that ignores them can still use the content. If you need to stop a crawler from fetching pages, that is a `Disallow` rule or a firewall rule, which is a different decision.
- Crawlers that don't understand `Content-Signal` skip the line (RFC 9309 says unknown lines are ignored). Adding it does not change how Google or Bing crawl you.
- A crawler reads only the group that matches its user agent. That is why the line goes into every group, not only `User-Agent: *`.

## Tradeoffs

| Choice | You get | You give up |
|---|---|---|
| `search=yes` | Normal search traffic. | Nothing new. This is what search engines already do. |
| `search=no` | A stated "don't index me". | Search traffic. Rarely what a public site wants. Use `noindex` if you mean it. |
| `ai-input=yes` | AI answers can quote and link your pages. This is where AI referral traffic comes from. | Some readers get the answer without visiting. |
| `ai-input=no` | A stated "don't use me in AI answers". | Citations and links from AI tools that respect it. |
| `ai-train=yes` | Future models may know your site, brand and facts. | Your content trains models with no payment or credit. |
| `ai-train=no` | A stated reservation of your content from training. | Less presence in what models know offline. |

**Default recommendation:** `search=yes, ai-input=yes`. Let the owner decide `ai-train`. On our own sites we chose `ai-train=yes`, because we want our free tools known. A publisher selling original writing may reasonably choose `no`.

## Sites with ads

AI answers and agents don't see or click ads. That is a reason to think about `ai-input`, but saying `no` usually costs more than it saves, because AI citations send visitors who do see ads.

The scanner's next level (Level 3) asks for Markdown for Agents: serving a plain markdown copy of each page when an agent asks for it. On an ad-supported site that hands agents the full content with no ads and no surrounding context. We skip it.

## What we skip and why

| Scanner check | Why we skip it |
|---|---|
| Markdown for Agents (`markdownNegotiation`) | Gives agents the content without ads or context. Skip on ad-supported sites. Revisit if the site sells a product rather than ad views. |
| DNS-AID (`dnsAid`) | A DNS record for AI discovery with no real adoption yet. |
| Link headers (`linkHeaders`) | Points agents to APIs and docs. Low value for a content site. |
| MCP server card, A2A agent card, OAuth discovery, API catalog, agent skills, WebMCP | Only meaningful if the site offers an API or tools for agents. Don't publish empty or fake ones. |
| Commerce (x402, MPP, UCP, ACP, AP2) | Only for sites that sell to agents. |

The scanner's level is a proxy. The goal is search and AI-answer traffic. Content Signals are cheap, safe and say something true about the site. Most of the rest only makes sense when there is something behind it.
