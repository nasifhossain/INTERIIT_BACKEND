const express = require('express');
const router = express.Router();
const upvotesService = require('../services/upvotes.services');
const { optionalAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * POST /upvotes/vote
 * Vote on a comment (upvote or downvote)
 * Body: { commentId, voteType } where voteType is 1 for upvote, -1 for downvote
 * Requires authentication
 */
router.post('/vote', optionalAuth, async (req, res) => {
    try {
        // Check if user is authenticated
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required to vote on comments'
            });
        }

        const { commentId, voteType } = req.body;
        const userId = req.user.id;

        // Validate required fields
        if (!commentId || voteType === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Comment ID and vote type are required',
                details: 'voteType should be 1 for upvote or -1 for downvote'
            });
        }

        const result = await upvotesService.voteComment(commentId, userId, voteType);

        res.status(200).json({
            success: true,
            message: `Comment ${result.action} successfully`,
            data: {
                action: result.action,
                comment: result.comment,
                userVote: result.userVote
            }
        });
    } catch (error) {
        logger.error('Error in vote endpoint', error, {
            userId: req.user?.userId,
            body: req.body
        });

        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Error processing vote'
        });
    }
});

/**
 * POST /upvotes/toggle/:commentId
 * Toggle upvote on a comment (simplified endpoint for upvote only)
 * If user hasn't voted: adds upvote
 * If user has upvoted: removes upvote
 * If user has downvoted: changes to upvote
 * Requires authentication
 */
router.post('/toggle/:commentId', optionalAuth, async (req, res) => {
    try {
        // Check if user is authenticated
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required to vote on comments'
            });
        }

        const { commentId } = req.params;
        const userId = req.user.id;

        // Get current user vote
        const userVote = await upvotesService.getUserVote(commentId, userId);
        
        let voteType;
        if (!userVote.hasVoted || userVote.voteType === -1) {
            // No vote or downvote exists, add upvote
            voteType = 1;
        } else {
            // Upvote exists, remove it (toggle off)
            voteType = 1; // Same type to trigger removal
        }

        const result = await upvotesService.voteComment(commentId, userId, voteType);

        res.status(200).json({
            success: true,
            message: `Comment ${result.action} successfully`,
            data: {
                action: result.action,
                comment: result.comment,
                userVote: result.userVote
            }
        });
    } catch (error) {
        logger.error('Error in toggle upvote endpoint', error, {
            userId: req.user?.userId,
            commentId: req.params.commentId
        });

        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Error toggling upvote'
        });
    }
});

/**
 * GET /upvotes/comment/:commentId/stats
 * Get vote statistics for a comment
 * Public endpoint (no auth required)
 */
router.get('/comment/:commentId/stats', async (req, res) => {
    try {
        const { commentId } = req.params;
        
        const stats = await upvotesService.getCommentVoteStats(commentId);

        res.status(200).json({
            success: true,
            message: 'Vote statistics retrieved successfully',
            data: stats
        });
    } catch (error) {
        logger.error('Error getting comment vote stats', error, {
            commentId: req.params.commentId
        });

        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Error retrieving vote statistics'
        });
    }
});

/**
 * GET /upvotes/comment/:commentId/user-vote
 * Get current user's vote on a specific comment
 * Requires authentication
 */
router.get('/comment/:commentId/user-vote', optionalAuth, async (req, res) => {
    try {
        // Check if user is authenticated
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required to check vote status'
            });
        }

        const { commentId } = req.params;
        const userId = req.user.userId;
        
        const userVote = await upvotesService.getUserVote(commentId, userId);

        res.status(200).json({
            success: true,
            message: 'User vote status retrieved successfully',
            data: userVote
        });
    } catch (error) {
        logger.error('Error getting user vote status', error, {
            userId: req.user?.userId,
            commentId: req.params.commentId
        });

        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Error retrieving vote status'
        });
    }
});

/**
 * GET /upvotes/user/votes
 * Get all votes by the authenticated user
 * Query params: page, limit, voteType, sortBy, sortOrder
 * Requires authentication
 */
router.get('/user/votes', optionalAuth, async (req, res) => {
    try {
        // Check if user is authenticated
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required to view vote history'
            });
        }

        const userId = req.user.userId;
        const options = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 20,
            voteType: req.query.voteType ? parseInt(req.query.voteType) : null,
            sortBy: req.query.sortBy || 'created_at',
            sortOrder: req.query.sortOrder || 'desc'
        };

        // Validate voteType if provided
        if (options.voteType !== null && ![1, -1].includes(options.voteType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid vote type. Use 1 for upvotes, -1 for downvotes, or omit for all votes'
            });
        }

        // Validate limit
        if (options.limit > 100) {
            options.limit = 100; // Cap at 100 for performance
        }

        const result = await upvotesService.getUserVotes(userId, options);

        res.status(200).json({
            success: true,
            message: 'User votes retrieved successfully',
            data: result
        });
    } catch (error) {
        logger.error('Error getting user votes', error, {
            userId: req.user?.userId,
            query: req.query
        });

        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Error retrieving user votes'
        });
    }
});

/**
 * GET /upvotes/user/:userId/votes
 * Get all votes by a specific user (public endpoint with limited info)
 * Query params: page, limit, voteType, sortBy, sortOrder
 * Public endpoint (no auth required)
 */
router.get('/user/:userId/votes', async (req, res) => {
    try {
        const { userId } = req.params;
        const options = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 20,
            voteType: req.query.voteType ? parseInt(req.query.voteType) : null,
            sortBy: req.query.sortBy || 'created_at',
            sortOrder: req.query.sortOrder || 'desc'
        };

        // Validate voteType if provided
        if (options.voteType !== null && ![1, -1].includes(options.voteType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid vote type. Use 1 for upvotes, -1 for downvotes, or omit for all votes'
            });
        }

        // Validate limit
        if (options.limit > 100) {
            options.limit = 100; // Cap at 100 for performance
        }

        const result = await upvotesService.getUserVotes(userId, options);

        // Filter out sensitive information for public endpoint
        const publicResult = {
            ...result,
            user: {
                id: result.user.id,
                username: result.user.username,
                name: result.user.name,
                avatar: result.user.avatar
                // Don't expose email for public endpoint
            }
        };

        res.status(200).json({
            success: true,
            message: 'User votes retrieved successfully',
            data: publicResult
        });
    } catch (error) {
        logger.error('Error getting public user votes', error, {
            userId: req.params.userId,
            query: req.query
        });

        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Error retrieving user votes'
        });
    }
});

/**
 * DELETE /upvotes/comment/:commentId/all
 * Remove all votes from a comment (admin only - used when deleting comments)
 * Requires authentication and admin privileges
 */
router.delete('/comment/:commentId/all', optionalAuth, async (req, res) => {
    try {
        // Check if user is authenticated
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Check if user is admin
        if (req.user.userType !== 1) {
            return res.status(403).json({
                success: false,
                message: 'Admin privileges required to remove all votes'
            });
        }

        const { commentId } = req.params;
        
        const result = await upvotesService.removeAllVotesFromComment(commentId);

        res.status(200).json({
            success: true,
            message: 'All votes removed from comment successfully',
            data: result
        });
    } catch (error) {
        logger.error('Error removing all votes from comment', error, {
            userId: req.user?.userId,
            commentId: req.params.commentId
        });

        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Error removing votes'
        });
    }
});

/**
 * GET /upvotes/:commentId/users?type=1
 * Get users who voted on a comment with specific vote type
 * @param commentId - ID of the comment
 * @query type - Vote type (1 for upvotes, -1 for downvotes)
 * Public endpoint (no auth required)
 */
router.get('/:commentId/users', async (req, res) => {
    try {
        const { commentId } = req.params;
        const { type } = req.query;
        
        // Validate type parameter
        if (!type) {
            return res.status(400).json({
                success: false,
                message: 'Vote type is required',
                details: 'Please provide ?type=1 for upvotes or ?type=-1 for downvotes'
            });
        }
        
        const result = await upvotesService.getVotesUsers(commentId, type);
        
        res.status(200).json({
            success: true,
            message: 'Comment vote users retrieved successfully',
            data: result
        });
    } catch (error) {
        logger.error('Error getting vote users', error, {
            commentId: req.params.commentId,
            type: req.query.type
        });

        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Error retrieving vote users'
        });
    }
});

module.exports = router;