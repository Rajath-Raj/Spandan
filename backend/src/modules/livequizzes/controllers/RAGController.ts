import {
  JsonController,
  Post,
  Get,
  Param,
  Body,
  HttpCode,
  Req,
  Res,
  BadRequestError,
  NotFoundError,
  Delete,
} from 'routing-controllers';
import { Request, Response } from 'express';
import multer from 'multer';
import { inject, injectable } from 'inversify';
import { RAGService } from '#root/modules/genai/services/RAGService.js';
import { CleanupService } from '#root/modules/genai/services/CleanupService.js';
import { LIVE_QUIZ_TYPES } from '../types.js';
import type { QuestionSpec } from '#root/modules/genai/services/AIContentService.js';
import * as fsp from 'fs/promises';
import { OpenAPI } from 'routing-controllers-openapi';

const upload = multer({ dest: 'uploads/' });

@injectable()
@OpenAPI({ tags: ['RAG'] })
@JsonController('/livequizzes/rag')
export class RAGController {
  constructor(
    @inject(LIVE_QUIZ_TYPES.RAGService) private ragService: RAGService,
    @inject(LIVE_QUIZ_TYPES.CleanupService) private cleanupService: CleanupService,
  ) {}

  /**
   * Upload and index a document for a room
   * POST /api/livequizzes/rag/:code/documents
   */
  @Post('/:code/documents')
  @HttpCode(200)
  async uploadDocument(
    @Param('code') roomCode: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    console.log(`[RAGController] Upload request for room: ${roomCode}`);
    console.log(`[RAGController] Content-Type: ${req.headers['content-type']}`);

    try {
      await new Promise<void>((resolve, reject) => {
        upload.single('file')(req, res, (err) => {
          if (err) { console.error('[RAGController] Multer error:', err); reject(err); }
          else resolve();
        });
      });
    } catch (err: any) {
      return res.status(400).json({ message: `File upload error: ${err.message}` });
    }

    if (!req.file) {
      console.error('[RAGController] No file received. Content-Type was:', req.headers['content-type']);
      return res.status(400).json({ message: 'No file provided. Ensure Content-Type is multipart/form-data.' });
    }

    console.log(`[RAGController] File: ${req.file.originalname} (${req.file.mimetype}, ${req.file.size} bytes)`);

    const { path: tempPath, mimetype, originalname } = req.file;

    try {
      const buffer = await fsp.readFile(tempPath);
      const result = await this.ragService.indexDocument(roomCode, buffer, mimetype, originalname);
      return res.json({ message: 'Document indexed successfully', document: result });
    } catch (err: any) {
      console.error('[RAGController] Indexing error:', err.message);
      return res.status(err.httpCode || 500).json({ message: err.message || 'Failed to index document' });
    } finally {
      await this.cleanupService.cleanup([tempPath]);
    }
  }

  /**
   * Get all indexed documents for a room
   * GET /api/livequizzes/rag/:code/documents
   */
  @Get('/:code/documents')
  async getDocuments(@Param('code') roomCode: string) {
    const documents = await this.ragService.getRoomDocuments(roomCode);
    return { documents };
  }

  /**
   * Delete a document and all its chunks
   * DELETE /api/livequizzes/rag/:code/documents/:documentId
   */
  @Delete('/:code/documents/:documentId')
  async deleteDocument(
    @Param('code') roomCode: string,
    @Param('documentId') documentId: string,
  ) {
    const success = await this.ragService.deleteDocument(roomCode, documentId);
    if (!success) {
      throw new NotFoundError('Document not found');
    }
    return { message: 'Document deleted successfully' };
  }

  /**
   * Generate questions from RAG context
   * POST /api/livequizzes/rag/:code/questions
   */
  @Post('/:code/questions')
  @HttpCode(200)
  async generateRAGQuestions(
    @Param('code') roomCode: string,
    @Body() body: { topic: string; globalQuestionSpecification: QuestionSpec[]; model?: string },
  ) {
    const { topic, globalQuestionSpecification, model } = body;

    if (!topic || topic.trim() === '') {
      throw new BadRequestError('Topic is required');
    }

    if (!globalQuestionSpecification || globalQuestionSpecification.length === 0) {
      throw new BadRequestError('Question specification is required');
    }

    const questions = await this.ragService.generateQuestionsFromContext(
      roomCode,
      topic,
      globalQuestionSpecification,
      model,
    );

    return {
      message: 'RAG questions generated successfully',
      totalQuestions: questions.length,
      questions,
    };
  }
}
