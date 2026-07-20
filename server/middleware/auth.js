/**
 * Basic-auth gate for admin surfaces (/usage dashboard data).
 * Admins come from COACH_ADMINS ("user:pass,user2:pass2"), same convention as
 * the consult-athena coach console. Default matches that project's default —
 * ⚠ change COACH_ADMINS before any real deployment.
 */
const admins = () =>
  (process.env.COACH_ADMINS || "Athena:deloitte168")
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean);

export function requireAdminAuth(req, res, next) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    if (admins().includes(decoded)) return next();
  }
  res.status(401).json({ error: "Unauthorized" });
}
