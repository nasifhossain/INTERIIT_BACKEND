const auth = require('./auth');
const globalErrorHandler = require('./errorHandler');
const { requestLogger, errorLogger } = require('./logger');

module.exports = {
    ...auth,
    globalErrorHandler,
    requestLogger,
    errorLogger
};