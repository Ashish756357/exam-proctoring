import { useMemo, useState } from "react";
import { CandidateExam, LoginResponse } from "./api/client";
import { LoginPage } from "./pages/LoginPage";
import { SystemCheckPage } from "./pages/SystemCheckPage";
import { ExamPage } from "./pages/ExamPage";

type Stage = "login" | "system-check" | "exam" | "submitted";

type ExamState = {
  sessionId: string;
  exam: CandidateExam;
  pairingUrl: string;
};

const loadAuth = (): LoginResponse | null => {
  const raw = localStorage.getItem("candidate_auth");
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as LoginResponse;
  } catch {
    return null;
  }
};

function App() {
  const [auth, setAuth] = useState<LoginResponse | null>(() => loadAuth());
  const [stage, setStage] = useState<Stage>(() => (loadAuth() ? "system-check" : "login"));
  const [examState, setExamState] = useState<ExamState | null>(null);
  const [result, setResult] = useState<{ score: number; status: string } | null>(null);

  const accessToken = useMemo(() => auth?.accessToken ?? "", [auth]);

  if (stage === "login") {
    return (
      <LoginPage
        onLoggedIn={(nextAuth) => {
          localStorage.setItem("candidate_auth", JSON.stringify(nextAuth));
          setAuth(nextAuth);
          setStage("system-check");
        }}
      />
    );
  }

  if (!auth) {
    setStage("login");
    return null;
  }

  if (stage === "system-check") {
    return (
      <SystemCheckPage
        token={accessToken}
        onReady={({ sessionId, exam, pairingUrl }) => {
          setExamState({ sessionId, exam, pairingUrl });
          setStage("exam");
        }}
      />
    );
  }

  if (stage === "exam" && examState) {
    return (
      <ExamPage
        token={accessToken}
        sessionId={examState.sessionId}
        exam={examState.exam}
        pairingUrl={examState.pairingUrl}
        onSubmitted={(summary) => {
          setResult(summary);
          setStage("submitted");
        }}
      />
    );
  }

  return (
    <main className="layout center">
      <section className="card login-card">
        <h2>Submission Complete</h2>
        <p>Auto score: {result?.score ?? 0}</p>
        <p>Status: {result?.status ?? "PENDING"}</p>
        <button
          onClick={() => {
            localStorage.removeItem("candidate_auth");
            setAuth(null);
            setExamState(null);
            setResult(null);
            setStage("login");
          }}
        >
          Sign out
        </button>
      </section>
    </main>
  );
}

export default App;
