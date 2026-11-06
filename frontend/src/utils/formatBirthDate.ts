export function formatBirthDate(value?: string | null): string {
  if (!value) return '';
  const raw = value.trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (iso) return iso[3] + '/' + iso[2] + '/' + iso[1];

  const dayFirst = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dayFirst) return dayFirst[1].padStart(2, '0') + '/' + dayFirst[2].padStart(2, '0') + '/' + dayFirst[3];

  return raw;
}
