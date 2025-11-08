import { Router } from "express";
import { getXpHistory } from "../controllers/xpHistoryController";
import { verifyToken } from "../middlewares/verifyToken";

const router = Router();

router.get("/", verifyToken, getXpHistory);

export default router;
