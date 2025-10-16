const mongoose = require('mongoose');
const User = require('../models/user.model');
const AppError = require('../utils/appError');
const { hashPassword, comparePassword, validatePassword } = require('../utils/bcrypt');

/**
 * Find user by ID
 * @param {String} userId - The user ID to find
 * @param {String} selectFields - Fields to select (optional)
 * @returns {Object} User object
 */
const findUserById = async (userId, selectFields = '') => {
    try {
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new AppError('Invalid user ID format', 400);
        }

        const user = await User.findById(userId).select(selectFields);
        
        if (!user) {
            throw new AppError('User not found', 404);
        }

        return user;
    } catch (error) {
        // Re-throw AppError instances
        if (error instanceof AppError) {
            throw error;
        }
        
        // Handle other errors
        throw new AppError('Error finding user', 500);
    }
};

/**
 * Find user by email
 * @param {String} email - The user email to find
 * @param {String} selectFields - Fields to select (optional)
 * @returns {Object} User object
 */
const findUserByEmail = async (email, selectFields = '') => {
    try {
        if (!email) {
            throw new AppError('Email is required', 400);
        }

        const user = await User.findOne({ email }).select(selectFields);
        
        if (!user) {
            throw new AppError('User not found', 404);
        }

        return user;
    } catch (error) {
        // Re-throw AppError instances
        if (error instanceof AppError) {
            throw error;
        }
        
        // Handle other errors
        throw new AppError('Error finding user by email', 500);
    }
};

/**
 * Find user by username
 * @param {String} username - The username to find
 * @param {String} selectFields - Fields to select (optional)
 * @returns {Object} User object
 */
const findUserByUsername = async (username, selectFields = '') => {
    try {
        if (!username) {
            throw new AppError('Username is required', 400);
        }

        const user = await User.findOne({ username }).select(selectFields);
        
        if (!user) {
            throw new AppError('User not found', 404);
        }

        return user;
    } catch (error) {
        // Re-throw AppError instances
        if (error instanceof AppError) {
            throw error;
        }
        
        // Handle other errors
        throw new AppError('Error finding user by username', 500);
    }
};

/**
 * Get all users with pagination
 * @param {Object} options - Query options
 * @returns {Object} Users array and pagination info
 */
const getAllUsers = async (options = {}) => {
    const {
        page = 1,
        limit = 10,
        sortBy = 'joined',
        sortOrder = 'desc',
        search = '',
        user_type = null
    } = options;

    const skip = (page - 1) * limit;
    
    // Build query
    let query = {};
    
    if (search) {
        query.$or = [
            { username: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
        ];
    }
    
    if (user_type !== null) {
        query.user_type = user_type;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [users, total] = await Promise.all([
        User.find(query)
            .select('-password')
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit)),
        User.countDocuments(query)
    ]);

    return {
        users,
        pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalUsers: total,
            hasNext: skip + users.length < total,
            hasPrev: page > 1
        }
    };
};

/**
 * Create a new user
 * @param {Object} userData - User data object
 * @returns {Object} Created user object (without password)
 */
const createUser = async (userData) => {
    try {
        const { username, email, password, avatar, name, user_type = 0 } = userData;

        // Validate required fields
        if (!username || !email || !password) {
            throw new AppError('Username, email, and password are required', 400);
        }

        // Validate password strength
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            throw new AppError(`Password validation failed: ${passwordValidation.errors.join(', ')}`, 400);
        }

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ email }, { username }]
        });

        if (existingUser) {
            if (existingUser.email === email) {
                throw new AppError('Email already registered', 409);
            }
            if (existingUser.username === username) {
                throw new AppError('Username already taken', 409);
            }
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create user object
        const newUser = new User({
            _id: new mongoose.Types.ObjectId(),
            username,
            email,
            name,
            password: hashedPassword,
            avatar,
            user_type
        });

        // Save user
        const savedUser = await newUser.save();

        // Return user without password
        const userResponse = savedUser.toObject();
        delete userResponse.password;

        return userResponse;
    } catch (error) {
        // Re-throw AppError instances
        if (error instanceof AppError) {
            throw error;
        }
        
        // Handle MongoDB duplicate key errors
        if (error.code === 11000) {
            const field = Object.keys(error.keyValue)[0];
            throw new AppError(`${field} already exists`, 409);
        }
        
        // Handle MongoDB validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(val => val.message);
            throw new AppError(`Validation failed: ${errors.join(', ')}`, 400);
        }
        
        // Handle other errors
        throw new AppError('Error creating user', 500);
    }
};

/**
 * Update user by ID
 * @param {String} userId - The user ID to update
 * @param {Object} updateData - Data to update (must include password for verification)
 * @param {String} requesterId - ID of user making the request
 * @returns {Object} Updated user object (without password)
 */
const updateUser = async (userId, updateData, requesterId) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new AppError('Invalid user ID format', 400);
        }

        // Find the user to update
        const user = await User.findById(userId).select('+password');
        if (!user) {
            throw new AppError('User not found', 404);
        }

        // Find the requester
        const requester = await User.findById(requesterId);
        if (!requester) {
            throw new AppError('Requester not found', 401);
        }

        // Check permissions (user can update own profile or admin can update any)
        const isOwner = user._id.toString() === requesterId.toString();
        // console.log("Requested Id: ", requesterId.toString());
        // console.log("User Id: ", user._id.toString());
        const isAdmin = requester.user_type === 1;

        if (!isOwner && !isAdmin) {
            throw new AppError('You can only update your own profile', 403);
        }

        // Require password for verification (except for admin updating other users)
        if (!isAdmin || isOwner) {
            if (!updateData.password) {
                throw new AppError('Current password is required to update profile', 400);
            }

            // Verify current password
            const isPasswordValid = await comparePassword(updateData.password, user.password);
            if (!isPasswordValid) {
                throw new AppError('Current password is incorrect', 400);
            }
        }

        // Prevent non-admins from changing user_type
        if(!isAdmin) updateData.user_type = user.user_type;
        // if (updateData.user_type !== undefined && !isAdmin) {
        //     throw new AppError('Only admins can change user type', 403);
        // }

        // Check for unique constraints if updating email or username
        if (updateData.email || updateData.username) {
            const query = { _id: { $ne: userId } };
            const orConditions = [];

            if (updateData.email) {
                orConditions.push({ email: updateData.email });
            }
            if (updateData.username) {
                orConditions.push({ username: updateData.username });
            }

            if (orConditions.length > 0) {
                query.$or = orConditions;
                const existingUser = await User.findOne(query);

                if (existingUser) {
                    if (existingUser.email === updateData.email) {
                        throw new AppError('Email already registered', 409);
                    }
                    if (existingUser.username === updateData.username) {
                        throw new AppError('Username already taken', 409);
                    }
                }
            }
        }

        // Remove password and _id from update data before saving
        const { password, _id, ...profileUpdateData } = updateData;

        // Update user
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            profileUpdateData,
            { new: true, runValidators: true }
        ).select('-password');

        if (!updatedUser) {
            throw new AppError('Failed to update user', 500);
        }

        return updatedUser;
    } catch (error) {
        // Re-throw AppError instances
        if (error instanceof AppError) {
            throw error;
        }
        
        // Handle MongoDB duplicate key errors
        if (error.code === 11000) {
            const field = Object.keys(error.keyValue)[0];
            throw new AppError(`${field} already exists`, 409);
        }
        
        // Handle MongoDB validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(val => val.message);
            throw new AppError(`Validation failed: ${errors.join(', ')}`, 400);
        }
        
        // Handle other errors
        console.error('Error updating user - Details:', error);
        throw new AppError('Error updating user', 500);
    }
};

/**
 * Delete user by ID
 * @param {String} userId - The user ID to delete
 * @param {String} requesterId - ID of user making the request
 * @returns {Object} Success message
 */
const deleteUser = async (userId, requesterId) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new AppError('Invalid user ID format', 400);
        }

        // Find the user to delete
        const user = await User.findById(userId);
        if (!user) {
            throw new AppError('User not found', 404);
        }

        // Find the requester
        const requester = await User.findById(requesterId);
        if (!requester) {
            throw new AppError('Requester not found', 401);
        }

        // Check permissions (user can delete own account or admin can delete any)
        const isOwner = user._id.toString() === requesterId;
        const isAdmin = requester.user_type === 1;

        if (!isOwner && !isAdmin) {
            throw new AppError('You can only delete your own account', 403);
        }

        // Prevent deletion of the last admin
        if (user.user_type === 1) {
            const adminCount = await User.countDocuments({ user_type: 1 });
            if (adminCount <= 1) {
                throw new AppError('Cannot delete the last admin user', 403);
            }
        }

        // Delete user
        await User.findByIdAndDelete(userId);

        return {
            success: true,
            message: 'User deleted successfully'
        };
    } catch (error) {
        // Re-throw AppError instances
        if (error instanceof AppError) {
            throw error;
        }
        
        // Handle other errors
        throw new AppError('Error deleting user', 500);
    }
};

/**
 * Change user password
 * @param {String} userId - The user ID
 * @param {String} currentPassword - Current password
 * @param {String} newPassword - New password
 * @returns {Object} Success message
 */
const changePassword = async (userId, currentPassword, newPassword) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new AppError('Invalid user ID format', 400);
        }

        if (!currentPassword || !newPassword) {
            throw new AppError('Current password and new password are required', 400);
        }

        // Validate new password strength
        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.isValid) {
            throw new AppError(`New password validation failed: ${passwordValidation.errors.join(', ')}`, 400);
        }

        // Find user with password field
        const user = await User.findById(userId).select('+password');
        if (!user) {
            throw new AppError('User not found', 404);
        }

        // Verify current password
        const isCurrentPasswordValid = await comparePassword(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            throw new AppError('Current password is incorrect', 400);
        }

        // Hash new password
        const hashedNewPassword = await hashPassword(newPassword);

        // Update password
        await User.findByIdAndUpdate(userId, { password: hashedNewPassword });

        return {
            success: true,
            message: 'Password changed successfully'
        };
    } catch (error) {
        // Re-throw AppError instances
        if (error instanceof AppError) {
            throw error;
        }
        
        // Handle other errors
        throw new AppError('Error changing password', 500);
    }
};

module.exports = {
    findUserById,
    findUserByEmail,
    findUserByUsername,
    getAllUsers,
    createUser,
    updateUser,
    deleteUser,
    changePassword
};
