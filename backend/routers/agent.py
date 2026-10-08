import json
import logging
import os

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from models.agent import AgentQuery
from routers.applicant import get_applicant


router = APIRouter(prefix="/agent", tags=["agent"])
logger = logging.getLogger(__name__)


def stream_event(payload: dict[str, str]) -> str:
    return f"data: {json.dumps(payload)}\n\n"


@router.post("/query/stream")
async def query_agent(input: AgentQuery) -> StreamingResponse:
    api_key = os.environ.get("AICREDITS_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="The agent provider is not configured")

    profile = await get_applicant()
    missing = ", ".join(profile.missing_items) if profile.missing_items else "none"
    system_message = f"""
You are Educaro, a precise and encouraging Germany applicant journey agent.
Answer the applicant's question directly and practically. Use the applicant context below, but never invent facts, documents, eligibility, visa outcomes, university admissions, or legal advice. If something is unknown, say what evidence or clarification is needed. Distinguish applicant-provided facts from recommendations. Keep answers concise (2-5 short paragraphs or bullets) and end with one useful next action when appropriate.

Applicant context (applicant-provided unless marked otherwise):
- Name: {profile.name}
- Current city: {profile.city}
- Pathway: {profile.pathway}
- Education: {profile.education}
- German level: {profile.german_level}
- English level: {profile.english_level}
- Experience: {profile.experience_years} years
- Motivation: {profile.motivation}
- Documents on file: {len(profile.documents)}
- Current qualification signal: {profile.qualification_label}
- Open requirements: {missing}

The user asks: {input.query}
""".strip()

    async def event_stream():
        try:
            payload = {
                "model": os.environ.get("AICREDITS_MODEL", "openai/gpt-5.4"),
                "messages": [
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": input.query},
                ],
                "stream": True,
            }
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "Accept": "text/event-stream",
            }
            timeout = httpx.Timeout(90.0, connect=15.0)
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream(
                    "POST",
                    "https://api.aicredits.in/v1/chat/completions",
                    headers=headers,
                    json=payload,
                ) as response:
                    if response.status_code >= 400:
                        provider_error = (await response.aread()).decode("utf-8", errors="replace")
                        logger.error("AICredits agent error %s: %s", response.status_code, provider_error[:500])
                        yield stream_event({"type": "error", "content": "The live agent provider rejected the request. Check the AICredits balance and key settings."})
                        return

                    async for line in response.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        raw = line[6:]
                        if raw == "[DONE]":
                            yield stream_event({"type": "done", "content": ""})
                            return
                        chunk = json.loads(raw)
                        choices = chunk.get("choices", [])
                        if choices:
                            content = choices[0].get("delta", {}).get("content")
                            if content:
                                yield stream_event({"type": "delta", "content": content})
                    yield stream_event({"type": "done", "content": ""})
        except Exception as exc:
            logger.exception("Educaro agent stream failed: %s", exc)
            yield stream_event({"type": "error", "content": "The live agent could not answer right now."})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )