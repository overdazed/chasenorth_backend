// import mongoose from "mongoose";
const mongoose = require("mongoose");

// define orderItemSchema
const orderItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    size: String,
    color: String,
    quantity: {
        type: Number,
        required: true
    }
},
    {_id: false }
);

// Add the orderSchema
const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    orderItems: [orderItemSchema],
    shippingAddress: {
        firstName: {
            type: String,
            required: true
        },
        lastName: {
            type: String,
            required: true
        },
        address: {
            type: String,
            required: true
        },
        city: {
            type: String,
            required: true
        },
        postalCode: {
            type: String,
            required: true
        },
        country: {
            type: String,
            required: true
        }
    },
    paymentMethod: {
        type: String,
        required: true
    },
    subtotal: {
        type: Number,
        required: true
    },
    discount: {
        code: String,
        amount: Number,
        percentage: Number,
        isFreeShipping: Boolean
    },
    shippingCost: {
        type: Number,
        required: true,
        default: 0
    },
    totalPrice: {
        type: Number,
        required: true
    },
    // tax: {
    //     type: Number,
    //     required: true
    // },
    // shippingPrice: {
    //     type: Number,
    //     required: true
    // },
    isPaid: {
        type: Boolean,
        default: false
    },
    paidAt: {
        type: Date
    },
    isDelivered: {
        type: Boolean,
        default: false
    },
    deliveredAt: {
        type: Date
    },
    paymentStatus: {
        type: String,
        default: 'pending'
    },
    status: {
        type: String,
        enum: ['Processing', 'Shipped', 'Delivered', 'Cancelled'],
        default: 'Processing'
    },
    invoiceNumber: {
        type: String,
        unique: true,
        sparse: true
    },
    invoicePath: {
        type: String,
        default: ''
    }
}, { timestamps: true }
);

// Add pre-save hook after schema definition
orderSchema.pre('save', async function(next) {
    if (!this.invoiceNumber) {
        this.invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }
    next();
});

module.exports = mongoose.model('Order', orderSchema);