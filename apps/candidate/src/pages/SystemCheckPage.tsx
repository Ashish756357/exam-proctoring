import { useEffect, useState } from "react";
import { api, CandidateExam } from "../api/client";
import { MobilePairingCard } from "../components/MobilePairingCard";

type ReadyPayload = {
  sessionId: string;
  exam: CandidateExam;
  pairingUrl: string;
  pairingExpiresIn: number;
};

type Props = {
  token: string;
  onReady: (payload: ReadyPayload) => void;
};

export const SystemCheckPage = ({ token, onReady }: Props) => {
  const [examId, setExamId] = useState("");
  const [assigned, setAssigned] = useState<Array<{ id: string; title: string; durationMinutes: number }>>([]);
  const [checks, setChecks] = useState({ camera: false, microphone: false, screen: false });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pairing, setPairing] = useState<{ url: string; expiresIn: number } | null>(null);

  useEffect(() => {
    api
      .getAssigned(token)
      .then((result) => {
        setAssigned(result.items);
        if (result.items.length > 0) {
          setExamId(result.items[0].id);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load exams"));
  }, [token]);

  const runChecks = async () => {
    setError(null);

    try {
      const camMic = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });

      setChecks({ camera: true, microphone: true, screen: true });

      camMic.getTracks().forEach((track) => track.stop());
      screen.getTracks().forEach((track) => track.stop());
    } catch {
      setError("System check failed. Camera, microphone, and screen access are mandatory.");
      setChecks({ camera: false, microphone: false, screen: false });
    }
  };

  const startExam = async () => {
    if (!checks.camera || !checks.microphone || !checks.screen) {
      setError("Run and pass system checks first.");
      return;
    }

    if (!examId) {
      setError("Select an exam.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const session = await api.startSession(token, examId);
      const exam = await api.getExam(token, examId);
      const pair = await api.createPairingToken(token, session.sessionId);

      setPairing({
        url: pair.pairingUrl,
        expiresIn: pair.expiresInSeconds
      });

      onReady({
        sessionId: session.sessionId,
        exam,
        pairingUrl: pair.pairingUrl,
        pairingExpiresIn: pair.expiresInSeconds
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start exam session");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="layout">
      <section className="card">
        <h2>System Check</h2>
        <p>Complete mandatory checks before launching the exam environment.</p>

        <label>
          Assigned Exam
          <select value={examId} onChange={(event) => setExamId(event.target.value)}>
            {assigned.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.title} ({exam.durationMinutes} min)
              </option>
            ))}
          </select>
        </label>

        <div className="check-grid">
          <div>Camera: {checks.camera ? "OK" : "Pending"}</div>
          <div>Microphone: {checks.microphone ? "OK" : "Pending"}</div>
          <div>Screen Capture: {checks.screen ? "OK" : "Pending"}</div>
        </div>

        <div className="action-row">
          <button onClick={runChecks}>Run Checks</button>
          <button onClick={startExam} disabled={loading || !examId}>
            {loading ? "Starting..." : "Start Exam"}
          </button>
        </div>

        {error ? <p className="error">{error}</p> : null}
      </section>

      {pairing ? <MobilePairingCard pairingUrl={pairing.url} expiresInSeconds={pairing.expiresIn} /> : null}
    </main>
  );
};
