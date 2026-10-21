import { ADS_ENABLED } from '../config/site';

export function AdSlot() {
  if (!ADS_ENABLED) return null;
  return <aside className="ad-slot" aria-label="مساحة إعلانية" />;
}
