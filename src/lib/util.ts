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
