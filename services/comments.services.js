const mongoose = require('mongoose');
const Comment = require('../models/comments.model');
const Post = require('../models/posts.model');
const User = require('../models/user.model');
const Upvote = require('../models/upvotes.model');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');
const { getCurrentTime } = require('../utils/CurrentTime');
const { getCommentVoteStats } = require('./upvotes.services');

/**
 * Helper function to calculate the depth of a comment in the nesting hierarchy
 * @param {String} commentId - ID of the comment
 * @returns {Number} Depth level (0 for top-level comments)
 */
const getCommentDepth = async (commentId) => {
    let depth = 0;
    let currentComment = await Comment.findById(commentId);
    
    while (currentComment && currentComment.parent_comment) {
        depth++;
        currentComment = await Comment.findById(currentComment.parent_comment);
    }
    
    return depth;
};

/**
 * Helper function to build nested comment tree structure
 * @param {Array} comments - Flat array of comments
 * @param {String} parentId - Parent comment ID (null for top-level)
 * @returns {Array} Nested comment structure
 */
const buildCommentTree = (comments, parentId = null) => {
    const children = comments.filter(comment => {
        if (parentId === null) {
            return comment.parent_comment === null || comment.parent_comment === undefined;
        }
        return comment.parent_comment && comment.parent_comment.toString() === parentId.toString();
    });

    return children.map(comment => ({
        ...comment,
        replies: buildCommentTree(comments, comment._id),
        replyCount: comments.filter(c => 
            c.parent_comment && c.parent_comment.toString() === comment._id.toString()
        ).length
    }));
};

/**
 * Create a new comment on a post
 * @param {Object} commentData - Comment data object
 * @param {String} userId - ID of the user creating the comment
 * @returns {Object} Created comment object
 */
const createComment = async (commentData, userId) => {
    try {
        const { post, content, parent_comment } = commentData;

        // Validate required fields
        if (!post || !content) {
            throw new AppError('Post ID and content are required', 400);
        }

        // Validate content is not empty
        if (!content.trim()) {
            throw new AppError('Comment content cannot be empty', 400);
        }

        // Validate post ID format
        if (!mongoose.Types.ObjectId.isValid(post)) {
            throw new AppError('Invalid post ID format', 400);
        }

        // Validate user ID format
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new AppError('Invalid user ID format', 400);
        }

        // Check if post exists
        const postExists = await Post.findById(post);
        if (!postExists) {
            throw new AppError('Post not found', 404);
        }

        // Check if user exists
        const userExists = await User.findById(userId);
        if (!userExists) {
            throw new AppError('User not found', 404);
        }

        // Validate parent comment if provided
        if (parent_comment) {
            if (!mongoose.Types.ObjectId.isValid(parent_comment)) {
                throw new AppError('Invalid parent comment ID format', 400);
            }

            const parentComment = await Comment.findById(parent_comment);
            if (!parentComment) {
                throw new AppError('Parent comment not found', 404);
            }

            // Ensure parent comment belongs to the same post
            if (parentComment.post.toString() !== post) {
                throw new AppError('Parent comment must belong to the same post', 400);
            }

            // Optional: Set a maximum nesting depth (remove this block for unlimited nesting)
            // const maxDepth = 5; // Adjust as needed
            // const depth = await getCommentDepth(parent_comment);
            // if (depth >= maxDepth) {
            //     throw new AppError(`Maximum nesting depth of ${maxDepth} levels exceeded`, 400);
            // }
        }

        // Create comment object
        const newComment = new Comment({
            post: post,
            content: content.trim(),
            user: userId,
            parent_comment: parent_comment || null,
            commented_at: getCurrentTime(),
            upvotes: 0
        });

        // Save comment
        const savedComment = await newComment.save();

        // Populate user and post information and return
        const populatedComment = await Comment.findById(savedComment._id)
            .populate('user', 'username email avatar user_type')
            .populate('post', 'title user_id')
            .exec();

        logger.info('Comment created successfully', {
            commentId: savedComment._id,
            postId: post,
            userId: userId
        });

        return populatedComment;
    } catch (error) {
        logger.error('Error creating comment', error, {
            postId: commentData.post,
            userId: userId
        });

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
        throw new AppError('Error creating comment', 500);
    }
};

/**
 * Get comments for a specific post with pagination
 * @param {String} postId - ID of the post
 * @param {Object} options - Query options
 * @returns {Object} Comments array with pagination info
 */
const getCommentsByPostId = async (postId, options = {}) => {
    try {
        // Validate post ID
        if (!mongoose.Types.ObjectId.isValid(postId)) {
            throw new AppError('Invalid post ID format', 400);
        }

        // Check if post exists
        const post = await Post.findById(postId);
        if (!post) {
            throw new AppError('Post not found', 404);
        }

        const {
            page = 1,
            limit = 20,
            sortBy = 'commented_at',
            sortOrder = 'desc',
            includeReplies = true,
            nested = true // New option to return nested structure
        } = options;

        const skip = (page - 1) * limit;
        
        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        if (nested && includeReplies) {
            // Get all comments for the post (no pagination for nested view)
            const allComments = await Comment.find({ post: postId })
                .populate('user', 'username email avatar user_type')
                .sort(sort)
                .lean();
            for (const comment of allComments) {
                comment.stats = await getCommentVoteStats(comment._id);
            }

            post.comment_count = allComments?.length || 0;
            // Build nested tree structure
            const nestedComments = buildCommentTree(allComments);
            
            // Apply pagination to top-level comments only
            const total = nestedComments.length;
            const paginatedComments = nestedComments.slice(skip, skip + limit);

            logger.info('Nested comments retrieved successfully', {
                postId: postId,
                topLevelCommentsCount: paginatedComments.length,
                totalTopLevelComments: total,
                totalCommentsInPost: allComments.length
            });

            return {
                comments: paginatedComments,
                post: {
                    id: post._id,
                    title: post.title,
                    user_id: post.user_id,
                    comment_count: post.comment_count
                },
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / limit),
                    totalComments: total,
                    hasNext: skip + paginatedComments.length < total,
                    hasPrev: page > 1
                }
            };
        }

        // Original logic for flat structure or top-level only
        const [topLevelComments, total] = await Promise.all([
            Comment.find({ 
                post: postId, 
                parent_comment: null 
            })
                .populate('user', 'username email avatar user_type')
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Comment.countDocuments({ 
                post: postId, 
                parent_comment: null 
            })
        ]);

        let comments = topLevelComments;

        // If includeReplies is true, fetch direct replies for each top-level comment
        if (includeReplies && topLevelComments.length > 0) {
            const commentIds = topLevelComments.map(comment => comment._id);
            
            // Get all replies for these comments
            const replies = await Comment.find({
                parent_comment: { $in: commentIds }
            })
                .populate('user', 'username email avatar user_type')
                .sort({ commented_at: 1 }) // Replies sorted by oldest first
                .lean();

            // Group replies by parent comment
            const repliesMap = replies.reduce((acc, reply) => {
                const parentId = reply.parent_comment.toString();
                if (!acc[parentId]) {
                    acc[parentId] = [];
                }
                acc[parentId].push(reply);
                return acc;
            }, {});

            // Add replies to their parent comments
            comments = topLevelComments.map(comment => ({
                ...comment,
                replies: repliesMap[comment._id.toString()] || [],
                replyCount: (repliesMap[comment._id.toString()] || []).length
            }));
        } else {
            // Just add reply count without fetching actual replies
            const commentIds = topLevelComments.map(comment => comment._id);
            const replyCounts = await Comment.aggregate([
                { $match: { parent_comment: { $in: commentIds } } },
                { $group: { _id: '$parent_comment', count: { $sum: 1 } } }
            ]);

            const replyCountMap = replyCounts.reduce((acc, item) => {
                acc[item._id.toString()] = item.count;
                return acc;
            }, {});

            comments = topLevelComments.map(comment => ({
                ...comment,
                replyCount: replyCountMap[comment._id.toString()] || 0
            }));
        }

        logger.info('Comments retrieved successfully', {
            postId: postId,
            topLevelCommentsCount: comments.length,
            totalTopLevelComments: total,
            includeReplies
        });

        return {
            comments,
            post: {
                id: post._id,
                title: post.title,
                user_id: post.user_id
            },
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalComments: total, // This is top-level comments only
                hasNext: skip + comments.length < total,
                hasPrev: page > 1
            }
        };
    } catch (error) {
        logger.error('Error retrieving comments', error, { postId });

        // Re-throw AppError instances
        if (error instanceof AppError) {
            throw error;
        }
        
        // Handle other errors
        throw new AppError('Error retrieving comments', 500);
    }
};

/**
 * Get a specific comment by ID
 * @param {String} commentId - ID of the comment to retrieve
 * @returns {Object} Comment object with user and post details
 */
const getCommentById = async (commentId) => {
    try {
        // Validate comment ID
        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            throw new AppError('Invalid comment ID format', 400);
        }

        // Find and populate comment
        const comment = await Comment.findById(commentId)
            .populate('user', 'username email avatar user_type joined')
            .populate('post', 'title user_id createdAt')
            .populate('parent_comment', 'content user commented_at')
            .exec();

        if (!comment) {
            throw new AppError('Comment not found', 404);
        }

        // Get replies if this comment has any
        let replies = [];
        replies = await Comment.find({ parent_comment: commentId })
            .populate('user', 'username email avatar user_type')
            .sort({ commented_at: 1 })
            .lean();

        // Build nested structure for replies
        const nestedReplies = buildCommentTree(replies);

        // Calculate comment depth
        const depth = await getCommentDepth(commentId);

        // Create response object
        const commentWithReplies = {
            ...comment.toObject(),
            replies: nestedReplies,
            replyCount: replies.length,
            depth: depth
        };

        logger.info('Comment retrieved successfully', { 
            commentId,
            hasParent: !!comment.parent_comment,
            replyCount: replies.length,
            depth: depth
        });

        return commentWithReplies;
    } catch (error) {
        logger.error('Error retrieving comment', error, { commentId });

        // Re-throw AppError instances
        if (error instanceof AppError) {
            throw error;
        }
        
        // Handle other errors
        throw new AppError('Error retrieving comment', 500);
    }
};

/**
 * Update a comment
 * @param {String} commentId - ID of the comment to update
 * @param {Object} updateData - Data to update
 * @param {String} userId - ID of the user updating the comment
 * @returns {Object} Updated comment object
 */
const updateComment = async (commentId, updateData, userId) => {
    try {
        const { content } = updateData;

        // Validate comment ID
        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            throw new AppError('Invalid comment ID format', 400);
        }

        // Validate user ID
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new AppError('Invalid user ID format', 400);
        }

        // Validate content
        if (!content || !content.trim()) {
            throw new AppError('Comment content cannot be empty', 400);
        }

        // Find the comment
        const comment = await Comment.findById(commentId);
        if (!comment) {
            throw new AppError('Comment not found', 404);
        }

        // Find the user
        const user = await User.findById(userId);
        if (!user) {
            throw new AppError('User not found', 404);
        }

        // Check if user owns the comment or is admin
        const isOwner = comment.user.toString() === userId;
        const isAdmin = user.user_type === 1;

        if (!isOwner && !isAdmin) {
            throw new AppError('You can only edit your own comments', 403);
        }

        // Update the comment
        const updatedComment = await Comment.findByIdAndUpdate(
            commentId,
            { content: content.trim() },
            { new: true, runValidators: true }
        ).populate('user', 'username email avatar user_type')
         .populate('post', 'title user_id');

        if (!updatedComment) {
            throw new AppError('Failed to update comment', 500);
        }

        logger.info('Comment updated successfully', {
            commentId,
            userId,
            isAdmin
        });

        return updatedComment;
    } catch (error) {
        logger.error('Error updating comment', error, {
            commentId,
            userId
        });

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
        throw new AppError('Error updating comment', 500);
    }
};

/**
 * Delete a comment
 * @param {String} commentId - ID of the comment to delete
 * @param {String} userId - ID of the user deleting the comment
 * @returns {Object} Success message
 */
const deleteComment = async (commentId, userId) => {
    try {
        // Validate comment ID
        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            throw new AppError('Invalid comment ID format', 400);
        }

        // Validate user ID
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new AppError('Invalid user ID format', 400);
        }

        // Find the comment
        const comment = await Comment.findById(commentId);
        if (!comment) {
            throw new AppError('Comment not found', 404);
        }

        // Find the user
        const user = await User.findById(userId);
        if (!user) {
            throw new AppError('User not found', 404);
        }

        // Check if user owns the comment or is admin
        const isOwner = comment.user.toString() === userId;
        const isAdmin = user.user_type === 1;

        if (!isOwner && !isAdmin) {
            throw new AppError('You can only delete your own comments', 403);
        }

        // Check if this comment has replies (recursively count all descendants)
        const getAllDescendants = async (commentId) => {
            const directReplies = await Comment.find({ parent_comment: commentId });
            let allDescendants = [...directReplies];
            
            for (const reply of directReplies) {
                const descendants = await getAllDescendants(reply._id);
                allDescendants = allDescendants.concat(descendants);
            }
            
            return allDescendants;
        };

        const descendants = await getAllDescendants(commentId);
        const totalDescendants = descendants.length;
        
        // Delete all descendants first (replies, sub-replies, etc.)
        if (totalDescendants > 0) {
            const descendantIds = descendants.map(d => d._id);
            
            // Delete upvotes for all descendant comments
            await Upvote.deleteMany({ comment: { $in: descendantIds } });
            
            await Comment.deleteMany({ _id: { $in: descendantIds } });
            logger.info(`Deleted ${totalDescendants} nested replies for comment ${commentId}`);
        }

        // Delete upvotes for the main comment
        await Upvote.deleteMany({ comment: commentId });

        // Delete the comment
        const deletedComment = await Comment.findByIdAndDelete(commentId);
        if (!deletedComment) {
            throw new AppError('Failed to delete comment', 500);
        }

        logger.info('Comment deleted successfully', {
            commentId,
            userId,
            postId: comment.post,
            isAdmin,
            deletedNestedReplies: totalDescendants
        });

        return {
            success: true,
            message: 'Comment deleted successfully',
            deletedComment: {
                id: commentId,
                post: comment.post,
                deletedNestedReplies: totalDescendants
            }
        };
    } catch (error) {
        logger.error('Error deleting comment', error, {
            commentId,
            userId
        });

        // Re-throw AppError instances
        if (error instanceof AppError) {
            throw error;
        }
        
        // Handle other errors
        throw new AppError('Error deleting comment', 500);
    }
};

/**
 * Upvote a comment (deprecated - use upvotes.services.js for full voting functionality)
 * @param {String} commentId - ID of the comment to upvote
 * @param {String} userId - ID of the user upvoting
 * @returns {Object} Updated comment object
 * @deprecated Use upvotes.services.js voteComment() function instead
 */
const upvoteComment = async (commentId, userId) => {
    try {
        // This is a simplified version for backward compatibility
        // For full voting functionality including downvotes and vote toggling,
        // use the upvotes.services.js module
        
        // Validate comment ID
        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            throw new AppError('Invalid comment ID format', 400);
        }

        // Validate user ID
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new AppError('Invalid user ID format', 400);
        }

        // Find the comment
        const comment = await Comment.findById(commentId);
        if (!comment) {
            throw new AppError('Comment not found', 404);
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            throw new AppError('User not found', 404);
        }

        // Check if user has already upvoted this comment
        const existingUpvote = await Upvote.findOne({
            user: userId,
            comment: commentId,
            type: 1
        });

        if (existingUpvote) {
            throw new AppError('You have already upvoted this comment', 409);
        }

        // Check if user has downvoted and remove it
        const existingDownvote = await Upvote.findOne({
            user: userId,
            comment: commentId,
            type: -1
        });

        let voteDifference = 1;
        if (existingDownvote) {
            await Upvote.findByIdAndDelete(existingDownvote._id);
            voteDifference = 2; // Removing downvote and adding upvote
        }

        // Create new upvote
        const newUpvote = new Upvote({
            user: userId,
            comment: commentId,
            type: 1
        });
        await newUpvote.save();

        // Increment upvotes
        const updatedComment = await Comment.findByIdAndUpdate(
            commentId,
            { $inc: { upvotes: voteDifference } },
            { new: true }
        ).populate('user', 'username email avatar user_type')
         .populate('post', 'title user_id');

        if (!updatedComment) {
            throw new AppError('Failed to upvote comment', 500);
        }

        logger.info('Comment upvoted successfully', {
            commentId,
            userId,
            newUpvoteCount: updatedComment.upvotes,
            removedDownvote: !!existingDownvote
        });

        return updatedComment;
    } catch (error) {
        logger.error('Error upvoting comment', error, {
            commentId,
            userId
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
        throw new AppError('Error upvoting comment', 500);
    }
};

/**
 * Get comments by user ID with pagination
 * @param {String} userId - ID of the user whose comments to retrieve
 * @param {Object} options - Query options
 * @returns {Object} Comments array with pagination info
 */
const getCommentsByUserId = async (userId, options = {}) => {
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
            limit = 20,
            sortBy = 'commented_at',
            sortOrder = 'desc'
        } = options;

        const skip = (page - 1) * limit;
        
        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        const [comments, total] = await Promise.all([
            Comment.find({ user: userId })
                .populate('post', 'title user_id createdAt')
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Comment.countDocuments({ user: userId })
        ]);

        logger.info('User comments retrieved successfully', {
            userId,
            commentsCount: comments.length,
            totalComments: total
        });

        return {
            comments,
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
                totalComments: total,
                hasNext: skip + comments.length < total,
                hasPrev: page > 1
            }
        };
    } catch (error) {
        logger.error('Error retrieving user comments', error, { userId });

        // Re-throw AppError instances
        if (error instanceof AppError) {
            throw error;
        }
        
        // Handle other errors
        throw new AppError('Error retrieving user comments', 500);
    }
};

/**
 * Get comment statistics for a post
 * @param {String} postId - ID of the post
 * @returns {Object} Comment statistics
 */
const getCommentStats = async (postId) => {
    try {
        // Validate post ID
        if (!mongoose.Types.ObjectId.isValid(postId)) {
            throw new AppError('Invalid post ID format', 400);
        }

        // Check if post exists
        const post = await Post.findById(postId);
        if (!post) {
            throw new AppError('Post not found', 404);
        }

        const [totalComments, totalUpvotes, topCommenters, replyStats] = await Promise.all([
            Comment.countDocuments({ post: postId }),
            Comment.aggregate([
                { $match: { post: new mongoose.Types.ObjectId(postId) } },
                { $group: { _id: null, totalUpvotes: { $sum: '$upvotes' } } }
            ]),
            Comment.aggregate([
                { $match: { post: new mongoose.Types.ObjectId(postId) } },
                { $group: { _id: '$user', commentCount: { $sum: 1 } } },
                { $sort: { commentCount: -1 } },
                { $limit: 5 },
                {
                    $lookup: {
                        from: 'users',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'user'
                    }
                },
                { $unwind: '$user' },
                {
                    $project: {
                        _id: 1,
                        commentCount: 1,
                        'user.username': 1,
                        'user.avatar': 1
                    }
                }
            ]),
            Comment.aggregate([
                { $match: { post: new mongoose.Types.ObjectId(postId) } },
                {
                    $group: {
                        _id: null,
                        topLevelComments: {
                            $sum: { $cond: [{ $eq: ['$parent_comment', null] }, 1, 0] }
                        },
                        replies: {
                            $sum: { $cond: [{ $ne: ['$parent_comment', null] }, 1, 0] }
                        }
                    }
                }
            ])
        ]);

        const stats = {
            totalComments,
            topLevelComments: replyStats[0]?.topLevelComments || 0,
            totalReplies: replyStats[0]?.replies || 0,
            totalUpvotes: totalUpvotes[0]?.totalUpvotes || 0,
            topCommenters,
            post: {
                id: post._id,
                title: post.title
            }
        };

        logger.info('Comment stats retrieved successfully', {
            postId,
            totalComments: stats.totalComments,
            topLevelComments: stats.topLevelComments,
            totalReplies: stats.totalReplies,
            totalUpvotes: stats.totalUpvotes
        });

        return stats;
    } catch (error) {
        logger.error('Error retrieving comment stats', error, { postId });

        // Re-throw AppError instances
        if (error instanceof AppError) {
            throw error;
        }
        
        // Handle other errors
        throw new AppError('Error retrieving comment statistics', 500);
    }
};

/**
 * Get replies for a specific comment
 * @param {String} commentId - ID of the parent comment
 * @param {Object} options - Query options
 * @returns {Object} Replies array with pagination info
 */
const getRepliesByCommentId = async (commentId, options = {}) => {
    try {
        // Validate comment ID
        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            throw new AppError('Invalid comment ID format', 400);
        }

        // Check if parent comment exists
        const parentComment = await Comment.findById(commentId);
        if (!parentComment) {
            throw new AppError('Parent comment not found', 404);
        }

        const {
            page = 1,
            limit = 50,
            sortBy = 'commented_at',
            sortOrder = 'asc',
            nested = false // Option to return nested structure for replies
        } = options;

        const skip = (page - 1) * limit;
        
        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        if (nested) {
            // Get all descendants (replies and their replies recursively)
            const allReplies = await Comment.find({ parent_comment: commentId })
                .populate('user', 'username email avatar user_type')
                .sort(sort)
                .lean();

            // Build nested structure for replies
            const nestedReplies = buildCommentTree(allReplies);
            
            // Apply pagination
            const total = nestedReplies.length;
            const paginatedReplies = nestedReplies.slice(skip, skip + limit);

            return {
                replies: paginatedReplies,
                parentComment: {
                    id: parentComment._id,
                    content: parentComment.content,
                    user: parentComment.user,
                    commented_at: parentComment.commented_at,
                    depth: await getCommentDepth(commentId)
                },
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / limit),
                    totalReplies: total,
                    hasNext: skip + paginatedReplies.length < total,
                    hasPrev: page > 1
                }
            };
        }

        // Original flat structure
        const [replies, total] = await Promise.all([
            Comment.find({ parent_comment: commentId })
                .populate('user', 'username email avatar user_type')
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Comment.countDocuments({ parent_comment: commentId })
        ]);

        logger.info('Replies retrieved successfully', {
            parentCommentId: commentId,
            repliesCount: replies.length,
            totalReplies: total
        });

        return {
            replies,
            parentComment: {
                id: parentComment._id,
                content: parentComment.content,
                user: parentComment.user,
                commented_at: parentComment.commented_at,
                depth: await getCommentDepth(commentId)
            },
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalReplies: total,
                hasNext: skip + replies.length < total,
                hasPrev: page > 1
            }
        };
    } catch (error) {
        logger.error('Error retrieving replies', error, { commentId });

        // Re-throw AppError instances
        if (error instanceof AppError) {
            throw error;
        }
        
        // Handle other errors
        throw new AppError('Error retrieving replies', 500);
    }
};

/**
 * Get the full comment thread/chain for a specific comment
 * @param {String} commentId - ID of the comment
 * @returns {Object} Full thread with ancestors and descendants
 */
const getCommentThread = async (commentId) => {
    try {
        // Validate comment ID
        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            throw new AppError('Invalid comment ID format', 400);
        }

        // Get the target comment
        const targetComment = await Comment.findById(commentId)
            .populate('user', 'username email avatar user_type')
            .populate('post', 'title user_id');

        if (!targetComment) {
            throw new AppError('Comment not found', 404);
        }

        // Get all ancestors (parent chain)
        const getAncestors = async (comment) => {
            const ancestors = [];
            let current = comment;
            
            while (current.parent_comment) {
                const parent = await Comment.findById(current.parent_comment)
                    .populate('user', 'username email avatar user_type');
                if (parent) {
                    ancestors.unshift(parent); // Add to beginning
                    current = parent;
                } else {
                    break;
                }
            }
            
            return ancestors;
        };

        // Get all descendants (full nested tree)
        const getAllComments = await Comment.find({ post: targetComment.post })
            .populate('user', 'username email avatar user_type')
            .sort({ commented_at: 1 })
            .lean();

        const ancestors = await getAncestors(targetComment);
        const descendants = buildCommentTree(getAllComments.filter(c => 
            c._id.toString() !== commentId
        ), commentId);

        // Find root comment
        const rootComment = ancestors.length > 0 ? ancestors[0] : targetComment;

        logger.info('Comment thread retrieved successfully', {
            commentId,
            ancestorCount: ancestors.length,
            descendantCount: descendants.length,
            depth: await getCommentDepth(commentId)
        });

        return {
            targetComment: {
                ...targetComment.toObject(),
                depth: await getCommentDepth(commentId)
            },
            ancestors: ancestors.map(async (ancestor) => ({
                ...ancestor.toObject(),
                depth: await getCommentDepth(ancestor._id)
            })),
            descendants: descendants,
            rootComment: {
                ...rootComment.toObject(),
                depth: 0
            },
            threadInfo: {
                totalDepth: await getCommentDepth(commentId),
                ancestorCount: ancestors.length,
                descendantCount: descendants.length
            }
        };
    } catch (error) {
        logger.error('Error retrieving comment thread', error, { commentId });

        // Re-throw AppError instances
        if (error instanceof AppError) {
            throw error;
        }
        
        // Handle other errors
        throw new AppError('Error retrieving comment thread', 500);
    }
};

module.exports = {
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
};
