import { Router } from "express";
import { getProgress, updateProgress } from "../controllers/progressController";
import { verifyToken } from "../middlewares/verifyToken";

const router = Router();

router.get("/", verifyToken, getProgress);
router.put("/", verifyToken, updateProgress);

export default router;
