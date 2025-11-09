import { Router } from "express";
import { Role } from "@prisma/client";
import {
  bulkImportQuestions,
  createQuestionBankItem,
  deleteQuestionBankItem,
  getQuestionBankItem,
  listQuestionBank,
  updateQuestionBankItem,
} from "../../controllers/admin/adminQuestionBankController";
import { verifyToken } from "../../middlewares/verifyToken";
import { verifyRole } from "../../middlewares/verifyRole";

const router = Router();

router.use(verifyToken, verifyRole(Role.ADMIN));

router.get("/", listQuestionBank);
router.post("/", createQuestionBankItem);
router.post("/bulk", bulkImportQuestions);
router.get("/:id", getQuestionBankItem);
router.put("/:id", updateQuestionBankItem);
router.delete("/:id", deleteQuestionBankItem);

export default router;
