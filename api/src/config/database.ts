import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function initializeDatabase() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/rummikub';

  client = new MongoClient(mongoUri);
  await client.connect();

  db = client.db();

  // Create collections if they don't exist
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map((c) => c.name);

  if (!collectionNames.includes('users')) {
    await db.createCollection('users');
    // Create indexes
    const usersCollection = db.collection('users');
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    await usersCollection.createIndex({ username: 1 }, { unique: true, sparse: true });
  }

  if (!collectionNames.includes('vision_feedback')) {
    await db.createCollection('vision_feedback');
  }

  const visionFeedbackCollection = db.collection('vision_feedback');
  await visionFeedbackCollection.createIndex({ createdAt: -1 });
  await visionFeedbackCollection.createIndex({ reviewed: 1, usedForTraining: 1 });
  await visionFeedbackCollection.createIndex({ source: 1, correctionType: 1, createdAt: -1 });
  await visionFeedbackCollection.createIndex({ classifierModelVersion: 1, detectorModelVersion: 1 });
  await visionFeedbackCollection.createIndex({ feedbackHash: 1 }, { unique: true });
}

export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

export async function closeDatabase() {
  if (client) {
    await client.close();
  }
}
