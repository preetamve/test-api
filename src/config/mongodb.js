const { MongoClient } = require("mongodb");
const logger = require("./logger");

const { MONGODB_URI, ENVIRONMENT } = require("./app");

let dbInstance = null;
const getDbInstance = async function () {
  if (dbInstance == null) {
    const db = await MongoClient.connect(MONGODB_URI);
    logger.info("dbInstance created");
    // dbInstance = db.db("production");
    dbInstance = db.db(ENVIRONMENT);
  } else {
    logger.info("Using cached dbInstance");
  }

  return dbInstance;
};

module.exports = {
  async createCollectionInstance(collection) {
    const database = await getDbInstance();
    return database.collection(collection);
  },
};
