import { Router } from "express";
import { getProfile, loginUser, registerUser } from "../controllers/authController";
import { verifyToken } from "../middlewares/verifyToken";

const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/profile", verifyToken, getProfile);

export default router;
