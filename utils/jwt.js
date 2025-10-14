const jwt = require('jsonwebtoken');

// JWT secret key - should be stored in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate JWT token
 * @param {Object} payload - The payload to encode in the token
 * @param {String} expiresIn - Token expiration time (default: 7d)
 * @returns {String} JWT token
 */
const generateToken = (payload, expiresIn = JWT_EXPIRES_IN) => {
    try {
        return jwt.sign(payload, JWT_SECRET, { expiresIn });
    } catch (error) {
        throw new Error('Error generating token: ' + error.message);
    }
};

/**
 * Verify JWT token
 * @param {String} token - The JWT token to verify
 * @returns {Object} Decoded payload
 */
const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new Error('Token has expired');
        } else if (error.name === 'JsonWebTokenError') {
            throw new Error('Invalid token');
        } else {
            throw new Error('Error verifying token: ' + error.message);
        }
    }
};

/**
 * Decode JWT token without verification (for debugging purposes)
 * @param {String} token - The JWT token to decode
 * @returns {Object} Decoded token
 */
const decodeToken = (token) => {
    try {
        return jwt.decode(token, { complete: true });
    } catch (error) {
        throw new Error('Error decoding token: ' + error.message);
    }
};

/**
 * Middleware to authenticate JWT token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ 
            success: false,
            message: 'Access token is required' 
        });
    }

    try {
        const decoded = verifyToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ 
            success: false,
            message: error.message 
        });
    }
};

/**
 * Middleware to authenticate JWT token (optional)
 * If token is provided, it will be verified, if not, it will continue
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        try {
            const decoded = verifyToken(token);
            req.user = decoded;
        } catch (error) {
            // Token is invalid, but we don't return error for optional auth
            req.user = null;
        }
    }
    
    next();
};

/**
 * Generate refresh token
 * @param {Object} payload - The payload to encode in the refresh token
 * @returns {String} Refresh token
 */
const generateRefreshToken = (payload) => {
    try {
        return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
    } catch (error) {
        throw new Error('Error generating refresh token: ' + error.message);
    }
};

/**
 * Generate both access and refresh tokens
 * @param {Object} user - User object
 * @returns {Object} Object containing access and refresh tokens
 */
const generateTokens = (user) => {
    const payload = {
        id: user._id,
        username: user.username,
        email: user.email,
        user_type: user.user_type
    };

    const accessToken = generateToken(payload, '15m'); // Short-lived access token
    const refreshToken = generateRefreshToken({ id: user._id }); // Long-lived refresh token

    return {
        accessToken,
        refreshToken,
        expiresIn: '15m'
    };
};

module.exports = {
    generateToken,
    verifyToken,
    decodeToken,
    authenticateToken,
    optionalAuth,
    generateRefreshToken,
    generateTokens
};
