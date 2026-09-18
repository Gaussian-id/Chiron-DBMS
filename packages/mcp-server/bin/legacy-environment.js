// Explicit compatibility adapter. New variables always win.
for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith("CHIRON_HORIZON_") && process.env["CHIRON_HORIZON_" + key.slice(4)] === undefined)
    process.env["CHIRON_HORIZON_" + key.slice(4)] = value;
}
