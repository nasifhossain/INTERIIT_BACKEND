const express = require('express');
const router = express.Router();
const postServices = require('../services/posts.services');
const { authenticateToken, requireOwnershipOrAdmin } = require('../middleware/auth');
const AppError = require('../utils/appError');

/**
 * @route   POST /api/posts
 * @desc    Create a new post
 * @access  Private (Authenticated users only)
 */
router.post('/', authenticateToken, async (req, res, next) => {
    try {
        const { title, caption, content } = req.body;

        // Validation
        if (!title || !caption) {
            return next(new AppError('Title and caption are required', 400));
        }

        // Create post data
        const postData = {
            title: title.trim(),
            caption: caption.trim(),
            content: Array.isArray(content) ? content.map(item => item.trim()).filter(item => item) : []
        };

        const newPost = await postServices.createPost(postData, req.user.id);

        res.status(201).json({
            success: true,
            message: 'Post created successfully',
            data: {
                post: newPost
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/posts
 * @desc    Get all posts with pagination and filtering
 * @access  Public
 */
router.get('/', async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            search = '',
            userId = null
        } = req.query;

        const options = {
            page: parseInt(page),
            limit: Math.min(parseInt(limit), 50), // Max 50 posts per page
            sortBy,
            sortOrder,
            search,
            userId
        };

        const result = await postServices.getAllPosts(options);

        res.status(200).json({
            success: true,
            message: 'Posts retrieved successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/posts/:id
 * @desc    Get a specific post by ID
 * @access  Public
 */
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const post = await postServices.getPostById(id);

        res.status(200).json({
            success: true,
            message: 'Post retrieved successfully',
            data: {
                post
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   PUT /api/posts/:id
 * @desc    Edit/Update a post
 * @access  Private (Post owner or Admin only)
 */
router.put('/:id', authenticateToken, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { title, caption, image_url, tags } = req.body;

        // Get the post first to check ownership
        const existingPost = await postServices.getPostById(id);
        
        // Check if user is the owner or admin
        if (existingPost.user_id._id.toString() !== req.user.id && req.user.user_type !== 'admin') {
            return next(new AppError('You are not authorized to edit this post', 403));
        }

        // Prepare update data
        const updateData = {};
        
        if (title !== undefined) {
            if (!title.trim()) {
                return next(new AppError('Title cannot be empty', 400));
            }
            updateData.title = title.trim();
        }
        
        if (caption !== undefined) {
            if (!caption.trim()) {
                return next(new AppError('Caption cannot be empty', 400));
            }
            updateData.caption = caption.trim();
        }
        
        if (image_url !== undefined) {
            updateData.image_url = image_url?.trim() || null;
        }
        
        if (tags !== undefined) {
            updateData.tags = Array.isArray(tags) ? tags.map(tag => tag.trim()).filter(tag => tag) : [];
        }

        const updatedPost = await postServices.editPost(id, updateData, req.user.id);

        res.status(200).json({
            success: true,
            message: 'Post updated successfully',
            data: {
                post: updatedPost
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/posts/user/:userId
 * @desc    Get all posts by a specific user
 * @access  Public
 */
router.get('/user/:userId', async (req, res, next) => {
    try {
        const { userId } = req.params;
        const {
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            search = ''
        } = req.query;

        const options = {
            page: parseInt(page),
            limit: Math.min(parseInt(limit), 50), // Max 50 posts per page
            sortBy,
            sortOrder,
            search
        };

        const result = await postServices.getPostsByUserId(userId, options);

        res.status(200).json({
            success: true,
            message: 'User posts retrieved successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/posts/my/posts
 * @desc    Get current user's posts
 * @access  Private (Authenticated users only)
 */
router.get('/my/posts', authenticateToken, async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            search = ''
        } = req.query;

        const options = {
            page: parseInt(page),
            limit: Math.min(parseInt(limit), 50), // Max 50 posts per page
            sortBy,
            sortOrder,
            search
        };

        const result = await postServices.getPostsByUserId(req.user.id, options);

        res.status(200).json({
            success: true,
            message: 'Your posts retrieved successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
