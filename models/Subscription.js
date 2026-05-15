const mongoose = require('mongoose');

const newsletterSubscriptionSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
        // match: [/.+@.+\..+/, 'Please fill a valid email address']
    },
    discountCode: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Subscription', newsletterSubscriptionSchema);