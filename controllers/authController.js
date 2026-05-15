// controllers/authController.js
const crypto = require('crypto');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        console.log('Login attempt for:', email);

        // 1) Check if email and password exist
        if (!email || !password) {
            console.log('Missing email or password');
            return next(new AppError('Please provide email and password!', 400));
        }

        // 2) Check if user exists
        const user = await User.findOne({ email }).select('+password');
        console.log('User found:', user ? 'Yes' : 'No');

        if (!user) {
            console.log('No user found with email:', email);
            return next(new AppError('Incorrect email or password', 401));
        }

        // 3) Check if password is correct
        const isMatch = await user.matchPassword(password);
        console.log('Password match:', isMatch);

        if (!isMatch) {
            console.log('Incorrect password for user:', email);
            return next(new AppError('Incorrect email or password', 401));
        }

        // 4) If everything ok, send token to client
        console.log('Login successful for user:', email);
        createSendToken(user, 200, res);
    } catch (err) {
        console.error('Login error:', err);
        next(err);
    }
};

// Helper function to create and send JWT token
const createSendToken = (user, statusCode, res) => {
    // Create token
    const token = user.getSignedJwtToken();

    // Remove password from output
    user.password = undefined;

    res.status(statusCode).json({
        status: 'success',
        token,
        user
    });
};

// @desc    Forgot password
// @route   POST /api/users/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
    try {
        // 1) Get user based on POSTed email
        const user = await User.findOne({ email: req.body.email });
        if (!user) {
            // Don't reveal if the user exists or not
            return res.status(200).json({
                status: 'success',
                message: 'If an account exists with this email, you will receive a password reset link.'
            });
        }

        // 2) Generate the random reset token
        const resetToken = user.createPasswordResetToken();
        await user.save({ validateBeforeSave: false });

        // 3) Send it to user's email
        const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
        //const message = `Forgot your password? \nClick here to reset your password: \n\n${resetURL}.\n\nIf you didn't forget your password, please ignore this email!`;

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="text-align: left;">Password Reset</h2>
                <p style="text-align: left;">Forgot your password? Click the button below to reset your password.</p>
                <div style="text-align: center; margin: 20px 0;">
                    <a href="${resetURL}" 
                       style="display: inline-block; 
                              padding: 12px 24px; 
                              background-color: #571100; 
                              color: white; 
                              text-decoration: none; 
                              border-radius: 10000px; 
                              margin: 15px 0; 
                              font-weight: bold;
                              transition: background-color 0.3s ease;
                              box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        Reset Password
                    </a>
                    <style>
                        a[href^="http"]:hover {
                            background-color: #3a0b00 !important;
                            transform: translateY(-1px);
                            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
                        }
                        a[href^="http"]:active {
                            transform: translateY(0);
                            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        }
                    </style>
                </div>
                <p style="text-align: left;">Or copy and paste this link into your browser:</p>
                <p style="text-align: left;"><a href="${resetURL}" style="color: #571100; text-decoration: underline;">${resetURL}</a></p>
                <p style="text-align: left;">If you didn't request this, please ignore this email.</p>
            </div>
            `;

        try {
            await sendEmail({
                email: user.email,
                subject: 'Password Reset (valid for 10 min)',
                message: `Forgot your password? Click here to reset: ${resetURL}\n\nIf you didn't request this, please ignore this email.`,
                html: html
            });

            res.status(200).json({
                status: 'success',
                message: 'Token sent to email!'
            });
        } catch (err) {
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            await user.save({ validateBeforeSave: false });

            return next(new Error('There was an error sending the email. Try again later!'));
        }
    } catch (err) {
        next(err);
    }
};

// @desc    Reset password
// @route   PATCH /api/users/reset-password/:token
// @access  Public
exports.resetPassword = async (req, res, next) => {
    try {
        // 1) Get user based on the token
        const hashedToken = crypto
            .createHash('sha256')
            .update(req.params.token)
            .digest('hex');

        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() }
        });

        // 2) If token has not expired, and there is user, set the new password
        if (!user) {
            return res.status(400).json({
                status: 'error',
                message: 'Token is invalid or has expired'
            });
        }

        // 3) Update password and reset token fields
        user.password = req.body.password;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        // 4) Log the user in, send JWT
        createSendToken(user, 200, res);
    } catch (err) {
        res.status(500).json({
            status: 'error',
            message: err.message
        });
    }
};

// @desc    Update user profile
// @route   PATCH /api/users/update-profile
// @access  Private
exports.updateProfile = async (req, res, next) => {
    try {
        // 1) Create error if user POSTs password data
        if (req.body.password || req.body.passwordConfirm) {
            return res.status(400).json({
                status: 'error',
                message: 'This route is not for password updates. Please use /update-password.'
            });
        }

        // 2) Filtered out unwanted fields that are not allowed to be updated
        const filteredBody = {};
        const allowedFields = ['name', 'email', 'phone', 'profilePicture', 'billingAddress', 'shippingAddress', 'sameAsBilling'];
        
        Object.keys(req.body).forEach(el => {
            if (allowedFields.includes(el)) {
                filteredBody[el] = req.body[el];
            }
        });

        // 3) Handle profile picture upload to Supabase
        if (filteredBody.profilePicture) {
            const supabase = require('../config/supabase');
            if (supabase) {
                try {
                    // Create the bucket if it doesn't exist
                    const { data: buckets, error: listError } = await supabase
                        .storage
                        .listBuckets();

                    if (!listError && !buckets.find(bucket => bucket.name === 'profile-pictures')) {
                        const { error: createError } = await supabase
                            .storage
                            .createBucket('profile-pictures', { public: true });

                        if (createError) {
                            console.error('Error creating bucket:', createError);
                        }
                    }

                    // Simple and direct approach: delete old file, upload new file with same filename
                    const fileName = `profile-pictures/${req.user.id}.jpg`;
                    console.log('Attempting to delete old profile picture:', fileName);

                    // Step 1: Delete the old profile picture if it exists
                    try {
                        const { error: deleteError } = await supabase
                            .storage
                            .from('profile-pictures')
                            .remove([fileName]);

                        if (deleteError) {
                            console.log('No existing profile picture to delete or delete failed:', deleteError.message);
                        } else {
                            console.log('Successfully deleted old profile picture:', fileName);
                        }
                    } catch (error) {
                        console.log('Error during deletion check:', error.message);
                    }

                    // Step 2: Upload the new profile picture with the same filename

                    const { data, error: uploadError } = await supabase
                        .storage
                        .from('profile-pictures')
                        .upload(fileName, Buffer.from(filteredBody.profilePicture.split(',')[1], 'base64'), {
                            contentType: 'image/jpeg',
                            upsert: true,  // This will overwrite the file if it exists
                            cacheControl: '3600'  // Set cache control to 1 hour to prevent immediate deletion
                        });
                    
                    if (uploadError) {
                        console.error('Supabase upload error:', uploadError);
                        throw uploadError;
                    }

                    // Step 3: Get the public URL of the uploaded file
                    const { data: publicUrlData } = supabase
                        .storage
                        .from('profile-pictures')
                        .getPublicUrl(fileName);

                    // Update the profile picture URL in the filtered body
                    filteredBody.profilePicture = publicUrlData.publicUrl;
                    // Debug: Log the final state of the profile picture
                    console.log('Final profile picture URL:', filteredBody.profilePicture);
                    console.log('Profile picture updated successfully:', filteredBody.profilePicture);
                } catch (error) {
                    console.error('Error handling profile picture upload:', error);
                }
            }
        }

        // 4) Update user document
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            filteredBody,
            {
                new: true,
                runValidators: true
            }
        );

        // 5) Send response
        res.status(200).json({
            status: 'success',
            data: {
                user: updatedUser
            }
        });
    } catch (err) {
        res.status(400).json({
            status: 'error',
            message: err.message
        });
    }
};

// @desc    Update user password
// @route   PATCH /api/users/update-password
// @access  Private
exports.updatePassword = async (req, res, next) => {
    try {
        // 1) Get user from collection
        const user = await User.findById(req.user.id).select('+password');

        // 2) Check if POSTed current password is correct
        if (!(await user.matchPassword(req.body.currentPassword))) {
            return res.status(401).json({
                status: 'error',
                message: 'Your current password is wrong.'
            });
        }

        // 3) If so, update password
        user.password = req.body.newPassword;
        await user.save();

        // 4) Log user in, send JWT
        createSendToken(user, 200, res);
    } catch (err) {
        res.status(400).json({
            status: 'error',
            message: err.message
        });
    }
};