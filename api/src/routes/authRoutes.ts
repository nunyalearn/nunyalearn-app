import { Router } from "express";
import {
  getProfile,
  loginUser,
  refreshAccessToken,
  registerUser,
  logoutUser,
  requestPasswordReset,
  resetPassword,
} from "../controllers/authController";
import { verifyToken } from "../middlewares/verifyToken";

const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/refresh", refreshAccessToken);
router.post("/logout", verifyToken, logoutUser);
router.post("/request-reset", requestPasswordReset);
router.post("/reset", resetPassword);
router.get("/profile", verifyToken, getProfile);

export default router;
