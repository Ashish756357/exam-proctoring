import { Router } from "express";
import { authController } from "../modules/auth/auth.controller";
import { authRateLimiter } from "../middlewares/rateLimit";

export const authRouter = Router();

authRouter.post("/login", authRateLimiter, (req, res, next) => {
  authController.login(req, res).catch(next);
});

authRouter.post("/refresh", authRateLimiter, (req, res, next) => {
  authController.refresh(req, res).catch(next);
});

authRouter.post("/logout", authRateLimiter, (req, res, next) => {
  authController.logout(req, res).catch(next);
});
