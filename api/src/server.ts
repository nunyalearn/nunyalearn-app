import express from "express";
import cors from "cors";
import "dotenv/config";  // This loads environment variables

const app = express();
app.use(cors());
app.use(express.json());

// Health check route
app.get("/api/v1/health", (_req, res) => {
  res.json({ success: true, message: "Nunyalearn API is running 🚀" });
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ Server started on http://localhost:${PORT}`);
});

