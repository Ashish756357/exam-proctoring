from typing import List

from app.schemas import Finding, AudioAnalyzeRequest


def analyze_audio_rules(payload: AudioAnalyzeRequest) -> List[Finding]:
    findings: List[Finding] = []

    if payload.voiceCount is not None and payload.voiceCount > 1:
        findings.append(
            Finding(
                eventType="MULTIPLE_VOICES",
                severity=8,
                confidence=0.88,
                meta={"voiceCount": payload.voiceCount},
            )
        )

    if payload.mobileSoundDetected:
        findings.append(
            Finding(
                eventType="MOBILE_SOUND",
                severity=6,
                confidence=0.78,
                meta={},
            )
        )

    if payload.audioLevel > 0.72:
        findings.append(
            Finding(
                eventType="BACKGROUND_SPEECH",
                severity=5,
                confidence=min(0.95, payload.audioLevel),
                meta={"audioLevel": payload.audioLevel},
            )
        )

    return findings
