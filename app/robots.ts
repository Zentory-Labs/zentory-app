import type { MetadataRoute } from 'next'

const siteUrl = 'https://app.zentorylabs.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        // Allow the public marketing surface. Disallow utility / wallet /
        // admin pages — they're behind a connect-wallet gate and don't
        // benefit from being indexed.
        allow: '/',
        disallow: [
          '/api/',
          '/admin',
          '/admin/',
          '/blocked',
          '/dashboard',  // requires wallet — no public content
          '/contribute/dashboard',
        ],
      },
      // Explicitly allow major AI / rating scrapers. These are the ones most
      // likely to evaluate ZENTORY for ratings, write-ups, or research.
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'OAI-SearchBot', allow: '/' },
      { userAgent: 'ChatGPT-User', allow: '/' },
      { userAgent: 'PerplexityBot', allow: '/' },
      { userAgent: 'Perplexity-User', allow: '/' },
      { userAgent: 'ClaudeBot', allow: '/' },
      { userAgent: 'Claude-Web', allow: '/' },
      { userAgent: 'anthropic-ai', allow: '/' },
      { userAgent: 'Applebot-Extended', allow: '/' },
      { userAgent: 'Google-Extended', allow: '/' },
      { userAgent: 'CCBot', allow: '/' },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
