const mongoose = require('mongoose');

const uri = 'mongodb+srv://phoenixflystosun:QJa66SzdMfUbSB0C@cluster0.lvfi467.mongodb.net/PollDB?appName=Cluster0';

async function run() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const col = db.collection('documentchunks');
  
  // mock query vector of length 768
  const queryVector = new Array(768).fill(0.1);
  
  try {
    const results = await col.aggregate([
      {
        $vectorSearch: {
          index: 'non_existent_index',
          path: 'embedding',
          queryVector: queryVector,
          numCandidates: 100,
          limit: 5,
          filter: { roomCode: 'L8YZ77' }
        }
      }
    ]).toArray();
    console.log('Search successful. Num results:', results.length);
  } catch (err) {
    console.error('Search failed:', err.message);
  }
  
  try {
    const indexes = await col.listSearchIndexes().toArray();
    console.log('Search indexes:', JSON.stringify(indexes, null, 2));
  } catch (err) {
    console.error('Could not list search indexes:', err.message);
  }
  
  process.exit(0);
}

run().catch(console.error);
