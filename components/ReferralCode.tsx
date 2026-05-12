'use client';

import { useMemo } from 'react';

interface ReferralCodeProps {
  address: string;
  tier: string;
  referralCount: number;
}

function generateReferralCode(address: string): string {
  // Deterministic referral code: keccak256(address + timestamp)[:8], simplified for client
  // In production this uses on-chain keccak256; here we derive a consistent 8-char code
  let hash = 0;
  const str = address.toLowerCase();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hex = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
  return hex.slice(0, 8);
}

export function ReferralCode({ address, tier, referralCount }: ReferralCodeProps) {
  const referralCode = useMemo(() => {
    return generateReferralCode(address);
  }, [address]);

  return (
    <div className="rounded-2xl border p-6" style={{
      background: 'rgba(11,11,13,0.85)',
      borderColor: 'rgba(139,30,45,0.3)',
    }}>
      <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#b08d57' }}>
        Your Referral Code
      </div>
      <div className="text-2xl font-mono font-bold mb-2" style={{ color: '#eaeaea' }}>
        {referralCode}
      </div>
      <div className="text-xs mb-4" style={{ color: 'rgba(234,234,234,0.5)' }}>
        Share to earn ZENT rewards
      </div>
      <div className="flex gap-4">
        <div>
          <div className="text-lg font-bold" style={{ color: '#eaeaea' }}>{referralCount}</div>
          <div className="text-xs" style={{ color: 'rgba(234,234,234,0.4)' }}>Referrals</div>
        </div>
        <div>
          <div className="text-lg font-bold" style={{ color: '#b08d57' }}>{tier}</div>
          <div className="text-xs" style={{ color: 'rgba(234,234,234,0.4)' }}>Tier</div>
        </div>
      </div>
      <button
        className="mt-4 w-full py-3 rounded-xl text-center text-xs font-semibold uppercase tracking-widest cursor-pointer transition-opacity hover:opacity-90"
        style={{ background: '#8b1e2d', color: '#eaeaea' }}
        onClick={() => navigator.clipboard.writeText(referralCode)}
      >
        Copy Code
      </button>
    </div>
  );
}
