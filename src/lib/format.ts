/** 'YYYY-MM-DD' → 'YYYY/MM/DD' */
export function formatDate(d: string): string {
  return d.replace(/-/g, '/');
}

/** ISO 文字列 → 'YYYY/MM/DD HH:mm' */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh  = String(d.getHours()).padStart(2, '0');
  const mm  = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${day} ${hh}:${mm}`;
}
