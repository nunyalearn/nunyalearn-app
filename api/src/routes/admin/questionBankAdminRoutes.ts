import { Router } from "express";
import { Role } from "@prisma/client";
import {
  createQuestion,
  deactivateQuestion,
  exportQuestions,
  downloadQuestionTemplate,
  getQuestion,
  getQuestions,
  importQuestions,
  reactivateQuestion,
  updateQuestion,
} from "../../controllers/admin/adminQuestionBankController";
import { verifyToken } from "../../middlewares/verifyToken";
import { verifyRole } from "../../middlewares/verifyRole";
import { uploadSingleFile } from "../../middlewares/uploadFile";

const router = Router();

router.use(verifyToken, verifyRole(Role.ADMIN));

router.get("/", getQuestions);
router.get("/export", exportQuestions);
router.get("/template", downloadQuestionTemplate);
router.post("/", createQuestion);
router.post("/import", uploadSingleFile, importQuestions);
router.get("/:id", getQuestion);
router.put("/:id", updateQuestion);
router.patch("/:id/deactivate", deactivateQuestion);
router.patch("/:id/reactivate", reactivateQuestion);

export default router;
