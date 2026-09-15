// Explicit compatibility adapter. New variables always win.
for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith("DBX_") && process.env["GAUSS_HORIZON_" + key.slice(4)] === undefined)
    process.env["GAUSS_HORIZON_" + key.slice(4)] = value;
}
