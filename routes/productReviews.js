const express = require('express');
const router = express.Router();
const { Types } = require('mongoose');
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const Review = require('../models/Review');
const path = require('path');
const fs = require('fs');
const supabase = require('../config/supabase');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/reviews';
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, JPG, and PNG files are allowed.'), false);
        }
    }
});

// Handle multiple file uploads (max 4 files)
const uploadFiles = upload.array('images', 4);

// Test route
router.get('/test', (req, res) => {
    res.json({ 
        success: true,
        message: 'Product reviews endpoint is working!'
    });
});

// Get reviews for a product
router.get('/product/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Validate product ID format
        if (!Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid product ID' 
            });
        }

        // Create query for approved reviews
        const query = { 
            product: productId,
            status: 'approved'
        };

        // Get paginated reviews with all necessary fields
        const reviews = await Review.find(query)
            .select('product user rating title comment qualityRating designRating fitRating width length weight height size images verifiedPurchase helpfulVotes helpfulVotesBy status isFeatured createdAt updatedAt')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate({
                path: 'user',
                select: 'name email',
                options: { lean: true }
            })
            .lean()
            // Ensure user data is properly formatted
            .then(reviews => reviews.map(review => ({
                ...review,
                // If user is not populated, try to get the name from the user reference
                userName: review.user?.name || (typeof review.user === 'string' ? undefined : review.user?.name)
            })));
            
        console.log('Fetched reviews:', JSON.stringify(reviews, null, 2)); // Debug log
            
        console.log('Sending reviews with fields:', reviews.length > 0 ? Object.keys(reviews[0]) : 'No reviews');

        // Get total count for pagination
        const total = await Review.countDocuments(query);

        // Return the results
        return res.json({
            success: true,
            count: reviews.length,
            total,
            page,
            pages: Math.ceil(total / limit),
            data: reviews
        });
        
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching reviews',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// @route   POST /api/product-reviews
// @desc    Create a new review for a product
// @access  Private
router.post('/', protect, (req, res) => {
    // Handle file upload and review creation in one go
    uploadFiles(req, res, async (err) => {
        // Handle multer errors
        if (err) {
            if (err instanceof multer.MulterError) {
                return res.status(400).json({
                    success: false,
                    message: 'File upload error',
                    error: err.message
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'File upload failed',
                    error: err.message
                });
            }
        }
        
        // Process the review data
        try {
        // Get text fields from the form data
        const { 
            productId, 
            rating, 
            comment = '', 
            title = '', 
            qualityRating = 5, 
            designRating = 5, 
            fitRating = 5, 
            width = 3, 
            length = 3, 
            weight = null, 
            height = null, 
            size = null,
            verifiedPurchase = false,
            imageUrls
        } = req.body;
        
        // Process uploaded files
        const images = [];
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                images.push({
                    url: `/uploads/reviews/${file.filename}`,
                    path: file.path,
                    filename: file.filename,
                    originalName: file.originalname,
                    mimetype: file.mimetype,
                    size: file.size
                });
            });
        }
        
        // Add Supabase image URLs if provided
        if (imageUrls) {
            const urls = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
            urls.forEach(url => {
                images.push({
                    url: url,
                    isSupabase: true
                });
            });
        }
        
        // Validate required fields
        if (!productId || !rating) {
            // Clean up uploaded files if validation fails
            if (req.files && req.files.length > 0) {
                req.files.forEach(file => {
                    fs.unlink(file.path, err => {
                        if (err) console.error('Error deleting file:', err);
                    });
                });
            }
            
            return res.status(400).json({
                success: false,
                message: 'Product ID and rating are required'
            });
        }
        
        // Validate product ID
        if (!Types.ObjectId.isValid(productId)) {
            // Clean up uploaded files if validation fails
            if (req.files && req.files.length > 0) {
                req.files.forEach(file => {
                    fs.unlink(file.path, err => {
                        if (err) console.error('Error deleting file:', err);
                    });
                });
            }
            
            return res.status(400).json({
                success: false,
                message: 'Invalid product ID'
            });
        }

        // Create review data with all fields
            const reviewData = {
                user: req.user._id,
                product: productId,
                rating: Math.max(1, Math.min(5, Number(rating))),
                comment: comment.toString().trim(),
                title: title.toString().trim(),
                qualityRating: Math.max(1, Math.min(5, Number(qualityRating))),
                designRating: Math.max(1, Math.min(5, Number(designRating))),
                fitRating: Math.max(1, Math.min(5, Number(fitRating))),
                width: Number(width) || 3,
                length: Number(length) || 3,
                weight: weight ? Number(weight) : null,
                height: height ? Number(height) : null,
                size: size ? size.toString().trim() : null,
                verifiedPurchase: verifiedPurchase === true || verifiedPurchase === 'true',
                images: images,
                status: 'approved' // Set to approved by default for now
            };
        
        console.log('Creating review with data:', reviewData);

        // Create and save the review
        const review = new Review(reviewData);
        await review.save();

        // Populate user data for the response
        await review.populate('user', 'name email');

        res.status(201).json({
            success: true,
            message: 'Review submitted successfully',
            data: review
        });
        
    } catch (error) {
        console.error('Error creating review:', error);
        
        // Clean up uploaded files if there was an error
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                fs.unlink(file.path, err => {
                    if (err) console.error('Error deleting file:', err);
                });
            });
        }
        
        // Handle specific error types
        if (error.name === 'ValidationError') {
            const errors = {};
            Object.keys(error.errors).forEach(key => {
                errors[key] = error.errors[key].message;
            });
            return res.status(400).json({ 
                success: false,
                message: 'Validation failed',
                errors 
            });
        }
        
        // Handle duplicate key errors
        if (error.code === 11000) {
            return res.status(400).json({ 
                success: false,
                message: 'You have already reviewed this product'
            });
        }
        
        // Handle other errors
        res.status(500).json({
            success: false,
            message: 'Error creating review',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
    });
});

// @route   PUT /api/product-reviews/:id/helpful
// @desc    Mark a review as helpful
// @access  Private
router.put('/:id/helpful', protect, async (req, res) => {
    try {
        const reviewId = req.params.id;

        // Validate review ID
        if (!Types.ObjectId.isValid(reviewId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid review ID'
            });
        }

        // Find the review
        const review = await Review.findById(reviewId);

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });
        }

        // Check if user already marked this review as helpful
        const alreadyMarked = review.helpfulVotesBy.some(
            vote => vote.toString() === req.user._id.toString()
        );

        if (alreadyMarked) {
            // Remove the vote (toggle off)
            review.helpfulVotesBy = review.helpfulVotesBy.filter(
                vote => vote.toString() !== req.user._id.toString()
            );
            review.helpfulVotes = Math.max(0, review.helpfulVotes - 1);
        } else {
            // Add the vote
            review.helpfulVotesBy.push(req.user._id);
            review.helpfulVotes = (review.helpfulVotes || 0) + 1;
        }

        await review.save();

        res.json({
            success: true,
            message: alreadyMarked ? 'Vote removed' : 'Marked as helpful',
            data: {
                helpfulVotes: review.helpfulVotes,
                helpfulCount: review.helpfulVotes,
                hasVoted: !alreadyMarked,
                isHelpful: !alreadyMarked
            }
        });

    } catch (error) {
        console.error('Error marking review as helpful:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking review as helpful',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// @route   PUT /api/product-reviews/:id
// @desc    Update a review
// @access  Private
router.put('/:id', protect, uploadFiles, async (req, res) => {
    try {
        const reviewId = req.params.id;
        const { 
            title, 
            comment, 
            rating, 
            qualityRating, 
            designRating, 
            fitRating, 
            width, 
            length, 
            weight, 
            height, 
            size,
            imagesToKeep = []
        } = req.body;

        // Validate review ID
        if (!Types.ObjectId.isValid(reviewId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid review ID'
            });
        }

        // Find the review
        const review = await Review.findById(reviewId);

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });
        }

        // Check if the user owns the review
        if (review.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this review'
            });
        }

        // Handle uploaded images (already uploaded to Supabase by the client)
        let uploadedImages = [];
        
        // Check if we have a JSON string of uploaded images
        if (req.body.images) {
            try {
                // Parse the JSON string of uploaded images
                uploadedImages = JSON.parse(req.body.images);
                console.log('Parsed uploaded images:', uploadedImages);
            } catch (error) {
                console.error('Error parsing uploaded images:', error);
                return res.status(400).json({
                    success: false,
                    message: 'Invalid images data format',
                    error: error.message
                });
            }
        }
        // Fallback to handling file uploads if no pre-uploaded images
        else if (req.files && req.files.length > 0) {
            try {
                // Upload new images to Supabase (legacy fallback)
                const uploadPromises = req.files.map(async (file) => {
                    const fileExt = path.extname(file.originalname);
                    const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExt}`;
                    const filePath = `reviews/${reviewId}/${fileName}`;
                    
                    const { data: uploadData, error: uploadError } = await supabase.storage
                        .from('reviews')
                        .upload(filePath, file.buffer, {
                            contentType: file.mimetype,
                            upsert: false
                        });

                    if (uploadError) throw uploadError;

                    // Get public URL
                    const { data: { publicUrl } } = supabase.storage
                        .from('reviews')
                        .getPublicUrl(filePath);

                    return {
                        url: publicUrl,
                        path: filePath,
                        name: file.originalname,
                        size: file.size,
                        type: file.mimetype
                    };
                });

                uploadedImages = await Promise.all(uploadPromises);
            } catch (error) {
                console.error('Error uploading images:', error);
                return res.status(500).json({
                    success: false,
                    message: 'Error uploading images',
                    error: error.message
                });
            }
        }

        // Get images to delete from the request body and ensure it's an array
        let imagesToDelete = [];
        if (req.body.imagesToDelete) {
            // If it's a string, try to parse it as JSON
            if (typeof req.body.imagesToDelete === 'string') {
                try {
                    imagesToDelete = JSON.parse(req.body.imagesToDelete);
                } catch (e) {
                    // If it's not a JSON string, treat it as a single value
                    imagesToDelete = [req.body.imagesToDelete];
                }
            } 
            // If it's already an array, use it directly
            else if (Array.isArray(req.body.imagesToDelete)) {
                imagesToDelete = req.body.imagesToDelete;
            }
            // If it's a single value, wrap it in an array
            else {
                imagesToDelete = [req.body.imagesToDelete];
            }
        }
        
        // Ensure it's an array and filter out any empty values
        imagesToDelete = Array.isArray(imagesToDelete) 
            ? imagesToDelete.filter(Boolean) 
            : [];
            
        console.log('Images to delete after processing:', imagesToDelete);
        console.log('Images to delete:', imagesToDelete);

        // If imagesToKeep is provided, use it to filter existing images
        // Otherwise, keep all existing images
        const keptImages = Array.isArray(imagesToKeep) && imagesToKeep.length > 0
            ? review.images.filter(img => 
                imagesToKeep.some(keepPath => 
                    keepPath === img.path || 
                    keepPath === img.url ||
                    (img.url && (img.url.endsWith(keepPath) || img.url.includes(keepPath)))
                ) && !imagesToDelete.includes(img.path) && !imagesToDelete.includes(img.url)
            )
            : review.images.filter(img => 
                !imagesToDelete.includes(img.path) && !imagesToDelete.includes(img.url)
            );

        console.log('Kept images:', keptImages.length);
        console.log('Uploaded images:', uploadedImages.length);
        console.log('Images to delete:', imagesToDelete.length);

        // Combine kept and newly uploaded images
        const allImages = [...keptImages, ...uploadedImages];

        // Delete images marked for deletion
        if (imagesToDelete.length > 0) {
            const deletePromises = imagesToDelete.map(async (imagePath) => {
                try {
                    // Extract the file path from the URL if it's a full URL
                    let filePath = imagePath;
                    if (filePath.includes('/storage/v1/object/public/reviews/')) {
                        filePath = filePath.split('/storage/v1/object/public/reviews/')[1];
                    } else if (filePath.includes('supabase.co/storage/v1/object/public/reviews/')) {
                        filePath = filePath.split('supabase.co/storage/v1/object/public/reviews/')[1];
                    }
                    
                    console.log('Deleting image from Supabase:', filePath);
                    
                    const { error } = await supabase.storage
                        .from('reviews')
                        .remove([filePath]);
                        
                    if (error) {
                        console.error('Error deleting image from Supabase:', error);
                        throw error;
                    }
                    
                    console.log('Successfully deleted image from Supabase:', filePath);
                } catch (error) {
                    console.error('Error deleting image:', error);
                    // Don't fail the whole request if image deletion fails
                }
            });

            await Promise.all(deletePromises);
        }

        // Update review data
        const updateData = {
            title: title || review.title,
            comment: comment || review.comment,
            rating: rating ? Math.max(1, Math.min(5, Number(rating))) : review.rating,
            qualityRating: qualityRating ? Math.max(1, Math.min(5, Number(qualityRating))) : review.qualityRating,
            designRating: designRating ? Math.max(1, Math.min(5, Number(designRating))) : review.designRating,
            fitRating: fitRating ? Math.max(1, Math.min(5, Number(fitRating))) : review.fitRating,
            width: width ? Number(width) : review.width,
            length: length ? Number(length) : review.length,
            weight: weight ? Number(weight) : review.weight,
            height: height ? Number(height) : review.height,
            size: size || review.size,
            images: allImages,
            updatedAt: new Date()
        };

        // Update the review
        const updatedReview = await Review.findByIdAndUpdate(
            reviewId,
            { $set: updateData },
            { new: true, runValidators: true }
        ).populate('user', 'name email');

        res.json({
            success: true,
            message: 'Review updated successfully',
            data: updatedReview
        });

    } catch (error) {
        console.error('Error updating review:', error);
        
        // Clean up any uploaded files if there was an error
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                fs.unlink(file.path, err => {
                    if (err) console.error('Error deleting file:', err);
                });
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Error updating review',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// @route   DELETE /api/product-reviews/:id
// @desc    Delete a review
// @access  Private
router.delete('/:id', protect, async (req, res) => {
    try {
        const reviewId = req.params.id;

        // Validate review ID
        if (!Types.ObjectId.isValid(reviewId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid review ID'
            });
        }

        // Find the review
        const review = await Review.findById(reviewId);

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });
        }

        // Check if the user owns the review
        if (review.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this review'
            });
        }

        // Delete uploaded images
        if (review.images && review.images.length > 0) {
            for (const image of review.images) {
                console.log('Processing image:', image);
                
                // Check if it's a Supabase URL
                const isSupabaseUrl = image.url && image.url.includes('supabase.co/storage');
                
                if (isSupabaseUrl && supabase) {
                    // Delete from Supabase Storage
                    try {
                        // Extract the file path from the URL
                        // URL format: https://xxx.supabase.co/storage/v1/object/public/reviews/filename.png
                        const urlParts = image.url.split('/object/public/reviews/');
                        if (urlParts.length > 1) {
                            const filePath = urlParts[1];
                            console.log('Attempting to delete Supabase file:', filePath);
                            
                            const { error } = await supabase.storage
                                .from('reviews')
                                .remove([filePath]);
                            
                            if (error) {
                                console.error('Error deleting Supabase image:', error);
                            } else {
                                console.log('Successfully deleted Supabase image:', filePath);
                            }
                        } else {
                            console.log('Could not parse Supabase URL:', image.url);
                        }
                    } catch (error) {
                        console.error('Error deleting Supabase image:', error);
                    }
                } else if (image.path && !isSupabaseUrl) {
                    // Delete from local filesystem
                    fs.unlink(image.path, err => {
                        if (err) console.error('Error deleting file:', err);
                    });
                }
            }
        }

        // Store the product ID before deleting
        const productId = review.product;

        // Delete the review
        await Review.findByIdAndDelete(reviewId);

        // Recalculate product ratings after deletion
        await Review.calculateAverageRating(productId);

        res.json({
            success: true,
            message: 'Review deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting review:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting review',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Export the router
module.exports = router;
