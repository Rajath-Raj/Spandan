const TYPES = {
  LLMController: Symbol.for('LLMController'),

  // Controllers
  GenAIVideoController: Symbol.for('GenAIVideoController'),
  
  // Services
  VideoService: Symbol.for('VideoService'),
  AudioService: Symbol.for('AudioService'),
  AIContentService: Symbol.for('AIContentService'),
  CleanupService: Symbol.for('CleanupService'),
  DocumentParserService: Symbol.for('DocumentParserService'),
  EmbeddingService: Symbol.for('EmbeddingService'),
  RAGService: Symbol.for('RAGService'),
};

export {TYPES as GENAI_TYPES};
