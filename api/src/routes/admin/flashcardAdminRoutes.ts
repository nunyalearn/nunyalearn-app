import { Router } from "express";
import { Role } from "@prisma/client";
import {
  createAdminFlashcard,
  deleteAdminFlashcard,
  getAdminFlashcard,
  listAdminFlashcards,
  updateAdminFlashcard,
} from "../../controllers/admin/adminFlashcardController";
import { verifyToken } from "../../middlewares/verifyToken";
import { verifyRole } from "../../middlewares/verifyRole";

const router = Router();

router.use(verifyToken, verifyRole(Role.ADMIN));

router.get("/", listAdminFlashcards);
router.get("/:id", getAdminFlashcard);
router.post("/", createAdminFlashcard);
router.put("/:id", updateAdminFlashcard);
router.delete("/:id", deleteAdminFlashcard);

export default router;
