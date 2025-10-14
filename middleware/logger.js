const logger = require('../utils/logger');

// Middleware to log all HTTP requests
const requestLogger = (req, res, next) => {
    const startTime = Date.now();

    // Log the incoming request
    logger.info('Incoming request', {
        method: req.method,
        url: req.originalUrl || req.url,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        body: req.method !== 'GET' ? req.body : undefined,
        query: Object.keys(req.query).length > 0 ? req.query : undefined,
        userId: req.user?.id || 'Anonymous'
    });

    // Override the res.end method to log the response
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
        const responseTime = Date.now() - startTime;
        
        // Log the response
        logger.access(req, res, { responseTime });
        
        // Call the original end method
        originalEnd.call(this, chunk, encoding);
    };

    next();
};

// Middleware to log errors
const errorLogger = (err, req, res, next) => {
    logger.error('Request error', err, {
        method: req.method,
        url: req.originalUrl || req.url,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        body: req.body,
        userId: req.user?.id || 'Anonymous'
    });

    next(err);
};

module.exports = {
    requestLogger,
    errorLogger
};