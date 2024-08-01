/**
 * Extending Error class to construct custom API errors
 */
class ApiError extends Error {
  /**
   *
   * @param {number} statusCode
   * @param {string} message
   * @param {boolean} isOperational
   * @param {string} stack
   */
  constructor(
    statusCode, 
    message,
    messageCode = null, 
    isOperational = true, 
    stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    if(messageCode) {
      this.messageCode = messageCode;
    }
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

module.exports = ApiError;
