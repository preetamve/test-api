module.exports = {
  APP_NAME: process.env.APP_NAME,
  PORT: process.env.APP_PORT || 5000,
  MONGODB_URI: process.env.MONGODB_URI,
  ENVIRONMENT: process.env.NODE_ENV || "development",
  JWT_ALGORITHM: process.env.JWT_ALGORITHM,
  JWT_PASSPHRASE: process.env.JWT_PASSPHRASE,
  CLIENT_ID: process.env.CLIENT_ID,
  CLIENT_SECRET: process.env.CLIENT_SECRET,
  REDIRECT_URI: process.env.REDIRECT_URI,
};
