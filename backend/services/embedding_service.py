from sentence_transformers import SentenceTransformer
import chromadb
import uuid



model = SentenceTransformer(
    "all-MiniLM-L6-v2"
)


# ---------------------------------------------------------
# ChromaDB
# ---------------------------------------------------------

chroma_client = chromadb.PersistentClient(
    path="./chroma_db"
)

collection = chroma_client.get_or_create_collection(
    name="documents"
)


# ---------------------------------------------------------
# Split text into chunks
# ---------------------------------------------------------

def split_text(
    text: str,
    chunk_size: int = 500,
    overlap: int = 100,
):
    chunks = []

    start = 0

    while start < len(text):
        end = start + chunk_size

        chunk = text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        start += chunk_size - overlap

    return chunks


# ---------------------------------------------------------
# Store document in ChromaDB
# ---------------------------------------------------------

def store_document(
    text: str,
    filename: str,
):
    chunks = split_text(text)

    if not chunks:
        return 0

    embeddings = model.encode(
        chunks
    ).tolist()

    ids = [
        str(uuid.uuid4())
        for _ in chunks
    ]

    metadatas = [
        {
            "filename": filename,
            "chunk": index,
        }
        for index in range(len(chunks))
    ]

    collection.add(
        ids=ids,
        documents=chunks,
        embeddings=embeddings,
        metadatas=metadatas,
    )

    return len(chunks)


# ---------------------------------------------------------
# Search EVERY selected document separately
# ---------------------------------------------------------

def search_documents(
    query: str,
    document_names: list[str],
    n_results_per_document: int = 5,
):
    if not document_names:
        return []

    query_embedding = model.encode(
        [query]
    ).tolist()[0]

    all_matches = []

    # Duplicate filenames remove
    unique_document_names = list(
        dict.fromkeys(document_names)
    )

    print(
        "SEARCHING DOCUMENTS:",
        unique_document_names
    )

    for filename in unique_document_names:

        print(
            f"\nSEARCHING: {filename}"
        )

        try:
            # First get records belonging to this file.
            existing = collection.get(
                where={
                    "filename": filename
                },
                include=[
                    "metadatas"
                ],
            )

            document_ids = (
                existing.get("ids", [])
                or []
            )

            document_chunk_count = len(
                document_ids
            )

            print(
                "AVAILABLE CHUNKS:",
                document_chunk_count
            )

            if document_chunk_count == 0:
                print(
                    "NO INDEXED CHUNKS FOUND:",
                    filename
                )
                continue

            # Never request more chunks than exist.
            results_to_fetch = min(
                n_results_per_document,
                document_chunk_count,
            )

            results = collection.query(
                query_embeddings=[
                    query_embedding
                ],
                n_results=results_to_fetch,
                where={
                    "filename": filename
                },
                include=[
                    "documents",
                    "metadatas",
                    "distances",
                ],
            )

            documents = (
                results.get(
                    "documents",
                    [[]]
                )[0]
                or []
            )

            metadatas = (
                results.get(
                    "metadatas",
                    [[]]
                )[0]
                or []
            )

            distances = (
                results.get(
                    "distances",
                    [[]]
                )[0]
                or []
            )

            print(
                "RETRIEVED CHUNKS:",
                len(documents)
            )

            for index, text in enumerate(
                documents
            ):
                if not text:
                    continue

                metadata = {}

                if index < len(
                    metadatas
                ):
                    metadata = (
                        metadatas[index]
                        or {}
                    )

                distance = None

                if index < len(
                    distances
                ):
                    distance = (
                        distances[index]
                    )

                all_matches.append(
                    {
                        "text": text,

                        "filename":
                            metadata.get(
                                "filename",
                                filename,
                            ),

                        "chunk":
                            metadata.get(
                                "chunk"
                            ),

                        "distance":
                            distance,
                    }
                )

        except Exception as exc:
            print(
                "SEARCH ERROR FOR",
                filename,
                ":",
                repr(exc),
            )

    print(
        "\nTOTAL MATCHES:",
        len(all_matches)
    )

    print(
        "MATCH SOURCES:",
        list(
            dict.fromkeys(
                match["filename"]
                for match
                in all_matches
                if match.get(
                    "filename"
                )
            )
        )
    )

    return all_matches