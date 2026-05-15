const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// define the user schema
// new mongoose.Schema() will help us define the structure, types and validation rules for the entries in our database
const addressSchema = new mongoose.Schema({
    firstName: {
        type: String,
        trim: true
    },
    lastName: {
        type: String,
        trim: true
    },
    street: {
        type: String,
        trim: true
    },
    city: {
        type: String,
        trim: true
    },
    postalCode: {
        type: String,
        trim: true
    },
    country: {
        type: String,
        trim: true
    }
}, { _id: false });

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/.+@.+\..+/, 'Please fill a valid email address']
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
        select: false
    },
    phone: {
        type: String,
        trim: true
    },
    profilePicture: {
        type: String,
        default: ''
    },
    role: {
        type: String,
        enum: ['customer', 'admin'],
        default: 'customer'
    },
    billingAddress: {
        type: addressSchema,
        default: {}
    },
    shippingAddress: {
        type: addressSchema,
        default: {}
    },
    sameAsBilling: {
        type: Boolean,
        default: true
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    emailVerified: {
        type: Boolean,
        default: false
    },
    wishlist: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }],
    lastPasswordChange: {
        type: Date
    },
    active: {
        type: Boolean,
        default: true,
        select: false
    }
},
    { timestamps: true }
);

// declare a Password Hash middleware, that will have the users password hashed before storing it to the database
// userSchema.pre is a mongoose middleware hook what will get executed before the save operation
// this will be a async operation, that will take "next" as a parameter
// We will use next parameter to make sure that the next middleware or other operations run after this code
userSchema.pre('save', async function (next) {
    // when you are not modifying the password, when you are updating the entry, skip this process, continue with the other operations
    if (!this.isModified('password')) return next();

    // salt = makes use of the generate salt method, that will take a number, the higher the number, more secure it will be, but it can be slower
    // const salt = await bcrypt.genSalt(10);

    // update the password with the hash value that get's generated using the salt value
    // this.password = await bcrypt.hash(this.password, salt);
    this.password = await bcrypt.hash(this.password, 12);
    // after this runs, ensure you specify the next middleware, so it will go ahead with the rest of the operations
    next();
})

// Now that we are hashing the password, we'll also require a method that will compare the plain text password that the user enters during the login
// and compare it with the hashed password stored in our database

userSchema.methods.matchPassword = async function(enteredPassword) {
    try {
        console.log('Entered password length:', enteredPassword ? enteredPassword.length : 0);
        console.log('Stored password hash:', this.password ? 'exists' : 'missing');
        const isMatch = await bcrypt.compare(enteredPassword, this.password);
        console.log('Password match result:', isMatch);
        return isMatch;
    } catch (err) {
        console.error('Error in matchPassword:', err);
        return false;
    }
};

userSchema.methods.createPasswordResetToken = function() {
    const resetToken = crypto.randomBytes(32).toString('hex');

    this.resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    this.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

    return resetToken;
};

// In User.js, add this method to your UserSchema
userSchema.methods.getSignedJwtToken = function() {
    return jwt.sign(
        { id: this._id, role: this.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '1d' }
    );
};

module.exports = mongoose.model('User', userSchema);