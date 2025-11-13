import { Router } from "express";
import { Role } from "@prisma/client";
import {
  createAdminFlashcard,
  deleteAdminFlashcard,
  getAdminFlashcard,
  importAdminFlashcards,
  listAdminFlashcards,
  updateAdminFlashcard,
} from "../../controllers/admin/adminFlashcardController";
import { verifyToken } from "../../middlewares/verifyToken";
import { verifyRole } from "../../middlewares/verifyRole";
import { uploadSingleFile } from "../../middlewares/uploadFile";

const router = Router();

router.use(verifyToken, verifyRole(Role.ADMIN));

router.get("/", listAdminFlashcards);
router.post("/", createAdminFlashcard);
router.post("/import", uploadSingleFile, importAdminFlashcards);
router.get("/:id", getAdminFlashcard);
router.put("/:id", updateAdminFlashcard);
router.delete("/:id", deleteAdminFlashcard);

export default router;
