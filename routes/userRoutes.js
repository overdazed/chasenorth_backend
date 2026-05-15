const express = require('express');
const User = require('../models/User');
const jwt = require("jsonwebtoken");
const bcrypt = require('bcryptjs');
const { protect } = require("../middleware/authMiddleware");
const authController = require("../controllers/authController");

const router = express.Router();

// @route POST /api/users/register
// @desc Register a user
// @access Public

// call the router.post method, we will not be specifying the API/users here, we will do it later in the server.js file
router.post('/register', async (req, res) => {
    // extract the name, email and password from the request body
    const { name, email, password } = req.body;
    try {
        // Registration logic
        // Test this route by displaying all the values
        // res.send({ name, email, password })
        // check if a user with the provided email address already exists (case-insensitive)
        const emailLower = email.toLowerCase();
        let user = await User.findOne({ email: { $regex: new RegExp(`^${emailLower}$`, 'i') } });

        if (user)
            // if the user already exists, return a 400 status code
            return res.status(400).json({message: "User already exists"});
        // if the user does not exist, create a new user instance with the provided details
        user = new User({ name, email: emailLower, password });
        // save the user to the database
        await user.save();

        // we want to be able to send a token along with the user details
        // we will do this by making use of the JSON Web Token (JWT)
        // Create JWT Payload, this will contain information about the user.id and role
        // payload will get embedded in the token and we will decode it for authorising the user at the backend
        const payload = {
            user: {
                id: user._id,
                role: user.role
            }
        };

        // Sign and return the token along with user data
        // jwt.sign will generate a token provided payload and a secret key for signing
        // pass the payload, secret key, we will need to create a secret key for this and save it in the .env variable
        // ensure that the key is at least 32 characters, and contains special characters, numbers and capital letters
        // specify the token validity using the expiresIn key
        // callback function (err, token) that will provide us an error or generate a token
        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            {expiresIn: "1d"},
            (err, token) => {
                // if there is an error, we'll throw the error
                if (err) throw err;

                // or send the user a token in response
                // to test, enter a different email address in postman
                // later we'll look at how to make use of the token to authorise the user
                res.status(201).json({
                    user: {
                        _id: user._id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        phone: user.phone,
                        profilePicture: user.profilePicture,
                        billingAddress: user.billingAddress,
                        shippingAddress: user.shippingAddress,
                        sameAsBilling: user.sameAsBilling
                    },
                    token,
                });
            }
        );
    } catch (error) {
        // If there is an error, we will log it
        console.log(error);
        res.status(500).send("Server Error");
    }
});

// @route POST /api/users/login
// @desc Authenticate a user
// @access Public
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Find the user by email (case-insensitive)
        const emailLower = email.toLowerCase();
        let user = await User.findOne({ email: { $regex: new RegExp(`^${emailLower}$`, 'i') } }).select('+password');

        if (!user) return res.status(400).json({message: "Invalid credentials"});
        // We need to match the password
        const isMatch = await user.matchPassword(password); // returns a boolean value{}
        // If the password does not match, we will return a 400 status code error
        if (!isMatch) return res.status(400).json({message: "Invalid credentials"});

        // Create JWT Payload, this will contain information about the user.id and role
        const payload = {
            user: {
                id: user._id,
                role: user.role
            }
        };

        // We can use the JWT payload and sign method from the registered route
        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            {expiresIn: "1d"},
            (err, token) => {
                // if there is an error, we'll throw the error
                if (err) throw err;

                // or send the user a token in response
                // to test, enter a different email address in postman
                // later we'll look at how to make use of the token to authorise the user
                res.json({
                    user: {
                        _id: user._id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        phone: user.phone,
                        profilePicture: user.profilePicture,
                        billingAddress: user.billingAddress,
                        shippingAddress: user.shippingAddress,
                        sameAsBilling: user.sameAsBilling,
                        emailVerified: user.emailVerified
                    },
                    token,
                });
            }
        );

        // Check if the password is correct
    } catch (error) {
        // log the error
        console.log(error);
        res.status(500).send("Server Error");
        // in Postman, create a new Request, name it "Login" > change to POST > URL:
    }
})

// Create a route for the user profile
// @route GET /api/users/profile
// @desc Get logged-in user's profile (Protected route)
// @access Private

// create a middleware function to protect this request, we implement it later, but this is where it will be called
router.get("/profile", protect, async (req, res) => {
    try {
        // Find the user and include the emailVerified field
        const user = await User.findById(req.user._id).select('emailVerified');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Return the user data with emailVerified status
        res.json({
            ...req.user.toObject(),
            emailVerified: user.emailVerified
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
})

// create folder "middleware" > file "authMiddleware.js"

// Password reset routes
router.post('/forgot-password', authController.forgotPassword);
router.patch('/reset-password/:token', authController.resetPassword);

// Update user profile and password routes (protected)
router.patch('/update-profile', protect, authController.updateProfile);
router.patch('/update-password', protect, authController.updatePassword);

// @route   PUT /api/users/update-email
// @desc    Update user's email
// @access  Private
router.put('/update-email', protect, async (req, res) => {
    try {
        const { newEmail, currentPassword } = req.body;
        
        // Find the user and include the password field for verification
        const user = await User.findById(req.user.id).select('+password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        console.log('User found for email update:', { 
            userId: user._id, 
            currentEmail: user.email,
            hasPassword: !!user.password 
        });

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        // Check if new email is different
        if (newEmail.toLowerCase() === user.email.toLowerCase()) {
            return res.status(400).json({ message: 'New email is the same as current email' });
        }

        // Check if new email is already in use (case-insensitive)
        const existingUser = await User.findOne({ 
            email: { $regex: new RegExp(`^${newEmail}$`, 'i') },
            _id: { $ne: user._id } // Exclude current user from the check
        });

        if (existingUser) {
            return res.status(400).json({ message: 'Email is already in use' });
        }

        // Update email (lowercase for consistency)
        user.email = newEmail.toLowerCase();
        user.emailVerified = false; // Require email verification
        await user.save();

        // Generate verification token
        const verificationToken = jwt.sign(
            { userId: user._id, newEmail: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        // Create verification link
        const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

        // Send verification email
        const { sendEmailVerification } = require('../services/emailService');
        await sendEmailVerification(user.email, verificationLink);

        // Generate new token with updated email
        const payload = {
            user: {
                id: user._id,
                role: user.role
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '7d' },
            (err, token) => {
                if (err) throw err;
                res.json({ 
                    token,
                    user: {
                        id: user._id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        emailVerified: user.emailVerified
                    },
                    message: 'Email updated successfully. Please verify your new email.'
                });
            }
        );
    } catch (error) {
        console.error('Error updating email:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/users/verify-email
// @desc    Verify user's email after change
// @access  Public
router.get('/verify-email', async (req, res) => {
    // Set CORS headers for this specific endpoint
    res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    try {
        const { token } = req.query;
        
        if (!token) {
            return res.status(400).json({ message: 'Verification token is required' });
        }

        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Find the user
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if the email in token matches current user email
        if (user.email !== decoded.newEmail) {
            return res.status(400).json({ message: 'Email verification token is invalid or expired' });
        }

        // Mark email as verified
        user.emailVerified = true;
        const savedUser = await user.save();
        
        console.log('User after verification:', {
            userId: savedUser._id,
            email: savedUser.email,
            emailVerified: savedUser.emailVerified
        });

        // Redirect to profile page after successful verification
        res.redirect(`${process.env.FRONTEND_URL}/profile?emailVerified=true`);
        
    } catch (error) {
        console.error('Error verifying email:', error);
        
        // Handle token expiration specifically
        if (error.name === 'TokenExpiredError') {
            console.log('Token expired error');
            return res.redirect(`${process.env.FRONTEND_URL}/profile?emailError=expired`);
        }
        
        // Handle other errors
        console.log('Invalid token error:', error.message);
        res.redirect(`${process.env.FRONTEND_URL}/profile?emailError=invalid`);
    }
});

module.exports = router;

// open server.js file
// declare the variable userRoutes