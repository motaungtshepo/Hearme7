const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    role: {
        type: String,
        required: true,
        enum: ['user', 'therapist', 'admin'], 
        default: 'user'
    },
    isAnonymous: {
        type: Boolean,
        default: true
    },
    identifier: {
        type: String,
        required: true,
        unique: true, 
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    displayName: {
        type: String,
        trim: true
    },
    bio: {
        type: String,
        trim: true,
        default: ''
    },
    specialties: {
        type: [String],
        default: []
    }
}, { timestamps: true }); 

module.exports = mongoose.model('User', userSchema);