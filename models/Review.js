const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    comment: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000
    },
    qualityRating: {
        type: Number,
        min: 1,
        max: 5,
        required: true
    },
    designRating: {
        type: Number,
        min: 1,
        max: 5,
        required: true
    },
    fitRating: {
        type: Number,
        min: 1,
        max: 5,
        required: true
    },
    images: [{
        url: String,
        altText: String
    }],
    verifiedPurchase: {
        type: Boolean,
        default: false
    },
    helpfulVotes: {
        type: Number,
        default: 0
    },
    helpfulVotesBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    weight: {
        type: Number,
        min: 0,
        default: null
    },
    height: {
        type: Number,
        min: 0,
        default: null
    },
    size: {
        type: String,
        trim: true,
        default: null
    }
}, {
    timestamps: true
});

// Prevent user from submitting more than one review per product
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

// Static method to get average rating of a product
reviewSchema.statics.calculateAverageRating = async function(productId) {
    const stats = await this.aggregate([
        {
            $match: { product: productId }
        },
        {
            $group: {
                _id: '$product',
                averageRating: { $avg: '$rating' },
                numReviews: { $sum: 1 },
                averageQuality: { $avg: '$qualityRating' },
                averageDesign: { $avg: '$designRating' },
                averageFit: { $avg: '$fitRating' }
            }
        }
    ]);

    try {
        await this.model('Product').findByIdAndUpdate(productId, {
            rating: stats[0]?.averageRating.toFixed(1) || 0,
            numReviews: stats[0]?.numReviews || 0,
            'ratings.quality': stats[0]?.averageQuality.toFixed(1) || 0,
            'ratings.design': stats[0]?.averageDesign.toFixed(1) || 0,
            'ratings.fit': stats[0]?.averageFit.toFixed(1) || 0
        });
    } catch (err) {
        console.error(err);
    }
};

// Call calculateAverageRating after save
reviewSchema.post('save', function() {
    this.constructor.calculateAverageRating(this.product);
});

// Call calculateAverageRating before remove
reviewSchema.post('remove', function() {
    this.constructor.calculateAverageRating(this.product);
});

module.exports = mongoose.model('Review', reviewSchema);
