const express = require('express');
const router = express.Router();

// Import middleware
const { 
    authenticateToken, 
    requireAdmin, 
    requireOwnershipOrAdmin,
    validateRequiredFields 
} = require('../middleware');

// Import user services
const {
    findUserById,
    findUserByEmail,
    findUserByUsername,
    getAllUsers,
    createUser,
    updateUser,
    deleteUser,
    changePassword
} = require('../services/user.services');

// Import utilities
const AppError = require('../utils/appError');
const { generateToken } = require('../utils/jwt');
const { comparePassword } = require('../utils/bcrypt');

/**
 * @route   GET /api/users
 * @desc    Get all users with pagination and filtering
 * @access  Admin only
 */
router.get('/', authenticateToken, requireAdmin, async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 10,
            sortBy = 'joined',
            sortOrder = 'desc',
            search = '',
            user_type = null
        } = req.query;

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sortBy,
            sortOrder,
            search,
            user_type: user_type !== null ? parseInt(user_type) : null
        };

        const result = await getAllUsers(options);

        res.status(200).json({
            success: true,
            message: 'Users retrieved successfully',
            data: result.users,
            pagination: result.pagination
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/users/profile
 * @desc    Get current user's profile
 * @access  Private
 */
router.get('/profile', authenticateToken, async (req, res, next) => {
    try {
        const user = await findUserById(req.user.id, '-password');

        res.status(200).json({
            success: true,
            message: 'Profile retrieved successfully',
            data: user
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private (own profile) or Admin
 */
router.get('/:id', authenticateToken, requireOwnershipOrAdmin('id'), async (req, res, next) => {
    try {
        const user = await findUserById(req.params.id, '-password');

        res.status(200).json({
            success: true,
            message: 'User retrieved successfully',
            data: user
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/users/search/email/:email
 * @desc    Find user by email
 * @access  Admin only
 */
router.get('/search/email/:email', authenticateToken, requireAdmin, async (req, res, next) => {
    try {
        const user = await findUserByEmail(req.params.email, '-password');

        res.status(200).json({
            success: true,
            message: 'User found successfully',
            data: user
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/users/search/username/:username
 * @desc    Find user by username
 * @access  Admin only
 */
router.get('/search/username/:username', authenticateToken, requireAdmin, async (req, res, next) => {
    try {
        const user = await findUserByUsername(req.params.username, '-password');

        res.status(200).json({
            success: true,
            message: 'User found successfully',
            data: user
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/users
 * @desc    Create a new user
 * @access  Public
 */
router.post('/', 
    validateRequiredFields(['username', 'email', 'password']),
    async (req, res, next) => {
        try {
            const userData = {
                username: req.body.username,
                email: req.body.email,
                password: req.body.password,
                avatar: req.body.avatar,
                user_type: 0
            };

            const newUser = await createUser(userData);

            res.status(201).json({
                success: true,
                message: 'User created successfully',
                data: newUser
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route   POST /api/users/admin
 * @desc    Create a new admin user
 * @access  admin only
 */
router.post('/admin', authenticateToken, requireAdmin, validateRequiredFields(['username', 'email', 'password']), async (req, res, next) => {
    try {
        const userData = {
            username: req.body.username,
            email: req.body.email,
            password: req.body.password,
            avatar: req.body.avatar,
            user_type: 1
        };

            const newUser = await createUser(userData);

            res.status(201).json({
                success: true,
                message: 'User created successfully',
                data: newUser
            });
        } catch (error) {
            next(error);
        }
    }
);



/**
 * @route   PUT /api/users/:id
 * @desc    Update user profile
 * @access  Private (own profile) or Admin
 */
router.put('/:id', 
    authenticateToken, 
    requireOwnershipOrAdmin('id'),
    async (req, res, next) => {
        try {
            const updateData = {
                username: req.body.username,
                email: req.body.email,
                avatar: req.body.avatar,
                user_type: req.body.user_type,
                password: req.body.password // For verification only
            };

            // Remove undefined fields
            Object.keys(updateData).forEach(key => {
                if (updateData[key] === undefined) {
                    delete updateData[key];
                }
            });

            const updatedUser = await updateUser(req.params.id, updateData, req.user.id);

            res.status(200).json({
                success: true,
                message: 'User updated successfully',
                data: updatedUser
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route   PUT /api/users/:id/password
 * @desc    Change user password
 * @access  Private (own profile only)
 */
router.put('/:id/password', 
    authenticateToken,
    validateRequiredFields(['current_password', 'new_password']),
    async (req, res, next) => {
        try {
            // Only user can change their own password
            if (req.user.id.toString() !== req.params.id.toString()) {
                throw new AppError('You can only change your own password', 403);
            }

            const result = await changePassword(
                req.params.id,
                req.body.current_password,
                req.body.new_password
            );

            res.status(200).json({
                success: true,
                message: result.message
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user
 * @access  Private (own account) or Admin
 */
router.delete('/:id', authenticateToken, requireOwnershipOrAdmin('id'), async (req, res, next) => {
    try {
        const result = await deleteUser(req.params.id, req.user.id);

        res.status(200).json({
            success: true,
            message: result.message
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/users/stats/overview
 * @desc    Get user statistics overview
 * @access  Admin only
 */
router.get('/stats/overview', authenticateToken, requireAdmin, async (req, res, next) => {
    try {
        const [totalUsers, admins, regularUsers] = await Promise.all([
            getAllUsers({ limit: 1 }),
            getAllUsers({ user_type: 1, limit: 1 }),
            getAllUsers({ user_type: 0, limit: 1 })
        ]);

        const stats = {
            totalUsers: totalUsers.pagination.totalUsers,
            admins: admins.pagination.totalUsers,
            regularUsers: regularUsers.pagination.totalUsers,
            timestamp: new Date()
        };

        res.status(200).json({
            success: true,
            message: 'User statistics retrieved successfully',
            data: stats
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/users/bulk-delete
 * @desc    Delete multiple users
 * @access  Admin only
 */
router.post('/bulk-delete', 
    authenticateToken, 
    requireAdmin,
    validateRequiredFields(['userIds']),
    async (req, res, next) => {
        try {
            const { userIds } = req.body;

            if (!Array.isArray(userIds) || userIds.length === 0) {
                throw new AppError('userIds must be a non-empty array', 400);
            }

            const results = [];
            const errors = [];

            for (const userId of userIds) {
                try {
                    const result = await deleteUser(userId, req.user.id);
                    results.push({ userId, success: true, message: result.message });
                } catch (error) {
                    errors.push({ userId, success: false, error: error.message });
                }
            }

            res.status(200).json({
                success: true,
                message: `Bulk delete completed. ${results.length} successful, ${errors.length} failed`,
                data: {
                    successful: results,
                    failed: errors,
                    summary: {
                        total: userIds.length,
                        successful: results.length,
                        failed: errors.length
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }
);
/**
 * @route   POST /api/users/login
 * @desc    Login user with username or email
 * @access  Public
 */
router.post('/login',
    validateRequiredFields(['identifier', 'password']),
    async (req, res, next) => {
        try {
            const { identifier, password } = req.body;

            // Try to find user by email first, then by username
            let user = null;
            
            // Check if identifier is an email (contains @)
            if (identifier.includes('@')) {
                try {
                    user = await findUserByEmail(identifier, '+password');
                } catch (error) {
                    // User not found by email, continue to try username
                }
            }
            
            // If not found by email, try username
            if (!user) {
                try {
                    user = await findUserByUsername(identifier, '+password');
                } catch (error) {
                    // User not found by username either
                }
            }

            // If still no user found
            if (!user) {
                throw new AppError('Invalid username/email or password', 401);
            }

            // Compare password
            const isMatch = await comparePassword(password, user.password);
            if (!isMatch) {
                throw new AppError('Invalid username/email or password', 401);
            }

            // Generate token
            const token = generateToken({ 
                id: user._id, 
                username: user.username,
                email: user.email,
                user_type: user.user_type 
            });

            res.status(200).json({
                success: true,
                message: 'Login successful',
                data: {
                    token,
                    user: {
                        id: user._id,
                        username: user.username,
                        email: user.email,
                        avatar: user.avatar,
                        user_type: user.user_type,
                        joined: user.joined
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

module.exports = router;
