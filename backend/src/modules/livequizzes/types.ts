const TYPES = {
  // Controllers
  PollRoomController: Symbol.for('PollRoomController'),
  DashboardController: Symbol.for('DashboardController'),
  RAGController: Symbol.for('RAGController'),

  // Services
  PollService: Symbol.for('PollService'),
  RoomService: Symbol.for('RoomService'),
  DashboardService: Symbol.for('DashboardService'),

  // ✅ Add GenAI / media services
  VideoService: Symbol.for('VideoService'),
  AudioService: Symbol.for('AudioService'),
  TranscriptionService: Symbol.for('TranscriptionService'),
  AIContentService: Symbol.for('AIContentService'),
  CleanupService: Symbol.for('CleanupService'),
  RAGService: Symbol.for('RAGService'),

  // Socket.IO
  PollSocket: Symbol.for('PollSocket'),
};

export { TYPES as LIVE_QUIZ_TYPES };
