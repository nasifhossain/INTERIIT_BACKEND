const http = require("http");
const app = require("./app");
const logger = require("./utils/logger");
require("dotenv").config();

const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    const message = `Server is running on port ${PORT}`;
    logger.info('Server started', { 
        port: PORT, 
        nodeEnv: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
    });
    console.log(message);
});

// Graceful shutdown
process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully');
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down gracefully');
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

// Log uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', new Error(reason), { promise });
});