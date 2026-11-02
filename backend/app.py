import io
import uuid
import pymupdf  # PyMuPDF
import ollama
import chromadb
from flask import Flask, request, jsonify
from flask_cors import CORS
from docx import Document

LLM = "llama3.2:3b"          # change to llama3.2:1b if your PC is slow
EMBED = "nomic-embed-text"

app = Flask(__name__)
CORS(app)

# Saves data in a folder called chroma_db (survives restarts)
db = chromadb.PersistentClient(path="./chroma_db")
col = db.get_or_create_collection("prescriptions", metadata={"hnsw:space": "cosine"})

SYSTEM = """You are a careful assistant helping a patient or caretaker understand
food safety with their prescribed medicines and illness.

Rules:
1. Answer ONLY from the CONTEXT (prescription and illness details) given below.
2. Mention which illness and which tablets in the context are relevant to the food asked about.
3. Say clearly: OK to eat / limit / avoid, and give a short reason.
4. If the context does not cover it, say "I can't tell from the prescription" and
   advise asking the doctor or pharmacist. Never guess.
5. Use simple language and 3-5 short bullet points.
6. End with: "This is not medical advice. Please confirm with your doctor."
"""

# ---------- helper functions ----------
def extract_text(file):
    """Read text from PDF, Word or TXT."""
    name = file.filename.lower()
    data = file.read()
    if name.endswith(".pdf"):
        with pymupdf.open(stream=data, filetype="pdf") as pdf:
            return "\n".join(page.get_text() for page in pdf)
    if name.endswith(".docx"):
        return "\n".join(p.text for p in Document(io.BytesIO(data)).paragraphs)
    return data.decode("utf-8", errors="ignore")

def chunk(text, size=150, overlap=30):
    """Split long text into overlapping pieces of ~150 words."""
    words = text.split()
    step = size - overlap
    return [" ".join(words[i:i + size]) for i in range(0, len(words), step)]

def embed(texts):
    """Turn text into numbers using Ollama."""
    return ollama.embed(model=EMBED, input=texts)["embeddings"]

# ---------- API routes ----------
@app.route("/upload", methods=["POST"])
def upload():
    patient_id = request.form.get("patient_id", "default")
    illness = request.form.get("illness", "").strip()
    file = request.files.get("file")

    chunks = []
    if illness:
        chunks.append(f"Illness/condition: {illness}")
    if file:
        chunks += chunk(extract_text(file))
    chunks = [c for c in chunks if c.strip()]
    if not chunks:
        return jsonify({"error": "Provide a file with readable text, or the illness"}), 400

    col.add(
        ids=[str(uuid.uuid4()) for _ in chunks],
        documents=chunks,
        embeddings=embed(chunks),
        metadatas=[{"patient_id": patient_id} for _ in chunks],
    )
    return jsonify({"chunks": len(chunks)})

@app.route("/ask", methods=["POST"])
def ask():
    body = request.json
    query = body.get("query", "")
    patient_id = body.get("patient_id", "default")

    res = col.query(
        query_embeddings=embed([query]),
        n_results=4,
        where={"patient_id": patient_id},
    )
    docs = res["documents"][0]
    if not docs:
        return jsonify({"answer": "No prescription found. Please upload one first."})

    context = "\n---\n".join(docs)
    reply = ollama.chat(
        model=LLM,
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"CONTEXT:\n{context}\n\nQUESTION: {query}"},
        ],
        options={"temperature": 0.1, "num_ctx": 2048},
        keep_alive="30m",
    )
    return jsonify({"answer": reply["message"]["content"], "sources": docs})

if __name__ == "__main__":
    app.run(port=5000)