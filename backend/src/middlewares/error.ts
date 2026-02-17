import { NextFunction, Request, Response } from "express";

export const notFoundHandler = (_req: Request, res: Response): void => {
  res.status(404).json({ message: "Not found" });
};

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  const isKnown = err instanceof Error;

  res.status(500).json({
    message: isKnown ? err.message : "Internal server error"
  });
};
