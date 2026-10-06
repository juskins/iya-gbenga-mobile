/** Money is integer kobo everywhere. 1480000 -> "₦14,800". Never floats. */
export function formatNaira(kobo: number): string {
  const naira = Math.trunc(kobo / 100);
  const sign = naira < 0 ? "-" : "";
  return `${sign}₦${Math.abs(naira).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

const lagosDate = new Intl.DateTimeFormat("en-NG", {
  timeZone: "Africa/Lagos",
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatLagosDate(iso: string): string {
  return lagosDate.format(new Date(iso));
}
