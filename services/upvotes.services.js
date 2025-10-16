const mongoose = require('mongoose');
const Upvote = require('../models/upvotes.model');
const Comment = require('../models/comments.model');
const User = require('../models/user.model');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');

/**
 * Upvote or downvote a comment
 * @param {String} commentId - ID of the comment to vote on
 * @param {String} userId - ID of the user voting
 * @param {Number} voteType - 1 for upvote, -1 for downvote
 * @returns {Object} Vote result with updated comment
 */
const voteComment = async (commentId, userId, voteType) => {
    try {
        // Validate inputs
        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            throw new AppError('Invalid comment ID format', 400);
        }

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new AppError('Invalid user ID format', 400);
        }

        if (![1, -1].includes(voteType)) {
            throw new AppError('Vote type must be 1 (upvote) or -1 (downvote)', 400);
        }

        // Check if comment exists
        const comment = await Comment.findById(commentId);
        if (!comment) {
            throw new AppError('Comment not found', 404);
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            throw new AppError('User not found', 404);
        }

        // Check if user has already voted on this comment
        const existingVote = await Upvote.findOne({
            user: userId,
            comment: commentId
        });

        let voteAction = '';
        let voteDifference = 0;

        if (existingVote) {
            if (existingVote.type === voteType) {
                // User is removing their vote (clicking same vote type)
                await Upvote.findByIdAndDelete(existingVote._id);
                voteDifference = -voteType; // Reverse the previous vote
                voteAction = voteType === 1 ? 'removed_upvote' : 'removed_downvote';
            } else {
                // User is changing their vote
                existingVote.type = voteType;
                await existingVote.save();
                voteDifference = voteType * 2; // Double because we're reversing and applying
                voteAction = voteType === 1 ? 'changed_to_upvote' : 'changed_to_downvote';
            }
        } else {
            // New vote
            const newVote = new Upvote({
                user: userId,
                comment: commentId,
                type: voteType
            });
            await newVote.save();
            voteDifference = voteType;
            voteAction = voteType === 1 ? 'upvoted' : 'downvoted';
        }

        // Update comment upvotes count
        const updatedComment = await Comment.findByIdAndUpdate(
            commentId,
            { $inc: { upvotes: voteDifference } },
            { new: true }
        ).populate('user', 'username email avatar user_type')
         .populate('post', 'title user_id');

        logger.info('Comment vote processed', {
            commentId,
            userId,
            voteType,
            action: voteAction,
            newUpvoteCount: updatedComment.upvotes
        });

        return {
            success: true,
            action: voteAction,
            comment: updatedComment,
            userVote: existingVote && existingVote.type !== voteType ? null : 
                     (voteAction.includes('removed') ? null : voteType)
        };
    } catch (error) {
        logger.error('Error processing comment vote', error, {
            commentId,
            userId,
            voteType
        });

        // Re-throw AppError instances
        if (error instanceof AppError) {
            throw error;
        }
        
        // Handle MongoDB duplicate key errors
        if (error.code === 11000) {
            throw new AppError('You have already voted on this comment', 409);
        }
        
        // Handle other errors
        throw new AppError('Error processing vote', 500);
    }
};

/**
 * Get user's vote on a specific comment
 * @param {String} commentId - ID of the comment
 * @param {String} userId - ID of the user
 * @returns {Object} User's vote information
 */
const getUserVote = async (commentId, userId) => {
    try {
        // Validate inputs
        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            throw new AppError('Invalid comment ID format', 400);
        }

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new AppError('Invalid user ID format', 400);
        }

        const vote = await Upvote.findOne({
            user: userId,
            comment: commentId
        });

        return {
            hasVoted: !!vote,
            voteType: vote ? vote.type : null,
            votedAt: vote ? vote.created_at : null
        };
    } catch (error) {
        logger.error('Error getting user vote', error, {
            commentId,
            userId
        });

        // Re-throw AppError instances
        if (error instanceof AppError) {
            throw error;
        }
        
        // Handle other errors
        throw new AppError('Error retrieving vote information', 500);
    }
};

/**
 * Get vote statistics for a comment
 * @param {String} commentId - ID of the comment
 * @returns {Object} Vote statistics
 */
const getCommentVoteStats = async (commentId) => {
    try {
        // Validate input
        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            throw new AppError('Invalid comment ID format', 400);
        }

        // Check if comment exists
        const comment = await Comment.findById(commentId);
        if (!comment) {
            throw new AppError('Comment not found', 404);
        }

        const stats = await Upvote.aggregate([
            { $match: { comment: new mongoose.Types.ObjectId(commentId) } },
            {
                $group: {
                    _id: null,
                    totalVotes: { $sum: 1 },
                    upvotes: {
                        $sum: { $cond: [{ $eq: ['$type', 1] }, 1, 0] }
                    },
                    downvotes: {
                        $sum: { $cond: [{ $eq: ['$type', -1] }, 1, 0] }
                    },
                    netScore: { $sum: '$type' }
                }
            }
        ]);

        const result = stats[0] || {
            totalVotes: 0,
            upvotes: 0,
            downvotes: 0,
            netScore: 0
        };

        logger.info('Comment vote stats retrieved', {
            commentId,
            stats: result
        });

        return {
            commentId,
            ...result,
            upvotePercentage: result.totalVotes > 0 ? 
                Math.round((result.upvotes / result.totalVotes) * 100) : 0
        };
    } catch (error) {
        logger.error('Error getting comment vote stats', error, { commentId });

        // Re-throw AppError instances
        if (error instanceof AppError) {
            throw error;
        }
        
        // Handle other errors
        throw new AppError('Error retrieving vote statistics', 500);
    }
};

/**
 * Get all votes by a user
 * @param {String} userId - ID of the user
 * @param {Object} options - Query options
 * @returns {Object} User's votes with pagination
 */
const getUserVotes = async (userId, options = {}) => {
    try {
        // Validate input
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
            limit = 20,
            voteType = null, // Filter by vote type (1, -1, or null for all)
            sortBy = 'created_at',
            sortOrder = 'desc'
        } = options;

        const skip = (page - 1) * limit;
        
        // Build query
        let query = { user: userId };
        if (voteType !== null && [1, -1].includes(voteType)) {
            query.type = voteType;
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        const [votes, total] = await Promise.all([
            Upvote.find(query)
                .populate({
                    path: 'comment',
                    populate: {
                        path: 'user',
                        select: 'username avatar'
                    }
                })
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Upvote.countDocuments(query)
        ]);

        logger.info('User votes retrieved', {
            userId,
            votesCount: votes.length,
            totalVotes: total
        });

        return {
            votes,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                avatar: user.avatar
            },
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalVotes: total,
                hasNext: skip + votes.length < total,
                hasPrev: page > 1
            }
        };
    } catch (error) {
        logger.error('Error retrieving user votes', error, { userId });

        // Re-throw AppError instances
        if (error instanceof AppError) {
            throw error;
        }
        
        // Handle other errors
        throw new AppError('Error retrieving user votes', 500);
    }
};

/**
 * Remove all votes from a comment (used when comment is deleted)
 * @param {String} commentId - ID of the comment
 * @returns {Object} Deletion result
 */
const removeAllVotesFromComment = async (commentId) => {
    try {
        // Validate input
        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            throw new AppError('Invalid comment ID format', 400);
        }

        const result = await Upvote.deleteMany({ comment: commentId });

        logger.info('All votes removed from comment', {
            commentId,
            deletedCount: result.deletedCount
        });

        return {
            success: true,
            deletedVotesCount: result.deletedCount
        };
    } catch (error) {
        logger.error('Error removing votes from comment', error, { commentId });

        // Re-throw AppError instances
        if (error instanceof AppError) {
            throw error;
        }
        
        // Handle other errors
        throw new AppError('Error removing votes', 500);
    }
};

module.exports = {
    voteComment,
    getUserVote,
    getCommentVoteStats,
    getUserVotes,
    removeAllVotesFromComment
};