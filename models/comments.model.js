const mongoose = require('mongoose');
const { getCurrentTime } = require('../utils/CurrentTime');
const { Schema } = mongoose;

const commentSchema = new Schema({
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
    upvotes : { type: Number, default: 0 },
    content: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    parent_comment: { type: Schema.Types.ObjectId, ref: 'Comment', default: null },
    commented_at: { type: Date, default: getCurrentTime() }
});

module.exports = mongoose.model('Comment', commentSchema);
