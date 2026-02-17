import { FormEvent, useEffect, useRef, useState } from "react";
import { mobileApi } from "./api/client";
import { useMobileSignaling } from "./hooks/useMobileSignaling";
import "./styles.css";

const readTokenFromQuery = (): string => {
  const query = new URLSearchParams(window.location.search);
  return query.get("token") ?? "";
};

function App() {
  const [pairingToken, setPairingToken] = useState(readTokenFromQuery());
  const [mobileJwt, setMobileJwt] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const rtcStatus = useMobileSignaling({
    mobileToken: mobileJwt,
    sessionId,
    stream
  });

  useEffect(() => {
    if (!mobileJwt || !sessionId) {
      return;
    }

    let active = true;
    setPreviewReady(false);
    setError(null);

    const attachStream = async (cam: MediaStream) => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      streamRef.current = cam;
      setStream(cam);

      if (videoRef.current) {
        videoRef.current.srcObject = cam;
        await videoRef.current.play().catch(() => {
          // Some browsers block autoplay until user interaction.
        });
      }

      setPreviewReady(true);
    };

    const initCamera = async (): Promise<void> => {
      try {
        const rearCamera = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" }
          },
          audio: true
        });

        if (!active) {
          rearCamera.getTracks().forEach((track) => track.stop());
          return;
        }

        await attachStream(rearCamera);
      } catch {
        try {
          const fallbackCamera = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
          });

          if (!active) {
            fallbackCamera.getTracks().forEach((track) => track.stop());
            return;
          }

          await attachStream(fallbackCamera);
        } catch {
          setError("Camera access failed. Allow camera and microphone permissions.");
        }
      }
    };

    initCamera().catch(() => setError("Failed to start mobile camera."));

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
      setPreviewReady(false);
    };
  }, [mobileJwt, sessionId]);

  useEffect(() => {
    if (!mobileJwt || !sessionId) {
      return;
    }

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        mobileApi
          .sendViolation(mobileJwt, {
            sessionId,
            eventType: "MOBILE_APP_HIDDEN",
            severity: 6,
            meta: { state: document.visibilityState }
          })
          .catch(() => {
            // Best-effort report.
          });
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [mobileJwt, sessionId]);

  const claimPairing = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const claimed = await mobileApi.claimPairing(pairingToken);
      setMobileJwt(claimed.mobileSessionJwt);
      setSessionId(claimed.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pairing failed");
    } finally {
      setLoading(false);
    }
  };

  if (!mobileJwt) {
    return (
      <main className="mobile-shell">
        <section className="mobile-card">
          <h1>Mobile Proctor Camera</h1>
          <p>Scan the candidate QR code and confirm pairing token.</p>

          <form onSubmit={claimPairing}>
            <input
              value={pairingToken}
              onChange={(e) => setPairingToken(e.target.value)}
              placeholder="pair_xxx token"
              required
            />
            <button type="submit" disabled={loading || pairingToken.length < 8}>
              {loading ? "Claiming..." : "Pair Session"}
            </button>
          </form>

          {error ? <p className="error">{error}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="mobile-shell">
      <section className="mobile-card">
        <h2>Session {sessionId.slice(0, 8)}</h2>
        <p>Status: {rtcStatus}</p>
        <p>Keep this app in foreground until exam ends.</p>
        <p>{previewReady ? "Live phone camera preview" : "Starting phone camera preview..."}</p>
        <video ref={videoRef} autoPlay playsInline muted />
        {error ? <p className="error">{error}</p> : null}
      </section>
    </main>
  );
}

export default App;
