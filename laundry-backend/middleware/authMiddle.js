const jwt = require("jsonwebtoken");

// Protects admin-only routes. Staff-facing routes (employee lookup, department
// item dropdown, transaction submit, pending reference) do NOT use this —
// they must stay open for the QR form to work without a login.
module.exports = function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = payload; // { id, username }
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired session" });
  }
};