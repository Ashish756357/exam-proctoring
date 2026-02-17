from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class FrameAnalyzeRequest(BaseModel):
    sessionId: str
    source: str
    frameBase64: str


class AudioAnalyzeRequest(BaseModel):
    sessionId: str
    source: str
    audioLevel: float = Field(default=0.0)
    voiceCount: Optional[int] = None
    mobileSoundDetected: bool = Field(default=False)


class Finding(BaseModel):
    eventType: str
    severity: int
    confidence: float
    meta: Dict[str, Any] = Field(default_factory=dict)


class AnalyzeResponse(BaseModel):
    findings: List[Finding] = Field(default_factory=list)
    processingMs: float
