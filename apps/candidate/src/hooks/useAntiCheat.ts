import { useEffect } from "react";
import { api } from "../api/client";

type Violation = {
  eventType: string;
  severity: number;
  meta?: Record<string, unknown>;
};

type UseAntiCheatInput = {
  token: string;
  sessionId: string;
  enabled: boolean;
  onViolation: (violation: Violation) => void;
};

export const useAntiCheat = ({ token, sessionId, enabled, onViolation }: UseAntiCheatInput): void => {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const publish = async (eventType: string, severity: number, meta?: Record<string, unknown>) => {
      onViolation({ eventType, severity, meta });

      try {
        await api.sendViolation(token, {
          sessionId,
          source: "LAPTOP",
          eventType,
          severity,
          meta
        });
      } catch {
        // Best-effort logging.
      }
    };

    const contextHandler = (event: Event) => {
      event.preventDefault();
      void publish("RIGHT_CLICK", 2);
    };

    const clipboardHandler = (event: Event) => {
      event.preventDefault();
      void publish("CLIPBOARD_BLOCK", 4);
    };

    const blurHandler = () => {
      void publish("WINDOW_BLUR", 5);
    };

    const visibilityHandler = () => {
      if (document.visibilityState === "hidden") {
        void publish("TAB_SWITCH", 6);
      }
    };

    const fullscreenHandler = () => {
      if (!document.fullscreenElement) {
        void publish("EXIT_FULLSCREEN", 7);
      }
    };

    document.addEventListener("contextmenu", contextHandler);
    document.addEventListener("copy", clipboardHandler);
    document.addEventListener("cut", clipboardHandler);
    document.addEventListener("paste", clipboardHandler);
    window.addEventListener("blur", blurHandler);
    document.addEventListener("visibilitychange", visibilityHandler);
    document.addEventListener("fullscreenchange", fullscreenHandler);

    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {
        void publish("FULLSCREEN_DENIED", 4);
      });
    }

    return () => {
      document.removeEventListener("contextmenu", contextHandler);
      document.removeEventListener("copy", clipboardHandler);
      document.removeEventListener("cut", clipboardHandler);
      document.removeEventListener("paste", clipboardHandler);
      window.removeEventListener("blur", blurHandler);
      document.removeEventListener("visibilitychange", visibilityHandler);
      document.removeEventListener("fullscreenchange", fullscreenHandler);
    };
  }, [enabled, onViolation, sessionId, token]);
};
