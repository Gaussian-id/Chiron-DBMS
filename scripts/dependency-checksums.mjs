// Go h1 checksums are SHA-256 digests, encoded as canonical base64. They are
// dependency identity data and must never be changed by product renaming.
export function goSumErrors(text) {
  const errors = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const fields = line.trim().split(/\s+/);
    const encoded = fields[2]?.replace(/^h1:/, "");
    if (fields.length !== 3 || !fields[2].startsWith("h1:") ||
        !/^[A-Za-z0-9+/]{43}=$/.test(encoded) ||
        Buffer.from(encoded, "base64").length !== 32 ||
        Buffer.from(encoded, "base64").toString("base64") !== encoded) {
      errors.push(`${index + 1}: invalid dependency checksum`);
    }
  }
  return errors;
}
