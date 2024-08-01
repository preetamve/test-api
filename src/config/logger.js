const { createLogger, format, transports } = require('winston');
const moment = require('moment');
const { ENVIRONMENT } = require('../config/app');

const logger = createLogger({
  level: ENVIRONMENT === 'test' ? 'debug' : 'info',
  format: format.combine(
    ENVIRONMENT === 'test' ? format.colorize() : format.uncolorize(),
    format.splat(),
    format.timestamp(),
    format.printf(({ level, message, timestamp, ...metadata }) => {
      let log =
        moment(timestamp).format('YYYY-MM-DD hh:mm:ss').trim() +
        ` | ${level} | ${message}`;

      if (
        !(
          Object.entries(metadata).length === 0 &&
          metadata.constructor === Object
        )
      ) {
        log += ' | ' + JSON.stringify(metadata);
      }

      return log;
    }),
  ),
  transports: [new transports.Console()],
});

module.exports = logger;