const app = require('./src/app');
const logger = require('./src/config/logger');
require('dotenv').config();
// const ngrok = require("ngrok");
const { PORT } = require('./src/config/app');

// start server
const server = app.listen(PORT, () => {
  logger.info(`Listening on: http://localhost:${PORT}`);
  // ngrok.connect({addr:PORT,authtoken:"2jbRlCCu5m3Mf7Z15wOdpRTuzQv_f2q9x4wpW2TW6nHd5bYD"}).then((ngrokUrl)=>{ //temp: ngrok for debugging
  //   logger.info("ngrok url : " + ngrokUrl);
  // }).catch(error=>{
  //   logger.error(error.message);
  // })
});

const exitHandler = () => {
  if (server) {
    server.close(() => {
      logger.info('Server closed');
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error) => {
  logger.error("unexpectedErrorHandler: "+error);
  exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  if (server) {
    server.close();
  }
});
