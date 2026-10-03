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

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// app.use("/api/employees", require("./routes/employees"));
// app.use("/api/departments", require("./routes/departments"));
// app.use("/api/transactions", require("./routes/transactions"));
// app.use("/api/summary", require("./routes/summary"));

app.use("/api/employees", require("./routes/employees"));
app.use("/api/departments", require("./routes/department"));
// app.use("/api/departments", require("./routes/departmentImport"));
app.use("/api/transactions", require("./routes/transaction"));
app.use("/api/summary", require("./routes/summary"));

app.get("/", (req, res) => res.send("Laundry backend is running."));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));