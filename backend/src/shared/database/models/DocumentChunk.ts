import mongoose from 'mongoose';

const DocumentChunkSchema = new mongoose.Schema({
  roomCode: { type: String, required: true },
  documentId: { type: String, required: true },
  fileName: { type: String, required: true },
  chunkIndex: { type: Number, required: true },
  text: { type: String, required: true },
  embedding: { type: [Number], required: true },
  createdAt: { type: Date, default: Date.now },
});

// Regular index on roomCode for fast filtering and deletion
DocumentChunkSchema.index({ roomCode: 1 });
DocumentChunkSchema.index({ roomCode: 1, documentId: 1 });

/**
 * IMPORTANT: MongoDB Atlas Vector Search index must be created manually in Atlas UI / CLI.
pr * Collection: "documentchunks" (Mongoose pluralizes DocumentChunk)
 * Index name: "vector_index"
 * The index definition MUST include roomCode as a filter field, otherwise the
 * $vectorSearch filter in RAGService.retrieveContext() is silently ignored and
 * chunks from other rooms will leak into results.
 *
 * Required Atlas index JSON:
 * {
 *   "fields": [
 *     { "type": "vector", "path": "embedding", "numDimensions": 768, "similarity": "cosine" },
 *     { "type": "filter", "path": "roomCode" }
 *   ]
 * }
 *
 * numDimensions must match the output of the embedding model (768 for nomic-embed-text).
 */
export const DocumentChunk = mongoose.model('DocumentChunk', DocumentChunkSchema);
