import { Router } from "express";
import { getQuizzes, submitAttempt } from "../controllers/quizController";
import { verifyToken } from "../middlewares/verifyToken";

const router = Router();

router.get("/", getQuizzes);
router.post("/attempts", verifyToken, submitAttempt);

export default router;
