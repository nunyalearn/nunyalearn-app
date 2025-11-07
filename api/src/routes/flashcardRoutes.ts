import { Router } from "express";
import { createFlashcard, getFlashcards } from "../controllers/flashcardController";
import { verifyToken } from "../middlewares/verifyToken";

const router = Router();

router.get("/", getFlashcards);
router.post("/", verifyToken, createFlashcard);

export default router;
