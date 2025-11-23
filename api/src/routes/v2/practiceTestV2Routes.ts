import { Router } from "express";
import {
  getPracticeTestHandler,
  listPracticeTestsHandler,
  reviewPracticeTestAttemptHandler,
  startPracticeTestAttemptHandler,
  submitPracticeTestAttemptHandler,
} from "../../controllers/v2/practiceTestV2Controller";

const router = Router();

router.get("/", listPracticeTestsHandler);
router.get("/:id", getPracticeTestHandler);
router.post("/:id/start", startPracticeTestAttemptHandler);
router.post("/:id/submit", submitPracticeTestAttemptHandler);
router.get("/:id/review", reviewPracticeTestAttemptHandler);

export default router;
