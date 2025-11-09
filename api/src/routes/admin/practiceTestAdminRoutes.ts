import { Router } from "express";
import { Role } from "@prisma/client";
import {
  createPracticeTest,
  deletePracticeTest,
  getPracticeTestById,
  listPracticeTests,
  updatePracticeTest,
} from "../../controllers/admin/adminPracticeTestController";
import { verifyToken } from "../../middlewares/verifyToken";
import { verifyRole } from "../../middlewares/verifyRole";

const router = Router();

router.use(verifyToken, verifyRole(Role.ADMIN));

router.get("/", listPracticeTests);
router.get("/:id", getPracticeTestById);
router.post("/", createPracticeTest);
router.put("/:id", updatePracticeTest);
router.delete("/:id", deletePracticeTest);

export default router;
