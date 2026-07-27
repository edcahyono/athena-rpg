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

/**
 * Same credential list, different transport: the coach console has its own
 * sign-in form and sends the pair as headers rather than HTTP Basic, which
 * would trigger the browser's native auth dialog on every fetch.
 */
export function requireCoachAuth(req, res, next) {
  const user = req.headers["x-coach-user"] || "";
  const pass = req.headers["x-coach-pass"] || "";
  if (user && admins().includes(`${user}:${pass}`)) return next();
  res.status(401).json({ error: "coach_auth_required" });
}
