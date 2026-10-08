def test_document_addition_returns_reviewed_applicant_evidence(client):
    title = "tscheck-journey-evidence.pdf"
    response = client.post("/applicant/documents", json={"kind": "cv", "title": title})
    assert response.status_code == 200, response.text
    profile = response.json()
    added = [document for document in profile["documents"] if document["title"] == title]
    assert len(added) == 1
    assert added[0]["kind"] == "cv"
    assert added[0]["status"] == "review"
    assert added[0]["source"] == "applicant-provided"


def test_document_rejects_unknown_kind(client):
    response = client.post("/applicant/documents", json={"kind": "passport", "title": "tscheck-invalid.pdf"})
    assert response.status_code == 422, response.text
