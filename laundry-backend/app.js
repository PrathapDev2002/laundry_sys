const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

// Allowed frontend origin(s) — set CORS_ORIGIN in your environment (Render) to your
// real Vercel URL, e.g. https://laundry-sys.vercel.app. Falls back to "*" so local
// dev (any IP/port) still works without needing to set anything.
const allowedOrigin = process.env.CORS_ORIGIN || "*";

const io = new Server(server, {
  cors: { origin: allowedOrigin },
});

// Make io available inside route handlers via req.app.get("io")
app.set("io", io);

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.on("disconnect", () => console.log("Client disconnected:", socket.id));
});

app.disable("etag"); // prevents 304 Not Modified on API responses, which can return an empty body
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// If there are no admin accounts yet, create a default one so you can log in
// the first time without any API tools. Override via DEFAULT_ADMIN_USERNAME /
// DEFAULT_ADMIN_PASSWORD env vars. Change this password right after first login!
async function ensureDefaultAdmin() {
  const Admin = require("./models/Admin");
  const bcrypt = require("bcryptjs");
  if ((await Admin.countDocuments()) > 0) return;

  const username = process.env.DEFAULT_ADMIN_USERNAME || "admin";
  const password = process.env.DEFAULT_ADMIN_PASSWORD || "admin123";
  await Admin.create({ username, passwordHash: await bcrypt.hash(password, 10) });
  console.log(`Default admin created -> username: "${username}". Change the password after first login.`);
}

mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("MongoDB connected");
    await ensureDefaultAdmin();
  })
  .catch(err => console.error("MongoDB connection error:", err));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/employees", require("./routes/employees"));
app.use("/api/departments", require("./routes/department"));
app.use("/api/transactions", require("./routes/transaction"));
app.use("/api/summary", require("./routes/summary"));
app.use("/api/notifications", require("./routes/notification"));

app.get("/", (req, res) => res.send("Laundry backend is running."));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));