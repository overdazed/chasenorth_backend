const mongoose = require('mongoose');
const Counter = require('./Counter');

const reportSchema = new mongoose.Schema({
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    referenceNumber: {
        type: String,
        unique: true
    },
    problemType: {
        type: String,
        required: true
    },
    details: String,
    desiredOutcome: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Submitted', 'In Review', 'Needs Info', 'Rejected', 'Resolved', 'Archived'],
        default: 'Submitted'
    },
    archivedAt: {
        type: Date,
        default: null
    },
    adminNotes: [{
        content: String,
        adminName: String,
        timestamp: { type: Date, default: Date.now },
        status: { type: String, default: 'Submitted' },
        editedAt: { type: Date }
    }],
    attachments: [{
        filename: String,
        path: String,
        mimetype: String
    }]
}, { timestamps: true });

reportSchema.pre('save', async function(next) {
    if (!this.referenceNumber) {
        try {
            const counter = await Counter.findByIdAndUpdate(
                { _id: 'reportRef' },
                { $inc: { seq: 1 } },
                { new: true, upsert: true }
            );
            this.referenceNumber = `REF-${counter.seq}`;
        } catch (error) {
            console.error('Error generating reference number:', error);
            // Fallback to timestamp if counter fails
            this.referenceNumber = `REF-${Date.now()}`;
        }
    }
    next();
});

// const Report = mongoose.model('Report', reportSchema);
module.exports = mongoose.model('Report', reportSchema);