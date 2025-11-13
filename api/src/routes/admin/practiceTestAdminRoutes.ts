import { Router } from "express";
import { Role } from "@prisma/client";
import {
  createPracticeTest,
  getPracticeTestDetail,
  listPracticeTests,
  updatePracticeTest,
  updatePracticeTestStatus,
} from "../../controllers/admin/practiceTestAdminController";
import { verifyToken } from "../../middlewares/verifyToken";
import { verifyRole } from "../../middlewares/verifyRole";

const router = Router();

router.use(verifyToken, verifyRole(Role.ADMIN));

router.get("/", listPracticeTests);
router.get("/:id", getPracticeTestDetail);
router.post("/", createPracticeTest);
router.put("/:id", updatePracticeTest);
router.patch("/:id/status", updatePracticeTestStatus);

export default router;
