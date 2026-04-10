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

export const DocumentChunk = mongoose.model('DocumentChunk', DocumentChunkSchema);
