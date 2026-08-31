/* eslint-disable */
/** Create embeddings for ragChunks and store them as Firestore VectorValues. */
const crypto = require("node:crypto");
const admin = require("firebase-admin");

const apiKey = process.env.GEMINI_API_KEY;
const dimension = Number(process.env.EMBEDDING_DIMENSION || 1536);
const forceReembed = process.env.FORCE_REEMBED === "true";

if (!apiKey) throw new Error("GEMINI_API_KEY 환경변수가 필요합니다.");
if (!Number.isInteger(dimension) || dimension < 1 || dimension > 2048) {
  throw new Error("EMBEDDING_DIMENSION은 1~2048 사이여야 합니다.");
}

admin.initializeApp();
const db = admin.firestore();

async function embed(text) {
  const endpoint = "https://generativelanguage.googleapis.com/v1beta/"
    + "models/gemini-embedding-001:embedContent";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "models/gemini-embedding-001",
      content: {parts: [{text}]},
      // Keep these top-level fields for v1beta REST compatibility.
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: dimension,
    }),
  });
  if (!response.ok) {
    throw new Error(`Embedding API ${response.status}: ${await response.text()}`);
  }
  const body = await response.json();
  let values = body.embedding?.values;
  // gemini-embedding-001 may return its native 3072 dimensions from the
  // REST endpoint even when reduced output is requested. Its MRL training
  // makes the prefix a valid reduced embedding, so reduce it here as well.
  if (Array.isArray(values) && values.length > dimension) {
    values = values.slice(0, dimension);
  }
  if (!Array.isArray(values) || values.length !== dimension) {
    throw new Error(`임베딩 차원 오류: ${values?.length || 0} / ${dimension}`);
  }
  const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  return norm ? values.map(value => value / norm) : values;
}

async function main() {
  const snapshot = await db.collection("ragChunks").get();
  let processed = 0;
  let skipped = 0;
  for (const document of snapshot.docs) {
    const data = document.data();
    const text = String(data.chunkText || "").trim();
    const hasCurrentEmbedding = data.embedding
      && Number(data.embeddingDimension) === dimension;
    if (!text || (hasCurrentEmbedding && !forceReembed)) {
      skipped += 1;
      continue;
    }
    const values = await embed(text);
    await document.ref.update({
      embedding: admin.firestore.FieldValue.vector(values),
      embeddingModel: "gemini-embedding-001",
      embeddingDimension: dimension,
      embeddingNormalized: true,
      contentHash: crypto.createHash("sha256").update(text, "utf8").digest("hex"),
      embeddingUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    processed += 1;
    console.log(`${processed}: ${document.id} (${dimension}차원)`);
  }
  console.log(`임베딩 완료: ${processed}건 처리, ${skipped}건 건너뜀`);
}

main().catch(error => {
  console.error("임베딩 실패:", error.message);
  process.exitCode = 1;
});
