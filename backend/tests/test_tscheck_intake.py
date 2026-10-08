def test_intake_updates_applicant_assessment(client):
    payload = {
        "name": "tscheck-journey-applicant",
        "email": "tscheck-journey@example.com",
        "city": "Pune, India",
        "pathway": "study",
        "education": "B.Tech Software Engineering",
        "german_level": "B1",
        "english_level": "C1",
        "experience_years": 2,
        "motivation": "tscheck applicant wants to study sustainable technology in Germany.",
    }
    response = client.post("/applicant/intake", json=payload)
    assert response.status_code == 200, response.text
    profile = response.json()
    assert profile["id"] == "demo-applicant"
    assert profile["name"] == payload["name"]
    assert profile["city"] == payload["city"]
    assert profile["profile_completion"] >= 0
    assert profile["recommended_next_step"]
    assert len(profile["agent_steps"]) == 4


def test_intake_rejects_invalid_payload(client):
    response = client.post("/applicant/intake", json={"name": "x"})
    assert response.status_code == 422, response.text
