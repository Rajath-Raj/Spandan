import { injectable, inject } from 'inversify';
import { v4 as uuidv4 } from 'uuid';
import { DocumentParserService } from './DocumentParserService.js';
import { EmbeddingService } from './EmbeddingService.js';
import { AIContentService } from './AIContentService.js';
import { DocumentChunk } from '../../../shared/database/models/DocumentChunk.js';
import { HttpError } from 'routing-controllers';
import { GENAI_TYPES } from '../types.js';

@injectable()
export class RAGService {
  constructor(
    @inject(GENAI_TYPES.DocumentParserService) private documentParserService: DocumentParserService,
    @inject(GENAI_TYPES.EmbeddingService) private embeddingService: EmbeddingService,
    @inject(GENAI_TYPES.AIContentService) private aiContentService: AIContentService
  ) { }

  /**
   * Process an uploaded document, embed its chunks, and save to MongoDB
   */
  public async indexDocument(roomCode: string, buffer: Buffer, mimeType: string, fileName: string) {
    console.log(`[RAGService] Indexing document ${fileName} for room ${roomCode}`);

    // 1. Parse text
    const text = await this.documentParserService.parseDocument(buffer, mimeType, fileName);

    // 2. Chunk text
    const chunks = this.documentParserService.chunkText(text);
    console.log(`[RAGService] Split document into ${chunks.length} chunks`);

    const documentId = uuidv4();
    const chunkDocs = [];

    // 3. Embed chunks sequentially (since Ollama may run locally and shouldn't be overwhelmed)
    for (let i = 0; i < chunks.length; i++) {
      try {
        const chunkText = chunks[i];
        const embedding = await this.embeddingService.embed(chunkText);

        chunkDocs.push({
          roomCode,
          documentId,
          fileName,
          chunkIndex: i,
          text: chunkText,
          embedding
        });
        console.log(`[RAGService] Embedded chunk ${i + 1}/${chunks.length}`);
      } catch (e) {
        console.error(`[RAGService] Failed to embed chunk ${i + 1}:`, e);
        throw e;
      }
    }

    // 4. Save to MongoDB
    if (chunkDocs.length > 0) {
      await DocumentChunk.insertMany(chunkDocs);
      console.log(`[RAGService] Indexed ${chunkDocs.length} chunks successfully.`);
    }

    return {
      documentId,
      fileName,
      totalChunks: chunks.length
    };
  }

  /**
   * Retrieve the most relevant chunks for a given topic using Vector Search
   */
  public async retrieveContext(roomCode: string, topic: string, topK: number = 5): Promise<string> {
    console.log(`[RAGService] Retrieving context for topic: "${topic}" in room: ${roomCode}`);

    // 1. Embed the search topic
    const queryVector = await this.embeddingService.embed(topic);

    // 2. Vector search in MongoDB Atlas
    const results = await DocumentChunk.aggregate([
      {
        $vectorSearch: {
          index: "vector_index",
          path: "embedding",
          queryVector: queryVector,
          numCandidates: 100,
          limit: topK,
          filter: {
            "roomCode": roomCode
          }
        }
      },
      {
        $project: {
          _id: 0,
          text: 1,
          fileName: 1,
          score: { $meta: "vectorSearchScore" }
        }
      }
    ]);

    if (results.length === 0) {
      console.warn(`[RAGService] No relevant chunks found for topic: "${topic}"`);
      return "";
    }

    console.log(`[RAGService] Found ${results.length} relevant chunks`);

    // 3. Combine retrieved chunks into a single context string
    const contextLines = results.map(
      (r, index) => `--- Excerpt ${index + 1} from ${r.fileName} ---\n${r.text}\n`
    );

    return contextLines.join('\n');
  }

  /**
   * Generate questions based strictly on the retrieved document context
   */
  public async generateQuestionsFromContext(roomCode: string, topic: string, spec: any[], model?: string) {
    // 1. Retrieve relevant text chunks
    const context = await this.retrieveContext(roomCode, topic, 5);

    if (!context.trim()) {
      throw new HttpError(400, "Could not find any relevant information for this topic in the uploaded documents.");
    }

    // 2. Inject instructions pointing the AI back to the context
    const enhancedTranscript =
      `The following excerpts are context retrieved from uploaded documents for the topic: "${topic}". ` +
      `Generate questions based strictly on this provided information.\n\n${context}`;

    // 3. Re-use existing AI content builder
    // AIContentService expects `segments` mapping
    console.log(`[RAGService] Generating questions from retrieved context...`);

    return await this.aiContentService.generateQuestions({
      segments: { "RAG-Context": enhancedTranscript },
      globalQuestionSpecification: spec,
      model: model || 'gemma3'
    });
  }

  /**
   * Retrieve list of distinct documents for a room
   */
  public async getRoomDocuments(roomCode: string) {
    const docs = await DocumentChunk.aggregate([
      { $match: { roomCode } },
      {
        $group: {
          _id: "$documentId",
          fileName: { $first: "$fileName" },
          chunkCount: { $sum: 1 },
          createdAt: { $first: "$createdAt" }
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    return docs.map(d => ({
      documentId: d._id,
      fileName: d.fileName,
      chunkCount: d.chunkCount,
      createdAt: d.createdAt
    }));
  }

  /**
   * Delete a document and all its chunks
   */
  public async deleteDocument(roomCode: string, documentId: string) {
    const result = await DocumentChunk.deleteMany({ roomCode, documentId });
    return result.deletedCount > 0;
  }
}
