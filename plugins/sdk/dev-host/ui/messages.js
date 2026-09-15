export function hostMessage(channel, message) {
  return JSON.parse(JSON.stringify({ ...message, source: "gauss-horizon-host", version: 1, channel }));
}
