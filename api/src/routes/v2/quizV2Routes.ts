import { Router } from "express";
import {
  getQuizHandler,
  listQuizzesHandler,
  reviewQuizAttemptHandler,
  startQuizAttemptHandler,
  submitQuizAttemptHandler,
} from "../../controllers/v2/quizV2Controller";

const router = Router();

router.get("/", listQuizzesHandler);
router.get("/:id", getQuizHandler);
router.post("/:id/start", startQuizAttemptHandler);
router.post("/:id/submit", submitQuizAttemptHandler);
router.get("/:id/review", reviewQuizAttemptHandler);

export default router;
