//mogoose schema for user
const mongoose = require('mongoose');
const { getCurrentTime } = require('../utils/CurrentTime');

const userSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    name: { 
        type: String, 
        default: function() { 
            return this.username; 
        } 
    },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    avatar: { type: String },
    password: { type: String, required: true },
    user_type:{type: Number, required: true, default: 0}, //0 for normal user, 1 for admin
    joined: { type: Date, default:getCurrentTime()},
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

module.exports = User;