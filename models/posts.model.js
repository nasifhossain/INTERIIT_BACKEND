const mongoose = require('mongoose');
const { getCurrentTime } = require('../utils/CurrentTime');

const postSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    caption : { type: String },
    content: { type: Array, required: true },
    createdAt: { type: Date, default: getCurrentTime },
    updatedAt: { type: Date, default: getCurrentTime }
});

module.exports = mongoose.model('Post', postSchema);