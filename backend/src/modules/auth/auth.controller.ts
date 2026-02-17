import { Request, Response } from "express";
import { z } from "zod";
import { authService } from "./auth.service";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  deviceFingerprint: z.string().min(8),
  ipAddress: z.string().min(3)
});

const refreshSchema = z.object({
  refreshToken: z.string().min(16),
  deviceFingerprint: z.string().min(8),
  ipAddress: z.string().min(3)
});

const logoutSchema = z.object({
  refreshToken: z.string().min(16)
});

export const authController = {
  async login(req: Request, res: Response): Promise<void> {
    const input = loginSchema.parse(req.body);
    const output = await authService.login(input);

    res.status(200).json({
      ...output,
      accessTokenExpiresIn: 900
    });
  },

  async refresh(req: Request, res: Response): Promise<void> {
    const input = refreshSchema.parse(req.body);
    const output = await authService.refresh(input);

    res.status(200).json({
      ...output,
      accessTokenExpiresIn: 900
    });
  },

  async logout(req: Request, res: Response): Promise<void> {
    const input = logoutSchema.parse(req.body);
    await authService.logout(input.refreshToken);

    res.status(200).json({ loggedOut: true });
  }
};
