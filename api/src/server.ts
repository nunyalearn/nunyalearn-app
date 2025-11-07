import "dotenv/config";
import cors from "cors";
import express from "express";
import routes from "./routes";
import { errorHandler } from "./middlewares/errorHandler";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/v1", routes);

app.use((_req, res) => {
  return res.status(404).json({ success: false, message: "Route not found" });
});

app.use(errorHandler);

const PORT = Number(process.env.PORT) || 8080;

app.listen(PORT, () => {
  console.log(`✅ Nunyalearn API running on http://localhost:${PORT}`);
});
