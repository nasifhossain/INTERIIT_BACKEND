const express = require('express');
const router = express.Router();

// Import middleware
const { 
    authenticateToken, 
    requireAdmin, 
    requireOwnershipOrAdmin,
    validateRequiredFields 
} = require('../middleware');

// Import comment services
const {
    createComment,
    getCommentsByPostId,
    getCommentById,
    updateComment,
    deleteComment,
    upvoteComment,
    getCommentsByUserId,
    getCommentStats,
    getRepliesByCommentId,
    getCommentThread
} = require('../services/comments.services');

// Import utilities
const AppError = require('../utils/appError');
const logger = require('../utils/logger');

/**
 * @route   POST /api/comments
 * @desc    Create a new comment on a post
 * @access  Private (Authenticated users only)
 */
router.post('/', 
    authenticateToken,
    validateRequiredFields(['post', 'content']),
    async (req, res, next) => {
        try {
            const { post, content, parent_comment } = req.body;

            // Validate content is not empty
            if (!content.trim()) {
                return next(new AppError('Comment content cannot be empty', 400));
            }

            const commentData = {
                post: post.trim(),
                content: content.trim(),
                parent_comment: parent_comment || null
            };

            const newComment = await createComment(commentData, req.user.id);

            logger.info('Comment created via API', {
                commentId: newComment._id,
                postId: post,
                userId: req.user.id,
                hasParent: !!parent_comment
            });

            res.status(201).json({
                success: true,
                message: 'Comment created successfully',
                data: {
                    comment: newComment
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route   GET /api/comments/post/:postId
 * @desc    Get all comments for a specific post
 * @access  Public
 */
router.get('/post/:postId', async (req, res, next) => {
    try {
        const { postId } = req.params;
        const {
            page = 1,
            limit = 20,
            sortBy = 'commented_at',
            sortOrder = 'desc',
            includeReplies = 'true',
            nested = 'true'
        } = req.query;

        const options = {
            page: parseInt(page),
            limit: Math.min(parseInt(limit), 100), // Max 100 comments per page
            sortBy,
            sortOrder,
            includeReplies: includeReplies === 'true',
            nested: nested === 'true'
        };

        const result = await getCommentsByPostId(postId, options);

        res.status(200).json({
            success: true,
            message: 'Comments retrieved successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/comments/:id
 * @desc    Get a specific comment by ID
 * @access  Public
 */
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const comment = await getCommentById(id);

        res.status(200).json({
            success: true,
            message: 'Comment retrieved successfully',
            data: {
                comment
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   PUT /api/comments/:id
 * @desc    Update a comment
 * @access  Private (Comment owner or Admin only)
 */
router.put('/:id', 
    authenticateToken,
    validateRequiredFields(['content']),
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const { content } = req.body;

            // Validate content
            if (!content.trim()) {
                return next(new AppError('Comment content cannot be empty', 400));
            }

            const updateData = {
                content: content.trim()
            };

            const updatedComment = await updateComment(id, updateData, req.user.id);

            logger.info('Comment updated via API', {
                commentId: id,
                userId: req.user.id
            });

            res.status(200).json({
                success: true,
                message: 'Comment updated successfully',
                data: {
                    comment: updatedComment
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route   DELETE /api/comments/:id
 * @desc    Delete a comment
 * @access  Private (Comment owner or Admin only)
 */
router.delete('/:id', authenticateToken, async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await deleteComment(id, req.user.id);

        logger.info('Comment deleted via API', {
            commentId: id,
            userId: req.user.id
        });

        res.status(200).json({
            success: true,
            message: result.message,
            data: result.deletedComment
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/comments/:id/upvote
 * @desc    Upvote a comment
 * @access  Private (Authenticated users only)
 */
router.post('/:id/upvote', authenticateToken, async (req, res, next) => {
    try {
        const { id } = req.params;

        const updatedComment = await upvoteComment(id, req.user.id);

        logger.info('Comment upvoted via API', {
            commentId: id,
            userId: req.user.id,
            newUpvoteCount: updatedComment.upvotes
        });

        res.status(200).json({
            success: true,
            message: 'Comment upvoted successfully',
            data: {
                comment: updatedComment
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/comments/:id/replies
 * @desc    Get replies for a specific comment
 * @access  Public
 */
router.get('/:id/replies', async (req, res, next) => {
    try {
        const { id } = req.params;
        const {
            page = 1,
            limit = 50,
            sortBy = 'commented_at',
            sortOrder = 'asc',
            nested = 'false'
        } = req.query;

        const options = {
            page: parseInt(page),
            limit: Math.min(parseInt(limit), 100), // Max 100 replies per page
            sortBy,
            sortOrder,
            nested: nested === 'true'
        };

        const result = await getRepliesByCommentId(id, options);

        res.status(200).json({
            success: true,
            message: 'Replies retrieved successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/comments/:id/thread
 * @desc    Get the full comment thread/context for a specific comment
 * @access  Public
 */
router.get('/:id/thread', async (req, res, next) => {
    try {
        const { id } = req.params;

        const threadData = await getCommentThread(id);

        res.status(200).json({
            success: true,
            message: 'Comment thread retrieved successfully',
            data: threadData
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/comments/user/:userId
 * @desc    Get all comments by a specific user
 * @access  Public
 */
router.get('/user/:userId', async (req, res, next) => {
    try {
        const { userId } = req.params;
        const {
            page = 1,
            limit = 20,
            sortBy = 'commented_at',
            sortOrder = 'desc'
        } = req.query;

        const options = {
            page: parseInt(page),
            limit: Math.min(parseInt(limit), 50), // Max 50 comments per page
            sortBy,
            sortOrder
        };

        const result = await getCommentsByUserId(userId, options);

        res.status(200).json({
            success: true,
            message: 'User comments retrieved successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/comments/my/comments
 * @desc    Get current user's comments
 * @access  Private (Authenticated users only)
 */
router.get('/my/comments', authenticateToken, async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 20,
            sortBy = 'commented_at',
            sortOrder = 'desc'
        } = req.query;

        const options = {
            page: parseInt(page),
            limit: Math.min(parseInt(limit), 50), // Max 50 comments per page
            sortBy,
            sortOrder
        };

        const result = await getCommentsByUserId(req.user.id, options);

        res.status(200).json({
            success: true,
            message: 'Your comments retrieved successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/comments/stats/post/:postId
 * @desc    Get comment statistics for a specific post
 * @access  Public
 */
router.get('/stats/post/:postId', async (req, res, next) => {
    try {
        const { postId } = req.params;

        const stats = await getCommentStats(postId);

        res.status(200).json({
            success: true,
            message: 'Comment statistics retrieved successfully',
            data: stats
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/comments/bulk-delete
 * @desc    Delete multiple comments (Admin only)
 * @access  Admin only
 */
router.post('/bulk-delete', 
    authenticateToken, 
    requireAdmin,
    validateRequiredFields(['commentIds']),
    async (req, res, next) => {
        try {
            const { commentIds } = req.body;

            if (!Array.isArray(commentIds) || commentIds.length === 0) {
                return next(new AppError('commentIds must be a non-empty array', 400));
            }

            const results = [];
            const errors = [];

            for (const commentId of commentIds) {
                try {
                    const result = await deleteComment(commentId, req.user.id);
                    results.push({ 
                        commentId, 
                        success: true, 
                        message: result.message,
                        deletedNestedReplies: result.deletedComment.deletedNestedReplies || 0
                    });
                } catch (error) {
                    errors.push({ commentId, success: false, error: error.message });
                }
            }

            logger.info('Bulk comment deletion completed', {
                adminId: req.user.id,
                totalAttempted: commentIds.length,
                successful: results.length,
                failed: errors.length
            });

            res.status(200).json({
                success: true,
                message: `Bulk delete completed. ${results.length} successful, ${errors.length} failed`,
                data: {
                    successful: results,
                    failed: errors,
                    summary: {
                        total: commentIds.length,
                        successful: results.length,
                        failed: errors.length,
                        totalNestedDeleted: results.reduce((sum, r) => sum + (r.deletedNestedReplies || 0), 0)
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route   GET /api/comments/moderation/flagged
 * @desc    Get comments that might need moderation (Admin only)
 * @access  Admin only
 */
router.get('/moderation/flagged', authenticateToken, requireAdmin, async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 20,
            sortBy = 'commented_at',
            sortOrder = 'desc',
            minUpvotes = 0
        } = req.query;

        // This is a placeholder for moderation logic
        // You can implement custom flagging logic here
        const options = {
            page: parseInt(page),
            limit: Math.min(parseInt(limit), 100),
            sortBy,
            sortOrder
        };

        // For now, return comments with negative upvotes or specific patterns
        // In a real implementation, you'd have a flagging system
        res.status(200).json({
            success: true,
            message: 'Moderation feature not yet implemented',
            data: {
                comments: [],
                pagination: {
                    currentPage: 1,
                    totalPages: 0,
                    totalComments: 0,
                    hasNext: false,
                    hasPrev: false
                }
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/comments/:id/report
 * @desc    Report a comment for moderation
 * @access  Private (Authenticated users only)
 */
router.post('/:id/report', 
    authenticateToken,
    validateRequiredFields(['reason']),
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const { reason, details } = req.body;

            // Validate the comment exists
            await getCommentById(id);

            // Log the report (in a real app, you'd store this in a reports collection)
            logger.info('Comment reported', {
                commentId: id,
                reportedBy: req.user.id,
                reason: reason,
                details: details || 'No additional details provided'
            });

            // In a real implementation, you'd:
            // 1. Store the report in a database
            // 2. Potentially auto-moderate based on number of reports
            // 3. Send notifications to moderators

            res.status(200).json({
                success: true,
                message: 'Comment reported successfully. Our moderation team will review it.',
                data: {
                    reportId: `report_${Date.now()}`, // Placeholder
                    status: 'pending'
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route   GET /api/comments/search
 * @desc    Search comments by content
 * @access  Public
 */
router.get('/search', async (req, res, next) => {
    try {
        const {
            q = '',
            page = 1,
            limit = 20,
            sortBy = 'commented_at',
            sortOrder = 'desc',
            postId = null
        } = req.query;

        if (!q.trim()) {
            return next(new AppError('Search query is required', 400));
        }

        // This is a basic implementation - in production you'd use proper text search
        const Comment = require('../models/comments.model');
        
        let query = {
            content: { $regex: q.trim(), $options: 'i' }
        };

        if (postId) {
            query.post = postId;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortObj = {};
        sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

        const [comments, total] = await Promise.all([
            Comment.find(query)
                .populate('user', 'username email avatar user_type')
                .populate('post', 'title user_id')
                .sort(sortObj)
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Comment.countDocuments(query)
        ]);

        res.status(200).json({
            success: true,
            message: 'Search completed successfully',
            data: {
                comments,
                searchQuery: q,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / parseInt(limit)),
                    totalComments: total,
                    hasNext: skip + comments.length < total,
                    hasPrev: parseInt(page) > 1
                }
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;