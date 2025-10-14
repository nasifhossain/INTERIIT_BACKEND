const fs = require('fs');
const path = require('path');
const { getCurrentTime } = require('./CurrentTime');

class Logger {
    constructor() {
        this.logDir = path.join(__dirname, '..', 'storage', 'logs');
        this.appLogDir = path.join(this.logDir, 'app');
        this.errorLogDir = path.join(this.logDir, 'error');
        this.accessLogDir = path.join(this.logDir, 'access');
        
        // Ensure log directories exist
        this.ensureDirectoryExists(this.logDir);
        this.ensureDirectoryExists(this.appLogDir);
        this.ensureDirectoryExists(this.errorLogDir);
        this.ensureDirectoryExists(this.accessLogDir);
    }

    ensureDirectoryExists(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    getDateString() {
        const now = new Date();
        return now.toISOString().split('T')[0]; // YYYY-MM-DD format
    }

    getTimeString() {
        return getCurrentTime();
    }

    formatLogMessage(level, message, meta = {}) {
        const timestamp = this.getTimeString();
        const metaString = Object.keys(meta).length > 0 ? ` | Meta: ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaString}\n`;
    }

    writeToFile(logDir, filename, content) {
        const filePath = path.join(logDir, filename);
        try {
            fs.appendFileSync(filePath, content);
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }

    // Application logs (general info, debug, warnings)
    info(message, meta = {}) {
        const logContent = this.formatLogMessage('INFO', message, meta);
        const filename = `app-${this.getDateString()}.log`;
        this.writeToFile(this.appLogDir, filename, logContent);
        
        // Also log to console in development
        if (process.env.NODE_ENV !== 'production') {
            console.log(`ℹ️  ${message}`, meta);
        }
    }

    debug(message, meta = {}) {
        const logContent = this.formatLogMessage('DEBUG', message, meta);
        const filename = `app-${this.getDateString()}.log`;
        this.writeToFile(this.appLogDir, filename, logContent);
        
        if (process.env.NODE_ENV !== 'production') {
            console.debug(`🐛 ${message}`, meta);
        }
    }

    warn(message, meta = {}) {
        const logContent = this.formatLogMessage('WARN', message, meta);
        const filename = `app-${this.getDateString()}.log`;
        this.writeToFile(this.appLogDir, filename, logContent);
        
        if (process.env.NODE_ENV !== 'production') {
            console.warn(`⚠️  ${message}`, meta);
        }
    }

    // Error logs (errors, exceptions)
    error(message, error = null, meta = {}) {
        const errorMeta = {
            ...meta,
            ...(error && {
                stack: error.stack,
                name: error.name,
                message: error.message
            })
        };
        
        const logContent = this.formatLogMessage('ERROR', message, errorMeta);
        const filename = `error-${this.getDateString()}.log`;
        this.writeToFile(this.errorLogDir, filename, logContent);
        
        if (process.env.NODE_ENV !== 'production') {
            console.error(`❌ ${message}`, error || '', meta);
        }
    }

    // Access logs (HTTP requests)
    access(req, res, meta = {}) {
        const accessInfo = {
            method: req.method,
            url: req.originalUrl || req.url,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            statusCode: res.statusCode,
            responseTime: meta.responseTime || 'N/A',
            userId: req.user?.id || 'Anonymous',
            ...meta
        };

        const message = `${req.method} ${req.originalUrl || req.url} - ${res.statusCode}`;
        const logContent = this.formatLogMessage('ACCESS', message, accessInfo);
        const filename = `access-${this.getDateString()}.log`;
        this.writeToFile(this.accessLogDir, filename, logContent);
    }

    // Database operation logs
    database(operation, collection, query = {}, meta = {}) {
        const dbMeta = {
            operation,
            collection,
            query: JSON.stringify(query),
            ...meta
        };
        
        const message = `DB ${operation.toUpperCase()} on ${collection}`;
        this.info(message, dbMeta);
    }

    // Authentication logs
    auth(action, userId, meta = {}) {
        const authMeta = {
            action,
            userId,
            ...meta
        };
        
        const message = `Auth ${action.toUpperCase()} for user ${userId}`;
        this.info(message, authMeta);
    }

    // API logs
    api(endpoint, method, statusCode, responseTime, meta = {}) {
        const apiMeta = {
            endpoint,
            method,
            statusCode,
            responseTime: `${responseTime}ms`,
            ...meta
        };
        
        const message = `API ${method} ${endpoint} - ${statusCode} (${responseTime}ms)`;
        this.info(message, apiMeta);
    }

    // Log file cleanup (remove old logs)
    cleanup(daysToKeep = 30) {
        const directories = [this.appLogDir, this.errorLogDir, this.accessLogDir];
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        directories.forEach(dir => {
            try {
                const files = fs.readdirSync(dir);
                files.forEach(file => {
                    const filePath = path.join(dir, file);
                    const stats = fs.statSync(filePath);
                    
                    if (stats.mtime < cutoffDate) {
                        fs.unlinkSync(filePath);
                        this.info(`Cleaned up old log file: ${file}`);
                    }
                });
            } catch (error) {
                this.error('Failed to cleanup old logs', error);
            }
        });
    }

    // Get log file path for a specific date and type
    getLogFilePath(type, date = null) {
        const dateString = date || this.getDateString();
        const logDirs = {
            app: this.appLogDir,
            error: this.errorLogDir,
            access: this.accessLogDir
        };
        
        const filename = `${type}-${dateString}.log`;
        return path.join(logDirs[type], filename);
    }

    // Read logs from a specific file
    readLogs(type, date = null, lines = 100) {
        const filePath = this.getLogFilePath(type, date);
        
        try {
            if (!fs.existsSync(filePath)) {
                return [];
            }
            
            const content = fs.readFileSync(filePath, 'utf8');
            const logLines = content.split('\n').filter(line => line.trim());
            
            // Return last N lines
            return logLines.slice(-lines);
        } catch (error) {
            this.error('Failed to read log file', error, { filePath });
            return [];
        }
    }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger;