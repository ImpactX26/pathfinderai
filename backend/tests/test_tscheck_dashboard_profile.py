import pytest


def test_dashboard_profile_contains_workspace_assessment(client):
    response = client.get("/applicant")
    assert response.status_code == 200, response.text
    profile = response.json()
    assert profile["id"] == "demo-applicant"
    assert profile["name"]
    assert profile["pathway"] in {"study", "vocational", "employment"}
    assert isinstance(profile["documents"], list)
    assert isinstance(profile["profile_completion"], int)
    assert profile["qualification_label"]
    assert profile["recommended_next_step"]
    assert {step["label"] for step in profile["agent_steps"]} >= {
        "Profile assembled",
        "Evidence mapped",
        "Requirements checked",
        "Next step selected",
    }
