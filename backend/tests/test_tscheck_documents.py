import os
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv
from pymongo import MongoClient


load_dotenv(Path(__file__).parent.parent / ".env")


def test_document_addition_returns_reviewed_applicant_evidence(client):
    title = f"tscheck-journey-evidence-{uuid4()}.pdf"
    original_profile = client.get("/applicant").json()
    try:
        response = client.post("/applicant/documents", json={"kind": "cv", "title": title})
        assert response.status_code == 200, response.text
        profile = response.json()
        added = [document for document in profile["documents"] if document["title"] == title]
        assert len(added) == 1
        assert added[0]["kind"] == "cv"
        assert added[0]["status"] == "review"
        assert added[0]["source"] == "applicant-provided"
    finally:
        mongo = MongoClient(os.environ["MONGO_URL"])
        mongo[os.environ["DB_NAME"]].applicant_profiles.replace_one(
            {"id": original_profile["id"]}, original_profile, upsert=True
        )
        mongo.close()


def test_document_rejects_unknown_kind(client):
    response = client.post("/applicant/documents", json={"kind": "passport", "title": "tscheck-invalid.pdf"})
    assert response.status_code == 422, response.text
