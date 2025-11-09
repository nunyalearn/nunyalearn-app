import { Router } from "express";
import { Role } from "@prisma/client";
import {
  createAdminQuiz,
  deleteAdminQuiz,
  getAdminQuiz,
  listAdminQuizzes,
  updateAdminQuiz,
} from "../../controllers/admin/adminQuizController";
import { verifyToken } from "../../middlewares/verifyToken";
import { verifyRole } from "../../middlewares/verifyRole";

const router = Router();

router.use(verifyToken, verifyRole(Role.ADMIN));

router.get("/", listAdminQuizzes);
router.get("/:id", getAdminQuiz);
router.post("/", createAdminQuiz);
router.put("/:id", updateAdminQuiz);
router.delete("/:id", deleteAdminQuiz);

export default router;
