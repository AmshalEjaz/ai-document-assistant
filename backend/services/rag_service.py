import os
import time

from dotenv import load_dotenv
from google import genai

from services.embedding_service import (
    search_documents,
)


load_dotenv()


# ---------------------------------------------------------
# Gemini configuration
# ---------------------------------------------------------

GEMINI_API_KEY = os.getenv(
    "GEMINI_API_KEY"
)


if not GEMINI_API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY is missing from .env"
    )


client = genai.Client(
    api_key=GEMINI_API_KEY
)


PRIMARY_MODEL = (
    "gemini-3.7-flash"
)

FALLBACK_MODEL = (
    "gemini-3.6-flash"
)


# ---------------------------------------------------------
# Gemini request with retry/fallback
# ---------------------------------------------------------

def generate_with_retry(
    prompt: str,
):

    models = [
        PRIMARY_MODEL,
        FALLBACK_MODEL,
    ]

    last_error = None

    for model_name in models:

        for attempt in range(
            3
        ):

            try:

                print(
                    f"Gemini model: "
                    f"{model_name}, "
                    f"attempt: "
                    f"{attempt + 1}"
                )

                response = (
                    client.models.generate_content(
                        model=
                            model_name,

                        contents=
                            prompt,
                    )
                )

                return response

            except Exception as exc:

                last_error = exc

                print(
                    "GEMINI ERROR:",
                    model_name,
                    repr(exc),
                )

                error_text = str(
                    exc
                ).lower()

                # Temporary Gemini errors
                if (
                    "503"
                    in error_text

                    or "unavailable"
                    in error_text

                    or "high demand"
                    in error_text
                ):

                    time.sleep(
                        2
                        * (
                            attempt
                            + 1
                        )
                    )

                    continue

                # Model unavailable
                if (
                    "404"
                    in error_text

                    or "not_found"
                    in error_text

                    or
                    "no longer available"
                    in error_text
                ):

                    print(
                        f"{model_name} "
                        "unavailable. "
                        "Trying fallback "
                        "model..."
                    )

                    break

                raise

    if last_error:
        raise last_error

    raise RuntimeError(
        "Gemini could not generate "
        "a response."
    )


# ---------------------------------------------------------
# Build document context
# ---------------------------------------------------------

def build_document_context(
    matches: list[dict],
    document_names: list[str],
):
    """
    Groups retrieved chunks by filename so Gemini
    clearly knows which information belongs to
    which document.
    """

    grouped_context = {}

    for filename in document_names:

        grouped_context[
            filename
        ] = []

    for match in matches:

        filename = match.get(
            "filename"
        )

        text = match.get(
            "text",
            "",
        )

        chunk = match.get(
            "chunk"
        )

        if (
            not filename
            or not text
        ):
            continue

        if (
            filename
            not in grouped_context
        ):
            grouped_context[
                filename
            ] = []

        grouped_context[
            filename
        ].append(
            {
                "text":
                    text,

                "chunk":
                    chunk,
            }
        )

    context_parts = []

    for filename in document_names:

        document_chunks = (
            grouped_context.get(
                filename,
                [],
            )
        )

        if not document_chunks:

            context_parts.append(
                f"""
========================================
DOCUMENT: {filename}
========================================

No relevant readable chunks were retrieved
from this document for the current question.
""".strip()
            )

            continue

        chunk_parts = []

        for item in document_chunks:

            chunk_number = (
                item.get(
                    "chunk"
                )
            )

            text = item.get(
                "text",
                "",
            )

            chunk_parts.append(
                f"""
[Chunk {chunk_number}]

{text}
""".strip()
            )

        document_context = (
            "\n\n".join(
                chunk_parts
            )
        )

        context_parts.append(
            f"""
========================================
DOCUMENT: {filename}
========================================

{document_context}
""".strip()
        )

    return (
        "\n\n\n".join(
            context_parts
        )
    )


# ---------------------------------------------------------
# Answer question
# ---------------------------------------------------------

def answer_question(
    question: str,
    document_names: list[str],
):

    # -----------------------------------------------------
    # Validate selected documents
    # -----------------------------------------------------

    if not document_names:

        return {
            "answer": (
                "Please upload or select at least "
                "one document before asking a question."
            ),

            "source":
                None,
        }

    # Remove duplicate filenames.
    document_names = list(
        dict.fromkeys(
            document_names
        )
    )

    print(
        "\n============================"
    )

    print(
        "RAG QUESTION:",
        question,
    )

    print(
        "SELECTED DOCUMENTS:",
        document_names,
    )

    print(
        "DOCUMENT COUNT:",
        len(
            document_names
        ),
    )

    # -----------------------------------------------------
    # Retrieve chunks PER DOCUMENT
    # -----------------------------------------------------

    matches = search_documents(
        query=question,

        document_names=
            document_names,

        n_results_per_document=
            5,
    )

    if not matches:

        return {
            "answer": (
                "I could not find relevant "
                "information in the selected "
                "document(s)."
            ),

            "source":
                None,
        }

    # -----------------------------------------------------
    # Check which documents actually returned chunks
    # -----------------------------------------------------

    retrieved_sources = []

    for match in matches:

        filename = match.get(
            "filename"
        )

        if (
            filename
            and filename
            not in retrieved_sources
        ):
            retrieved_sources.append(
                filename
            )

    print(
        "RETRIEVED SOURCES:",
        retrieved_sources,
    )

    # -----------------------------------------------------
    # Build clearly separated context
    # -----------------------------------------------------

    context = (
        build_document_context(
            matches,
            document_names,
        )
    )

    if not context.strip():

        return {
            "answer": (
                "I could not find readable "
                "information in the selected "
                "document(s)."
            ),

            "source":
                None,
        }

    # -----------------------------------------------------
    # Selected document list for Gemini
    # -----------------------------------------------------

    selected_document_list = (
        "\n".join(
            [
                f"{index + 1}. {filename}"
                for index, filename
                in enumerate(
                    document_names
                )
            ]
        )
    )

    # -----------------------------------------------------
    # Prompt
    # -----------------------------------------------------

    prompt = f"""
You are PaperMind, an AI document assistant.

The user currently has exactly
{len(document_names)} selected document(s).

SELECTED DOCUMENTS:

{selected_document_list}


IMPORTANT DOCUMENT RULES:

- The list above is the authoritative list of
  documents selected by the user.

- Do NOT say that only one document was provided
  if multiple documents are listed above.

- Use ONLY information from the DOCUMENT CONTEXT
  below.

- Never use information from older or unselected
  documents.

- Do not use outside knowledge.

- Do not invent missing facts.

- Treat every DOCUMENT section separately.

- Information under one DOCUMENT heading belongs
  only to that document.

- Do not mix facts between documents.

- Consider ALL selected documents before writing
  the final answer.

- If information is missing from one selected
  document, say:
  "This information was not found in
  <filename>."

- Do NOT treat missing information in one
  document as proof that the document itself
  was not uploaded.


COMPARISON RULES:

If the user asks to:

- compare
- differentiate
- find differences
- find similarities
- contrast
- summarize both/all documents

then:

1. Examine EVERY selected document separately.

2. Explain what each document contains.

3. Clearly identify which facts belong to which
   filename.

4. Then explain the similarities and/or
   differences supported by the retrieved
   context.

5. Do not skip a selected document merely because
   another document has more relevant information.

6. If a selected document has limited relevant
   information, explicitly say that its retrieved
   information is limited instead of pretending
   the document does not exist.


ANSWER STYLE:

- Preserve names, dates, numbers, prices, totals,
  invoice numbers, amounts and important facts.

- Use clean Markdown.

- Use headings and bullet points when useful.

- When comparing multiple documents, prefer this
  structure:

  ## Document 1 — filename

  ...

  ## Document 2 — filename

  ...

  ## Key Differences

  ...

- Keep the answer clear and grounded in the
  supplied context.


DOCUMENT CONTEXT:

{context}


USER QUESTION:

{question}
"""

    # -----------------------------------------------------
    # Ask Gemini
    # -----------------------------------------------------

    response = (
        generate_with_retry(
            prompt
        )
    )

    answer = (
        response.text
        or
        "I could not generate an answer."
    )

    # -----------------------------------------------------
    # Return ALL selected/retrieved sources
    # -----------------------------------------------------

    sources = []

    for filename in document_names:

        if (
            filename
            in retrieved_sources
        ):
            sources.append(
                filename
            )

    return {
        "answer":
            answer,

        "source":
            ", ".join(
                sources
            )
            if sources
            else None,
    }