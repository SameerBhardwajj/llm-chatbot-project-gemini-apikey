import json

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .config import FRONTEND_ORIGIN
from .llm import stream_response
from .schemas import ChatRequest

app = FastAPI(
    title="LLM Chatbot Learning API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health():
    return {"status": "ok"}

def sse_event(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"

@app.post("/api/chat")
def chat(request: ChatRequest):
    messages = [
        {"role": m.role, "content": m.content}
        for m in request.messages
    ]

    def event_generator():
        try:
            for event in stream_response(messages):
                yield sse_event(event)
        except Exception as exc:
            yield sse_event({"type": "error", "message": str(exc)})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )