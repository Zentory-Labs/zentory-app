interface LegalDisclaimerProps {
  variant?: 'footer' | 'inline' | 'banner'
  className?: string
}

// Terms / Privacy live on the marketing site only — link out to avoid 404s
// from the dApp's Next.js router prefetching nonexistent local routes.
const TERMS_URL = 'https://zentorylabs.com/terms-of-service'
const PRIVACY_URL = 'https://zentorylabs.com/privacy-policy'

const footerText = (
  <>
    This website and all materials have been prepared for general informational purposes only and do not constitute financial, legal, tax, or investment advice. No offer or solicitation to buy or sell any security, token, or product is made. Zentory Labs Token and Zentory Labs Models involve risk; past or hypothetical performance does not guarantee future results. Access may be restricted by jurisdiction. You should seek independent legal, tax, and financial advice before making any decision. By using this site you agree to our{' '}
    <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-inherit">Terms of Service</a>
    {' '}and{' '}
    <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-inherit">Privacy Policy</a>.
  </>
)

const inlineText = (
  <>
    Not financial or legal advice. No offer or solicitation. High risk. Seek independent advice. See{' '}
    <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="underline">Terms</a> and risk disclosures.
  </>
)

const bannerText = (
  <>
    <strong>Disclaimer:</strong> This site is for information only. No offer or solicitation. Crypto and investments carry risk. Not legal or investment advice. Jurisdiction restrictions may apply.
  </>
)

export default function LegalDisclaimer({ variant = 'footer', className = '' }: LegalDisclaimerProps) {
  if (variant === 'footer') {
    return (
      <p className={`text-[#bfc3c7] text-xs font-light max-w-2xl leading-relaxed ${className}`}>
        {footerText}
      </p>
    )
  }

  if (variant === 'inline') {
    return (
      <p className={`text-black/50 text-xs font-light ${className}`}>
        {inlineText}
      </p>
    )
  }

  if (variant === 'banner') {
    return (
      <p className={`text-white/80 text-sm font-light ${className}`}>
        {bannerText}
      </p>
    )
  }

  return null
}
