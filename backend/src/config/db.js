/**
 * Optional MongoDB connection.
 *
 * The driver is imported dynamically and is NOT a declared dependency: the app
 * runs fully on the in-memory store, so most people should not have to download
 * a database driver they will never use. Setting MONGO_URI without installing
 * it produces an actionable message rather than a module-not-found stack trace.
 */
export async function connectMongo(uri = process.env.MONGO_URI) {
  if (!uri) return null;

  let MongoClient;
  try {
    ({ MongoClient } = await import('mongodb'));
  } catch {
    throw new Error(
      'MONGO_URI is set but the mongodb driver is not installed. '
      + 'Run: npm install mongodb --prefix backend  (or unset MONGO_URI to use the in-memory store)',
    );
  }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db(process.env.MONGO_DB || 'gridflex');

  await Promise.all([
    db.collection('energyReadings').createIndex({ dayIndex: 1, hour: 1 }, { unique: true }),
    db.collection('sessions').createIndex({ sessionId: 1 }, { unique: true }),
  ]);

  return { client, db };
}
