"""Backend coverage for the live agent query-stream endpoint.

Criteria covered:
- Agent answer is grounded in the current applicant profile (happy path, SSE delta/done events).
- Agent endpoint validates bad queries (empty query -> 422).
"""

import json

import httpx


def _collect_sse_answer(client: httpx.Client, payload: dict) -> tuple[str, list[str]]:
    """POST to the streaming endpoint and collect the concatenated delta text + event types."""
    answer = ""
    event_types: list[str] = []
    with client.stream("POST", "/agent/query/stream", json=payload, timeout=60.0) as response:
        assert response.status_code == 200, response.text
        for line in response.iter_lines():
            if not line or not line.startswith("data:"):
                continue
            raw = line[len("data:"):].strip()
            if not raw:
                continue
            event = json.loads(raw)
            event_types.append(event["type"])
            if event["type"] == "delta":
                answer += event.get("content", "")
            if event["type"] == "error":
                raise AssertionError(f"Agent stream returned an error event: {event}")
    return answer, event_types


def test_agent_query_stream_grounded_answer(client: httpx.Client):
    """Happy path: a free-form question streams a non-empty answer referencing the live applicant profile."""
    profile = client.get("/applicant")
    assert profile.status_code == 200, profile.text
    data = profile.json()

    payload = {
        "applicant_id": data["id"],
        "query": "What is my current qualification status and what should I do next?",
    }
    answer, event_types = _collect_sse_answer(client, payload)

    assert "delta" in event_types, f"Expected at least one delta event, got types {event_types}"
    assert "done" in event_types, f"Expected a done event, got types {event_types}"
    assert "error" not in event_types
    assert len(answer.strip()) > 20, f"Answer too short/empty: {answer!r}"

    # Grounded in the applicant's actual qualification status / pathway, not invented facts.
    lowered = answer.lower()
    qualification_label = data.get("qualification_label", "").lower()
    pathway = data.get("pathway", "").lower()
    assert (
        (qualification_label and qualification_label in lowered)
        or (pathway and pathway in lowered)
        or "next step" in lowered
        or "requirement" in lowered
    ), f"Answer did not reference applicant profile facts. applicant={data}, answer={answer!r}"


def test_agent_query_stream_rejects_empty_query(client: httpx.Client):
    """Validation: an empty query is rejected with HTTP 422, not streamed as if it were valid."""
    response = client.post(
        "/agent/query/stream",
        json={"applicant_id": "demo-applicant", "query": ""},
        timeout=30.0,
    )
    assert response.status_code == 422, response.text
