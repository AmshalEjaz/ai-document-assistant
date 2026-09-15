from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import shutil

from pydantic import BaseModel, Field

from services.document_service import extract_text_from_file
from services.embedding_service import store_document
from services.rag_service import answer_question


class ChatRequest(BaseModel):
    message: str
    document_names: list[str] = Field(default_factory=list)


app = FastAPI(
    title="AI Document Assistant API",
    openapi_version="3.0.3"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(
    parents=True,
    exist_ok=True
)


@app.get("/")
def root():
    return {
        "message": "AI Document Assistant backend is running"
    }


@app.post("/api/upload")
async def upload_documents(
    files: list[UploadFile] = File(...)
):
    allowed_extensions = {
        ".pdf",
        ".docx",
        ".txt",
        ".csv",
    }

    results = []

    print("FILES RECEIVED:", len(files))

    for file in files:
        filename = file.filename

        if not filename:
            continue

        safe_filename = Path(filename).name
        extension = Path(safe_filename).suffix.lower()

        print("\n--------------------------")
        print("FILE:", safe_filename)
        print("EXTENSION:", extension)

        if extension not in allowed_extensions:
            print("FAILED: unsupported extension")

            results.append({
                "filename": safe_filename,
                "status": "failed",
                "error": f"Unsupported file type: {extension}",
            })

            await file.close()
            continue

        file_path = UPLOAD_DIR / safe_filename

        try:
            print("STEP 1: Saving file...")

            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(
                    file.file,
                    buffer
                )

            print("STEP 1 DONE:", file_path)

            print("STEP 2: Extracting text...")

            extracted_text = extract_text_from_file(
                file_path
            )

            print(
                "STEP 2 DONE. Characters:",
                len(extracted_text)
            )

            if not extracted_text.strip():
                raise ValueError(
                    "No readable text found in document."
                )

            print("STEP 3: Creating embeddings...")

            chunks_created = store_document(
                extracted_text,
                safe_filename
            )

            print(
                "STEP 3 DONE. Chunks:",
                chunks_created
            )

            results.append({
                "filename": safe_filename,
                "status": "success",
                "characters": len(extracted_text),
                "chunks_created": chunks_created,
            })

        except Exception as exc:
            print(
                "PROCESS ERROR:",
                type(exc).__name__,
                str(exc)
            )

            results.append({
                "filename": safe_filename,
                "status": "failed",
                "error": str(exc),
            })

        finally:
            await file.close()

    successful = sum(
        1
        for item in results
        if item["status"] == "success"
    )

    return {
        "message": (
            f"{successful}/{len(files)} "
            "documents processed successfully"
        ),
        "total_files": len(files),
        "successful": successful,
        "failed": len(files) - successful,
        "documents": results,
    }


@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        print("CHAT REQUEST:", request.message)
        print("DOCUMENTS:", request.document_names)

        result = answer_question(
            request.message,
            request.document_names
        )

        print("RAG RESULT:", result)

        return {
            "answer": result["answer"],
            "source": result.get("source"),
        }

    except Exception as exc:
        print("CHAT ERROR:", repr(exc))

        raise HTTPException(
            status_code=500,
            detail=str(exc)
        )