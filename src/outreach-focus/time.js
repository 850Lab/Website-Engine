/** Local-time context for focused outreach activity. */
export function getFocusTimeContext(date = new Date()) {
  const at = date.toISOString();
  const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "long" });
  const hour = date.getHours();

  let timeBucket;
  if (hour >= 6 && hour < 8) timeBucket = "6am-8am";
  else if (hour >= 8 && hour < 10) timeBucket = "8am-10am";
  else if (hour >= 10 && hour < 12) timeBucket = "10am-12pm";
  else if (hour >= 12 && hour < 14) timeBucket = "12pm-2pm";
  else if (hour >= 14 && hour < 16) timeBucket = "2pm-4pm";
  else if (hour >= 16 && hour < 18) timeBucket = "4pm-6pm";
  else if (hour >= 18 && hour < 20) timeBucket = "6pm-8pm";
  else timeBucket = "After Hours";

  return {
    at,
    dayOfWeek,
    timeBucket,
    dateLabel: date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    timeLabel: date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}
