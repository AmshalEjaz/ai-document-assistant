import os
import time

from dotenv import load_dotenv
from google import genai

from services.embedding_service import search_documents


load_dotenv()

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)

PRIMARY_MODEL = "gemini-3.7-flash"
FALLBACK_MODEL = "gemini-2.5-flash"


def generate_with_retry(prompt: str):
    models = [
        PRIMARY_MODEL,
        FALLBACK_MODEL,
    ]

    last_error = None

    for model_name in models:

        for attempt in range(3):
            try:
                print(
                    f"Gemini model: {model_name}, "
                    f"attempt: {attempt + 1}"
                )

                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                )

                return response

            except Exception as exc:
                last_error = exc

                print(
                    "GEMINI ERROR:",
                    model_name,
                    repr(exc)
                )

                error_text = str(exc)

                if (
                    "503" in error_text
                    or "UNAVAILABLE" in error_text
                    or "high demand" in error_text.lower()
                ):
                    time.sleep(
                        2 * (attempt + 1)
                    )
                    continue

                raise

    raise last_error


def answer_question(
    question: str,
    document_names: list[str]
):
    matches = search_documents(
        question,
        document_names=document_names,
        n_results=5,
    )

    if not matches:
        return {
            "answer": (
                "I could not find relevant information "
                "in the selected document."
            ),
            "source": None,
        }

    context_parts = []
    sources = []

    for match in matches:
        filename = match["filename"]
        text = match["text"]

        context_parts.append(
            f"Source: {filename}\n{text}"
        )

        if filename and filename not in sources:
            sources.append(filename)

    context = "\n\n---\n\n".join(context_parts)

    prompt = f"""
You are an AI document assistant.

Answer the user's question using ONLY the provided
document context.

Rules:
- Use only the selected uploaded document(s).
- Never use information from older documents.
- Do not use outside knowledge.
- If the answer is not present, say that it was not found.
- Format the answer in clean Markdown.

DOCUMENT CONTEXT:

{context}

USER QUESTION:

{question}
"""

    response = generate_with_retry(prompt)

    return {
        "answer": response.text,
        "source": ", ".join(sources),
    }
    matches = search_documents(
        question,
        n_results=5,
    )

    if not matches:
        return {
            "answer":
                "I could not find relevant information in the uploaded documents.",
            "source": None,
        }

    context_parts = []
    sources = []

    for match in matches:
        filename = match["filename"]
        text = match["text"]

        context_parts.append(
            f"Source: {filename}\n{text}"
        )

        if (
            filename
            and filename not in sources
        ):
            sources.append(filename)

    context = "\n\n---\n\n".join(
        context_parts
    )

    prompt = f"""
You are an AI document assistant.

Answer the user's question using ONLY the
document context provided below.

Rules:
- Do not invent information.
- Do not use outside knowledge.
- If the answer is not present in the context,
  clearly say that it was not found.
- Keep the answer concise and clear.
- Preserve important dates, names, numbers,
  amounts, and facts.

DOCUMENT CONTEXT:

{context}

USER QUESTION:

{question}
"""

    response = generate_with_retry(
        prompt
    )

    answer = (
        response.text
        or "I could not generate an answer."
    )

    return {
        "answer": answer,
        "source": ", ".join(sources),
    }