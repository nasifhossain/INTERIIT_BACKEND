const mongoose = require('mongoose');
const { getCurrentTime } = require('../utils/CurrentTime');
const { Schema } = mongoose;

const upvoteSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    comment: { type: Schema.Types.ObjectId, ref: 'Comment', required: true },
    type: { type: Number, enum: [1, -1], required: true }, // 1 for upvote, -1 for downvote
    created_at: { type: Date, default: getCurrentTime }
});

// Compound index to ensure one vote per user per comment
upvoteSchema.index({ user: 1, comment: 1 }, { unique: true });

module.exports = mongoose.model('Upvote', upvoteSchema);