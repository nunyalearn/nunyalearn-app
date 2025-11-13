import { Router } from "express";
import { Role } from "@prisma/client";
import {
  createQuiz,
  getQuizDetail,
  listQuizzesByTopic,
  updateQuiz,
  updateQuizStatus,
} from "../../controllers/admin/quizAdminController";
import { verifyToken } from "../../middlewares/verifyToken";
import { verifyRole } from "../../middlewares/verifyRole";

const router = Router();

router.use(verifyToken, verifyRole(Role.ADMIN));

router.get("/", listQuizzesByTopic);
router.get("/:id", getQuizDetail);
router.post("/", createQuiz);
router.put("/:id", updateQuiz);
router.patch("/:id/status", updateQuizStatus);

export default router;
