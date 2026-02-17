import { Router } from "express";
import { authRouter } from "./auth.routes";
import { examsRouter } from "./exams.routes";
import { sessionsRouter } from "./sessions.routes";
import { pairingRouter } from "./pairing.routes";
import { proctoringRouter } from "./proctoring.routes";
import { adminRouter } from "./admin.routes";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", now: new Date().toISOString() });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/exams", examsRouter);
apiRouter.use("/sessions", sessionsRouter);
apiRouter.use("/pairing", pairingRouter);
apiRouter.use("/proctoring", proctoringRouter);
apiRouter.use("/admin", adminRouter);
