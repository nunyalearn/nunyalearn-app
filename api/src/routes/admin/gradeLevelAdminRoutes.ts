import { Router } from "express";
import { Role } from "@prisma/client";
import {
  archiveGradeLevel,
  createGradeLevel,
  getGradeLevel,
  listGradeLevels,
  restoreGradeLevel,
  updateGradeLevel,
} from "../../controllers/admin/adminGradeLevelController";
import { verifyToken } from "../../middlewares/verifyToken";
import { verifyRole } from "../../middlewares/verifyRole";

const router = Router();

router.use(verifyToken, verifyRole(Role.ADMIN));

router.get("/", listGradeLevels);
router.post("/", createGradeLevel);
router.get("/:id", getGradeLevel);
router.put("/:id", updateGradeLevel);
router.post("/:id/archive", archiveGradeLevel);
router.post("/:id/restore", restoreGradeLevel);

export default router;
