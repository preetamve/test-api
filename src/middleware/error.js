const httpStatus = require('http-status');
const logger = require('../config/logger');
const { ENVIRONMENT } = require('../config/app');
const ApiError = require('../utils/ApiError');

const errorConverter = (err, req, res, next) => {
  if (err instanceof ApiError) return next(err);

  const statusCode = err.statusCode
    ? httpStatus.BAD_REQUEST
    : httpStatus.INTERNAL_SERVER_ERROR;
  const message = err.message || httpStatus[statusCode];
  const error = new ApiError(statusCode, message, null, false, err.stack);

  next(error);
};

const errorHandler = (err, req, res, next) => {
  const { statusCode, message, messageCode } = err;

  res.locals.errorMessage = message;

  const response = {
    code: statusCode,
    message,
    ...(messageCode !== null && { messageCode }),
    ...(ENVIRONMENT === 'development' && { stack: err.stack }),
  };

  logger.error(err);

  res.status(statusCode).send(response);
};

module.exports = {
  errorConverter,
  errorHandler,
};
