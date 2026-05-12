export const RESTRICTED_COUNTRIES = new Set([
  'US', 'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL',
  'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'KP', 'IR', 'SY', 'BY', 'MM', 'VE', 'CU',
]);

export function isRestrictedCountry(countryCode: string): boolean {
  return RESTRICTED_COUNTRIES.has(countryCode.toUpperCase());
}

export function getCountryFromRequest(request: Request): string {
  const country = request.headers.get('x-vercel-ip-country') ??
    request.headers.get('cf-ipcountry') ??
    'XX';
  return country.toUpperCase();
}

export function geoBlockCheck(request: Request): Response | null {
  const country = getCountryFromRequest(request);
  if (RESTRICTED_COUNTRIES.has(country)) {
    return new Response('Access restricted in your region.', { status: 451 });
  }
  return null;
}
