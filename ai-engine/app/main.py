import time
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.schemas import AnalyzeResponse, AudioAnalyzeRequest, FrameAnalyzeRequest
from app.analyzers.face import decode_frame, analyze_face_rules
from app.analyzers.gaze import analyze_gaze_pose_rules
from app.analyzers.audio import analyze_audio_rules


app = FastAPI(title="AI Proctoring Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/analyze/frame", response_model=AnalyzeResponse)
def analyze_frame(payload: FrameAnalyzeRequest) -> AnalyzeResponse:
    start = time.perf_counter()

    try:
        frame = decode_frame(payload.frameBase64)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid frame: {exc}") from exc

    findings = []
    findings.extend(analyze_face_rules(frame))
    findings.extend(analyze_gaze_pose_rules(frame))

    elapsed = (time.perf_counter() - start) * 1000
    return AnalyzeResponse(findings=findings, processingMs=elapsed)


@app.post("/analyze/audio", response_model=AnalyzeResponse)
def analyze_audio(payload: AudioAnalyzeRequest) -> AnalyzeResponse:
    start = time.perf_counter()
    findings = analyze_audio_rules(payload)
    elapsed = (time.perf_counter() - start) * 1000
    return AnalyzeResponse(findings=findings, processingMs=elapsed)
