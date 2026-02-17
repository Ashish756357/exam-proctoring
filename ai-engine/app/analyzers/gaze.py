from typing import List

import numpy as np

from app.schemas import Finding

try:
    import mediapipe as mp
except Exception:  # pragma: no cover - runtime optional dependency guard
    mp = None


def _build_face_mesh():
    if mp is None:
        return None

    solutions = getattr(mp, "solutions", None)
    if solutions is None or not hasattr(solutions, "face_mesh"):
        return None

    return solutions.face_mesh.FaceMesh(
        static_image_mode=True,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
    )


face_mesh = _build_face_mesh()


def analyze_gaze_pose_rules(frame: np.ndarray) -> List[Finding]:
    findings: List[Finding] = []

    if face_mesh is None:
        return findings

    rgb = frame[:, :, ::-1]
    result = face_mesh.process(rgb)

    if not result.multi_face_landmarks:
        return findings

    landmarks = result.multi_face_landmarks[0].landmark

    left_eye = landmarks[33]
    right_eye = landmarks[263]
    nose_tip = landmarks[1]

    horizontal = max(1e-6, right_eye.x - left_eye.x)
    nose_ratio = (nose_tip.x - left_eye.x) / horizontal

    if nose_ratio < 0.35 or nose_ratio > 0.65:
        findings.append(
            Finding(
                eventType="LOOKING_AWAY",
                severity=5,
                confidence=0.74,
                meta={"noseRatio": float(nose_ratio)},
            )
        )

    eye_line_y = (left_eye.y + right_eye.y) / 2
    pitch_delta = nose_tip.y - eye_line_y

    if pitch_delta < -0.02:
        findings.append(
            Finding(
                eventType="HEAD_PITCH_UP",
                severity=3,
                confidence=0.61,
                meta={"pitchDelta": float(pitch_delta)},
            )
        )

    if pitch_delta > 0.15:
        findings.append(
            Finding(
                eventType="HEAD_PITCH_DOWN",
                severity=3,
                confidence=0.61,
                meta={"pitchDelta": float(pitch_delta)},
            )
        )

    return findings
