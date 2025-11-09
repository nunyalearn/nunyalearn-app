import { Router } from "express";
import { Role } from "@prisma/client";
import {
  archiveAdminSubject,
  createAdminSubject,
  getAdminSubject,
  listAdminSubjects,
  restoreAdminSubject,
  updateAdminSubject,
} from "../../controllers/admin/adminSubjectController";
import { verifyToken } from "../../middlewares/verifyToken";
import { verifyRole } from "../../middlewares/verifyRole";

const router = Router();

router.use(verifyToken, verifyRole(Role.ADMIN));

router.get("/", listAdminSubjects);
router.post("/", createAdminSubject);
router.get("/:id", getAdminSubject);
router.put("/:id", updateAdminSubject);
router.post("/:id/archive", archiveAdminSubject);
router.post("/:id/restore", restoreAdminSubject);

export default router;
