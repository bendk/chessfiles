export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function abbreviateCount(count: number) {
  if (count < 1_000) {
    return count.toString();
  } else if (count < 1_000_000) {
    return `${(count / 1_000).toFixed(1)}k`;
  } else if (count < 1_000_000_000) {
    return `${(count / 1_000_000).toFixed(1)}m`;
  } else {
    return `${(count / 1_000_000_000).toFixed(1)}g`;
  }
}

export function pastTimeDisplay(
  timestamp: number | undefined,
  currentTimestamp: number,
) {
  if (timestamp === undefined) {
    return "never";
  }
  const period = futureTimeDisplay(currentTimestamp, timestamp);
  if (period == "now") {
    return "now";
  } else {
    return `${period} ago`;
  }
}

export function futureTimeDisplay(timestamp: number, currentTimestamp: number) {
  // Do some basic checking that the meta doesn't have a future timestamp because it was
  // stored by a client with a weird clock
  const seconds = Math.max((timestamp - currentTimestamp) / 1000, 0);
  const table: [number, string, string][] = [
    [604800, "week", "weeks"],
    [86400, "day", "days"],
    [3600, "hour", "hours"],
    [60, "minute", "minutes"],
  ];

  for (const [amount, singular, plural] of table) {
    if (seconds >= amount) {
      const count = Math.round(seconds / amount);
      if (count === 1) {
        return `${count} ${singular}`;
      } else {
        return `${count} ${plural}`;
      }
    }
  }
  return "now";
}
