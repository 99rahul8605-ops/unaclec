
import { MongoClient } from "mongodb";

let clientPromise;

export async function getDb() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI not configured");
  }

  if (!clientPromise) {
    const client = new MongoClient(uri, {
      maxPoolSize: 10
    });

    clientPromise = client.connect().catch((error) => {
      clientPromise = undefined;
      throw error;
    });
  }

  const client = await clientPromise;

  return client.db(
    process.env.MONGODB_DB || "lecture_manager"
  );
}
