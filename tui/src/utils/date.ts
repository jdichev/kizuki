export function formatDateTime(published: number) {
  const timestamp = published > 10000000000 ? published : published * 1000;
  const date = new Date(timestamp);

  const dayMonthStr = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
  });
  const timeStr = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Keep legacy keys while showing day/month and time without year.
  return {
    dateStr: dayMonthStr,
    timeStr,
    dateTimeStr: `${dayMonthStr} ${timeStr}`,
  };
}
