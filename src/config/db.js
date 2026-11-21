
import { MongoClient } from "mongodb";

let client;
let db;

const createCollectionIfNotExists = async (database, name) => {
  const existingCollection = await database
    .listCollections({ name }, { nameOnly: true })
    .hasNext();

  if (!existingCollection) {
    await database.createCollection(name);
    console.log(`Collection created: ${name}`);
  }
};

const initializeDatabase = async (database) => {
  const collectionNames = [
    "services",
    "bookings",
    "transactions",
  ];

  for (const name of collectionNames) {
    await createCollectionIfNotExists(database, name);
  }

  console.log("Database collections initialized successfully.");
};

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

    console.log(`Connected to MongoDB database: ${dbName}`);

    await initializeDatabase(db);

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
