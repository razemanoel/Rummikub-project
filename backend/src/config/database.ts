import { MongoClient, Db, Collection } from 'mongodb';

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

  if (!collectionNames.includes('verification_codes')) {
    await db.createCollection('verification_codes');
    const verificationCollection = db.collection('verification_codes');
    await verificationCollection.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }); // TTL index
  }

  console.log('MongoDB connected successfully');
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
