from pathlib import Path
from urllib.parse import quote

from bson import ObjectId
from fastapi import HTTPException, UploadFile
from fastapi.responses import Response
from gridfs.errors import NoFile

from lib.db import get_document_files
from models.applicant import ApplicantDocument

MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
ALLOWED_DOCUMENT_TYPES = {
    "application/pdf": ((".pdf",), b"%PDF-"),
    "image/jpeg": ((".jpg", ".jpeg"), b"\xff\xd8\xff"),
    "image/png": ((".png",), b"\x89PNG\r\n\x1a\n"),
}


async def read_document_upload(file: UploadFile) -> tuple[str, str, bytes]:
    try:
        content_type = file.content_type or ""
        allowed = ALLOWED_DOCUMENT_TYPES.get(content_type)
        filename = Path(file.filename or "").name
        if not allowed or not filename:
            raise HTTPException(status_code=415, detail="Upload a PDF, JPG or PNG file")
        extensions, signature = allowed
        if Path(filename).suffix.lower() not in extensions:
            raise HTTPException(status_code=415, detail="File extension does not match its content type")
        content = await file.read(MAX_DOCUMENT_BYTES + 1)
        if len(content) > MAX_DOCUMENT_BYTES:
            raise HTTPException(status_code=413, detail="Document must be 10 MB or smaller")
        if not content.startswith(signature):
            raise HTTPException(status_code=415, detail="File content does not match the selected format")
        return filename, content_type, content
    finally:
        await file.close()


async def document_preview(document: ApplicantDocument) -> Response:
    """Read-only binary response; callers enforce applicant/admin permissions."""
    if not document.file_id:
        raise HTTPException(status_code=404, detail="This record has no stored file")
    if document.content_type not in ALLOWED_DOCUMENT_TYPES:
        raise HTTPException(status_code=415, detail="File type cannot be previewed")
    try:
        grid_out = await get_document_files().open_download_stream(ObjectId(document.file_id))
        content = await grid_out.read()
    except (NoFile, ValueError) as exc:
        raise HTTPException(status_code=404, detail="Stored file not found") from exc
    return Response(
        content=content,
        media_type=document.content_type,
        headers={
            "Content-Disposition": f"inline; filename*=UTF-8''{quote(document.title, safe='')}",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
        },
    )