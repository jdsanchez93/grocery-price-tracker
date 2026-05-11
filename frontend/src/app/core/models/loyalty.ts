export function getLoyaltyIcon(loyalty: string): string {
  const l = loyalty.toLowerCase();
  if (l.includes('digital') || l.includes('coupon')) return 'pi pi-tag';
  if (l.includes('card') || l === 'card_required') return 'pi pi-credit-card';
  return 'pi pi-star';
}

export function getLoyaltyTooltip(loyalty: string): string {
  const l = loyalty.toLowerCase();
  if (l.includes('digital') || l.includes('coupon')) return 'Requires digital coupon';
  if (l.includes('card') || l === 'card_required') return 'Requires loyalty card';
  return loyalty;
}
