from sentence_transformers import SentenceTransformer
import chromadb
import uuid


model = SentenceTransformer("all-MiniLM-L6-v2")


chroma_client = chromadb.PersistentClient(
    path="./chroma_db"
)


collection = chroma_client.get_or_create_collection(
    name="documents"
)


def split_text(
    text: str,
    chunk_size: int = 500,
    overlap: int = 100
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


def store_document(text: str, filename: str):
    chunks = split_text(text)

    if not chunks:
        return 0

    embeddings = model.encode(chunks).tolist()

    ids = [
        str(uuid.uuid4())
        for _ in chunks
    ]

    metadatas = [
        {
            "filename": filename,
            "chunk": index
        }
        for index in range(len(chunks))
    ]

    collection.add(
        ids=ids,
        documents=chunks,
        embeddings=embeddings,
        metadatas=metadatas
    )

    return len(chunks)

def search_documents(
    query: str,
    document_names: list[str],
    n_results: int = 5,
):
    if not document_names:
        return []

    query_embedding = model.encode(
        [query]
    ).tolist()[0]

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=n_results,
        where={
            "filename": {
                "$in": document_names
            }
        },
        include=[
            "documents",
            "metadatas",
            "distances",
        ],
    )

    documents = results.get(
        "documents",
        [[]]
    )[0]

    metadatas = results.get(
        "metadatas",
        [[]]
    )[0]

    distances = results.get(
        "distances",
        [[]]
    )[0]

    matches = []

    for document, metadata, distance in zip(
        documents,
        metadatas,
        distances,
    ):
        matches.append({
            "text": document,
            "filename": metadata.get(
                "filename"
            ),
            "chunk": metadata.get(
                "chunk"
            ),
            "distance": distance,
        })

    return matches
    query_embedding = model.encode([query]).tolist()[0]

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=n_results,
        include=[
            "documents",
            "metadatas",
            "distances",
        ],
    )

    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    matches = []

    for document, metadata, distance in zip(
        documents,
        metadatas,
        distances,
    ):
        matches.append({
            "text": document,
            "filename": metadata.get("filename"),
            "chunk": metadata.get("chunk"),
            "distance": distance,
        })

    return matches