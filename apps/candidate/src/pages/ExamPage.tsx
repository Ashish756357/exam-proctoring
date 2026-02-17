import { useEffect, useMemo, useRef, useState } from "react";
import { api, CandidateExam, ExamQuestion } from "../api/client";
import { useAntiCheat } from "../hooks/useAntiCheat";
import { useWebRtcSignaling } from "../hooks/useWebRtcSignaling";
import { ViolationBanner } from "../components/ViolationBanner";

type Props = {
  token: string;
  sessionId: string;
  exam: CandidateExam;
  pairingUrl: string;
  onSubmitted: (summary: { score: number; status: string }) => void;
};

type Violation = {
  eventType: string;
  severity: number;
};

const defaultAnswerFor = (question: ExamQuestion): unknown => {
  if (question.type === "MCQ") {
    return { mcqOptionId: "" };
  }

  if (question.type === "CODING") {
    return { code: "", language: "javascript" };
  }

  return { text: "" };
};

export const ExamPage = ({ token, sessionId, exam, pairingUrl, onSubmitted }: Props) => {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [violations, setViolations] = useState<Violation[]>([]);

  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  const { status: rtcStatus, mobilePaired } = useWebRtcSignaling({
    token,
    sessionId,
    webcamStream,
    screenStream
  });

  useAntiCheat({
    token,
    sessionId,
    enabled: true,
    onViolation: (violation) => {
      setViolations((prev) => [...prev, { eventType: violation.eventType, severity: violation.severity }]);
    }
  });

  useEffect(() => {
    const init = async () => {
      try {
        const cam = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });

        setWebcamStream(cam);
        setScreenStream(screen);

        if (webcamVideoRef.current) {
          webcamVideoRef.current.srcObject = cam;
        }

        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = screen;
        }
      } catch {
        setError("Unable to capture webcam/screen streams.");
      }
    };

    init().catch(() => setError("Failed to initialize media streams."));

    return () => {
      webcamStream?.getTracks().forEach((track) => track.stop());
      screenStream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const totalViolations = violations.length;
  const lastViolation = violations.length > 0 ? violations[violations.length - 1] : undefined;

  const answeredCount = useMemo(() => {
    return Object.keys(answers).length;
  }, [answers]);

  const saveAnswer = async (question: ExamQuestion, value: unknown) => {
    setAnswers((prev) => ({
      ...prev,
      [question.id]: value
    }));

    setSaving((prev) => ({ ...prev, [question.id]: true }));

    try {
      await api.saveAnswer(token, sessionId, {
        questionId: question.id,
        answerType: question.type,
        responseJson: value
      });
    } catch {
      setError("Failed to save an answer. Retrying is recommended.");
    } finally {
      setSaving((prev) => ({ ...prev, [question.id]: false }));
    }
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const result = await api.submitSession(token, sessionId);
      onSubmitted({ score: result.autoScore ?? 0, status: result.status ?? "PENDING" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="layout exam-layout">
      <aside className="card aside-panel">
        <h3>{exam.title}</h3>
        <p>{exam.instructions}</p>
        <p>RTC: {rtcStatus}</p>
        <p>Mobile camera: {mobilePaired ? "Connected" : "Waiting"}</p>
        <p>Pair URL: {pairingUrl}</p>
        <p>
          Answered: {answeredCount}/{exam.questions.length}
        </p>

        <ViolationBanner count={totalViolations} last={lastViolation} />

        <div className="preview-stack">
          <video ref={webcamVideoRef} autoPlay muted playsInline />
          <video ref={screenVideoRef} autoPlay muted playsInline />
        </div>

        <button onClick={submit} disabled={submitting}>
          {submitting ? "Submitting..." : "Submit Exam"}
        </button>
      </aside>

      <section className="card questions-panel">
        <h2>Questions</h2>

        {exam.questions.map((question) => {
          const value = answers[question.id] ?? defaultAnswerFor(question);
          const isSaving = Boolean(saving[question.id]);

          return (
            <article key={question.id} className="question-card">
              <h4>{question.prompt}</h4>

              {question.type === "MCQ" ? (
                <div className="option-list">
                  {(question.optionsJson?.choices ?? []).map((option) => (
                    <label key={option.id}>
                      <input
                        type="radio"
                        name={question.id}
                        checked={(value as { mcqOptionId?: string }).mcqOptionId === option.id}
                        onChange={() => saveAnswer(question, { mcqOptionId: option.id })}
                      />
                      {option.text}
                    </label>
                  ))}
                </div>
              ) : null}

              {question.type === "CODING" ? (
                <textarea
                  rows={8}
                  placeholder="Write your code here"
                  value={(value as { code?: string }).code ?? ""}
                  onChange={(event) =>
                    saveAnswer(question, { code: event.target.value, language: "javascript" })
                  }
                />
              ) : null}

              {question.type === "SUBJECTIVE" ? (
                <textarea
                  rows={6}
                  placeholder="Write your answer"
                  value={(value as { text?: string }).text ?? ""}
                  onChange={(event) => saveAnswer(question, { text: event.target.value })}
                />
              ) : null}

              {isSaving ? <p className="tiny">Saving...</p> : null}
            </article>
          );
        })}
      </section>

      {error ? <p className="error floating-error">{error}</p> : null}
    </main>
  );
};
