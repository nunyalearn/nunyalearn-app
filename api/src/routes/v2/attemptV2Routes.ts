import { Router } from "express";
import {
  getLearnerAttemptHandler,
  listLearnerAttemptsHandler,
} from "../../controllers/v2/attemptV2Controller";

const router = Router();

router.get("/", listLearnerAttemptsHandler);
router.get("/:id", getLearnerAttemptHandler);

export default router;
