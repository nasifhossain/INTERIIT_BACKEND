const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const AppError = require('../utils/appError');

// JWT secret key - should be stored in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

/**
 * Middleware to authenticate JWT token
 * Requires valid JWT token in Authorization header
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            throw new AppError('Access token is required', 401);
        }

        // Verify the token
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Find user in database to ensure they still exist
        const user = await User.findById(decoded.id);
        if (!user) {
            throw new AppError('User no longer exists', 401);
        }

        // Attach user info to request object
        req.user = {
            id: user._id,
            username: user.username,
            email: user.email,
            user_type: user.user_type,
            avatar: user.avatar
        };

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new AppError('Token has expired', 401);
        } else if (error.name === 'JsonWebTokenError') {
            throw new AppError('Invalid token', 401);
        } else if (error instanceof AppError) {
            throw error;
        } else {
            throw new AppError('Error authenticating token', 500);
        }
    }
};

/**
 * Middleware for optional authentication
 * If token is provided, it will be verified, if not, it will continue
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                
                // Find user in database
                const user = await User.findById(decoded.id);
                if (user) {
                    req.user = {
                        id: user._id,
                        username: user.username,
                        email: user.email,
                        user_type: user.user_type,
                        avatar: user.avatar
                    };
                }
            } catch (error) {
                // Token is invalid, but we don't return error for optional auth
                req.user = null;
            }
        }
        
        next();
    } catch (error) {
        // Continue even if there's an error with optional auth
        next();
    }
};

/**
 * Middleware to check if user is admin
 * Must be used after authenticateToken middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireAdmin = (req, res, next) => {
    try {
        if (!req.user) {
            throw new AppError('Authentication required', 401);
        }

        if (req.user.user_type !== 1) {
            throw new AppError('Admin access required', 403);
        }

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Middleware to check if user owns the resource or is admin
 * @param {String} userIdParam - Parameter name containing user ID (default: 'userId')
 * @returns {Function} Middleware function
 */
const requireOwnershipOrAdmin = (userIdParam = 'userId') => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                throw new AppError('Authentication required', 401);
            }

            const resourceUserId = req.params[userIdParam] || req.body[userIdParam];
            const isOwner = req.user.id.toString() === resourceUserId;
            const isAdmin = req.user.user_type === 1;

            if (!isOwner && !isAdmin) {
                throw new AppError('You can only access your own resources', 403);
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};

/**
 * Middleware to validate request body fields
 * @param {Array} requiredFields - Array of required field names
 * @returns {Function} Middleware function
 */
const validateRequiredFields = (requiredFields) => {
    return (req, res, next) => {
        try {
            const missingFields = [];
            
            for (const field of requiredFields) {
                if (!req.body[field]) {
                    missingFields.push(field);
                }
            }

            if (missingFields.length > 0) {
                throw new AppError(`Missing required fields: ${missingFields.join(', ')}`, 400);
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};

module.exports = {
    authenticateToken,
    optionalAuth,
    requireAdmin,
    requireOwnershipOrAdmin,
    validateRequiredFields
};