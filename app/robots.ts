import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// We WANT to be crawled — by Google AND by AI assistants (low-competition
// market; discoverability is the moat). So all major + AI crawlers are allowed;
// only private/transactional paths are blocked.
export default function robots(): MetadataRoute.Robots {
  const allowedAiBots = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-Web", "anthropic-ai", "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "Bytespider", "Amazonbot", "Meta-ExternalAgent"];
  const disallow = ["/book/", "/account", "/login", "/signup", "/auth/", "/api/"];

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      // Explicitly welcome AI crawlers (same access as everyone else).
      ...allowedAiBots.map((ua) => ({ userAgent: ua, allow: "/", disallow })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
