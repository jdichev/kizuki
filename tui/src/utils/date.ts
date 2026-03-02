export function formatDateTime(published: number) {
  const timestamp = published > 10000000000 ? published : published * 1000;
  const date = new Date(timestamp);

  const dateStr = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return { dateStr, timeStr, dateTimeStr: `${dateStr} ${timeStr}` };
}
