
import { MongoClient } from "mongodb";

let client;
let db;

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    const dbName = process.env.DB_NAME;

    if (!uri || !dbName) {
      throw new Error("MongoDB environment variables are missing.");
    }

    client = new MongoClient(uri);

    await client.connect();

    db = client.db(dbName);

    console.log("MongoDB connected successfully!");

    return db;
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    throw error;
  }
};

const getDB = () => {
  if (!db) {
    throw new Error("Database is not connected.");
  }

  return db;
};

export { connectDB, getDB };
