import type { MetadataRoute } from 'next'

const siteUrl = 'https://app.zentorylabs.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const routes = [
    // Public landing + the on-chain transparency surface
    { path: '/', priority: 1.0, changeFrequency: 'weekly' as const },
    { path: '/state-of-protocol', priority: 0.95, changeFrequency: 'weekly' as const },
    { path: '/markets', priority: 0.7, changeFrequency: 'monthly' as const },
    { path: '/faucet', priority: 0.6, changeFrequency: 'monthly' as const },
    // Live vault pages — chain-998 mock assets. Each vault has its own route.
    { path: '/vaults/zBTC', priority: 0.85, changeFrequency: 'daily' as const },
    { path: '/vaults/zETH', priority: 0.85, changeFrequency: 'daily' as const },
    { path: '/vaults/zSOL', priority: 0.85, changeFrequency: 'daily' as const },
    { path: '/vaults/zXRP', priority: 0.85, changeFrequency: 'daily' as const },
    // Research / governance / staking surface
    { path: '/research', priority: 0.7, changeFrequency: 'weekly' as const },
    { path: '/signals', priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/leaderboard', priority: 0.7, changeFrequency: 'daily' as const },
    { path: '/contribute', priority: 0.6, changeFrequency: 'monthly' as const },
    { path: '/subscribe', priority: 0.6, changeFrequency: 'monthly' as const },
    { path: '/stake', priority: 0.7, changeFrequency: 'weekly' as const },
    { path: '/govern', priority: 0.6, changeFrequency: 'weekly' as const },
    // Static / informational
    { path: '/bug-bounty', priority: 0.3, changeFrequency: 'yearly' as const },
  ]

  return routes.map((route) => ({
    url: `${siteUrl}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))
}
