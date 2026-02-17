from typing import List
import base64

import cv2
import numpy as np

from app.schemas import Finding


face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")


def decode_frame(frame_base64: str) -> np.ndarray:
    if "," in frame_base64:
        frame_base64 = frame_base64.split(",", 1)[1]

    decoded = base64.b64decode(frame_base64)
    arr = np.frombuffer(decoded, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)

    if frame is None:
        raise ValueError("Invalid frame payload")

    return frame


def analyze_face_rules(frame: np.ndarray) -> List[Finding]:
    findings: List[Finding] = []

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=6, minSize=(80, 80))

    if len(faces) == 0:
        findings.append(
            Finding(
                eventType="NO_FACE",
                severity=7,
                confidence=0.9,
                meta={"faceCount": 0},
            )
        )
        return findings

    if len(faces) > 1:
        findings.append(
            Finding(
                eventType="MULTIPLE_FACES",
                severity=9,
                confidence=0.95,
                meta={"faceCount": int(len(faces))},
            )
        )

    h, w = frame.shape[:2]

    primary_face = max(faces, key=lambda box: box[2] * box[3])
    x, y, fw, fh = primary_face
    center_x = x + fw / 2

    if center_x < w * 0.25 or center_x > w * 0.75:
        findings.append(
            Finding(
                eventType="HEAD_POSE_OFF_CENTER",
                severity=4,
                confidence=0.72,
                meta={
                    "faceCenterX": center_x,
                    "frameWidth": w,
                },
            )
        )

    face_area_ratio = (fw * fh) / (w * h)
    if face_area_ratio < 0.06:
        findings.append(
            Finding(
                eventType="FACE_TOO_FAR",
                severity=3,
                confidence=0.68,
                meta={"faceAreaRatio": face_area_ratio},
            )
        )

    return findings
