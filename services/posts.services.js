const mongoose = require('mongoose');
const Post = require('../models/posts.model');
const User = require('../models/user.model');
const AppError = require('../utils/appError');
const { getCurrentTime } = require('../utils/CurrentTime');
const { getCommentsByPostId, getCommentsCountByPostId } = require('./comments.services');

/**
 * Create a new post
 * @param {Object} postData - Post data object
 * @param {String} userId - ID of the user creating the post
 * @returns {Object} Created post object
 */
const createPost = async (postData, userId) => {
    try {
        const { title, caption, content } = postData;

        // Validate required fields
        if (!title || !content) {
            throw new AppError('Title and content are required', 400);
        }

        // Validate user exists
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new AppError('Invalid user ID format', 400);
        }

        const user = await User.findById(userId);
        if (!user) {
            throw new AppError('User not found', 404);
        }

        // Validate content is an array
        if (!Array.isArray(content)) {
            throw new AppError('Content must be an array', 400);
        }

        // Create post object
        const newPost = new Post({
            _id: new mongoose.Types.ObjectId(),
            user_id: userId,
            title: title.trim(),
            caption: caption ? caption.trim() : '',
            content: content,
            createdAt: getCurrentTime(),
            updatedAt: getCurrentTime()
        });

        // Save post
        const savedPost = await newPost.save();

        // Populate user information and return
        const populatedPost = await Post.findById(savedPost._id)
            .populate('user_id', 'username email avatar user_type')
            .exec();

        return populatedPost;
    } catch (error) {
        // Re-throw AppError instances
        if (error instanceof AppError) {
            throw error;
        }
        
        // Handle MongoDB validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(val => val.message);
            throw new AppError(`Validation failed: ${errors.join(', ')}`, 400);
        }
        
        // Handle other errors
        throw new AppError('Error creating post', 500);
    }
};

/**
 * Edit/Update a post
 * @param {String} postId - ID of the post to update
 * @param {Object} updateData - Data to update
 * @param {String} userId - ID of the user editing the post
 * @returns {Object} Updated post object
 */
const editPost = async (postId, updateData, userId) => {
    try {
        const { title, caption, content } = updateData;

        // Validate post ID
        if (!mongoose.Types.ObjectId.isValid(postId)) {
            throw new AppError('Invalid post ID format', 400);
        }

        // Validate user ID
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new AppError('Invalid user ID format', 400);
        }

        // Find the post
        const post = await Post.findById(postId);
        if (!post) {
            throw new AppError('Post not found', 404);
        }

        // Find the user
        const user = await User.findById(userId);
        if (!user) {
            throw new AppError('User not found', 404);
        }

        // Check if user owns the post or is admin
        const isOwner = post.user_id.toString() === userId;
        const isAdmin = user.user_type === 1;

        if (!isOwner && !isAdmin) {
            throw new AppError('You can only edit your own posts', 403);
        }

        // Prepare update object
        const updateFields = {};

        // Validate and update title if provided
        if (title !== undefined) {
            if (!title || title.trim().length === 0) {
                throw new AppError('Title cannot be empty', 400);
            }
            updateFields.title = title.trim();
        }

        // Update caption if provided (can be empty)
        if (caption !== undefined) {
            updateFields.caption = caption ? caption.trim() : '';
        }

        // Validate and update content if provided
        if (content !== undefined) {
            if (!Array.isArray(content)) {
                throw new AppError('Content must be an array', 400);
            }
            if (content.length === 0) {
                throw new AppError('Content cannot be empty', 400);
            }
            updateFields.content = content;
        }

        // Always update the updatedAt timestamp
        updateFields.updatedAt = getCurrentTime();

        // Check if there are fields to update
        if (Object.keys(updateFields).length === 1) { // Only updatedAt
            throw new AppError('At least one field (title, caption, or content) must be provided for update', 400);
        }

        // Update the post
        const updatedPost = await Post.findByIdAndUpdate(
            postId,
            updateFields,
            { new: true, runValidators: true }
        ).populate('user_id', 'username email avatar user_type');

        if (!updatedPost) {
            throw new AppError('Failed to update post', 500);
        }

        return updatedPost;
    } catch (error) {
        // Re-throw AppError instances
        if (error instanceof AppError) {
            throw error;
        }
        
        // Handle MongoDB validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(val => val.message);
            throw new AppError(`Validation failed: ${errors.join(', ')}`, 400);
        }
        
        // Handle other errors
        throw new AppError('Error updating post', 500);
    }
};

/**
 * Get post by ID with user details
 * @param {String} postId - ID of the post to retrieve
 * @returns {Object} Post object with user details
 */
const getPostById = async (postId) => {
    try {
        // Validate post ID
        if (!mongoose.Types.ObjectId.isValid(postId)) {
            throw new AppError('Invalid post ID format', 400);
        }

        // Find and populate post
        const post = await Post.findById(postId)
            .populate('user_id', 'username email avatar user_type joined')
            .exec();

        if (!post) {
            throw new AppError('Post not found', 404);
        }

        // Convert to plain object so we can add properties
        const postObject = post.toObject();

        // Add comment count and comments
        try {
            const commentsResult = await getCommentsByPostId(postId);
            console.log(commentsResult);
            postObject.comments = commentsResult?.comments || [];
            postObject.comment_count = commentsResult?.comments ? commentsResult.comments.length : 0;
        } catch (error) {
            postObject.comments = [];
            postObject.comment_count = 0;
        }
        
        return postObject;
    } catch (error) {
        // Re-throw AppError instances
        if (error instanceof AppError) {
            throw error;
        }
        
        // Handle other errors
        throw new AppError('Error retrieving post', 500);
    }
};

/**
 * Get all posts with pagination and user details
 * @param {Object} options - Query options
 * @returns {Object} Posts array with pagination info
 */
const getAllPosts = async (options = {}) => {
    try {
        const {
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            search = '',
            userId = null,
            excludeUserId = null
        } = options;

        const skip = (page - 1) * limit;
        
        // Build query
        let query = {};
        
        // Search in title and caption
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { caption: { $regex: search, $options: 'i' } }
            ];
        }
        
        // Filter by user ID if provided
        if (userId) {
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                throw new AppError('Invalid user ID format', 400);
            }
            query.user_id = userId;
        } else if (excludeUserId) {
            // Only exclude user if we're not filtering by a specific user
            if (!mongoose.Types.ObjectId.isValid(excludeUserId)) {
                throw new AppError('Invalid exclude user ID format', 400);
            }
            query.user_id = { $ne: excludeUserId };
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        const [posts, total] = await Promise.all([
            Post.find(query)
                .populate('user_id', 'username email avatar user_type joined')
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit)).lean(),
            Post.countDocuments(query)
        ]);
        //get comment count 
        for (let post of posts) {
            try {
                const comment_count = await getCommentsCountByPostId(post._id);
                post.comment_count = comment_count || 0;
            } catch (error) {
                // If there's an error getting comments, default to 0
                post.comment_count = 0;
            }
        }
         // Rename user_id → user
        const formattedPosts = posts.map(post => ({
            ...post,
            // user: post.user_id, // rename
        }));

        return {
            post: formattedPosts,
            // pagination: {
            //     currentPage: parseInt(page),
            //     totalPages: Math.ceil(total / limit),
            //     totalPosts: total,
            //     hasNext: skip + posts.length < total,
            //     hasPrev: page > 1
            // }
        };
    } catch (error) {
        // Re-throw AppError instances
        if (error instanceof AppError) {
            throw error;
        }
        
        // Handle other errors
        throw new AppError('Error retrieving posts', 500);
    }
};

/**
 * Get posts by user ID with user details
 * @param {String} userId - ID of the user whose posts to retrieve
 * @param {Object} options - Query options
 * @returns {Object} Posts array with pagination info
 */
const getPostsByUserId = async (userId, options = {}) => {
    try {
        // Validate user ID
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new AppError('Invalid user ID format', 400);
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            throw new AppError('User not found', 404);
        }

        const {
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            search = ''
        } = options;

        const skip = (page - 1) * limit;
        
        // Build query
        let query = { user_id: userId };
        
        // Search in title and caption
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { caption: { $regex: search, $options: 'i' } }
            ];
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        const [posts, total] = await Promise.all([
            Post.find(query)
                .populate('user_id', 'username email avatar user_type joined')
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit)),
            Post.countDocuments(query)
        ]);

        return {
            posts,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                user_type: user.user_type,
                joined: user.joined
            },
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalPosts: total,
                hasNext: skip + posts.length < total,
                hasPrev: page > 1
            }
        };
    } catch (error) {
        // Re-throw AppError instances
        if (error instanceof AppError) {
            throw error;
        }
        
        // Handle other errors
        throw new AppError('Error retrieving user posts', 500);
    }
};

module.exports = {
    createPost,
    editPost,
    getPostById,
    getAllPosts,
    getPostsByUserId
};
