const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Product = require('../models/Product');
const { protect } = require('../middleware/authMiddleware');

// @desc    Get all reviews
// @route   GET /api/product-reviews
// @access  Public
router.get('/', async (req, res) => {
  try {
    const reviews = await Review.find({})
      .populate('user', 'name')
      .populate('product', 'name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: reviews.length,
      data: reviews
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reviews',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

// @desc    Create a new review
// @route   POST /api/product-reviews
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    console.log('=== NEW REVIEW REQUEST ===');
    console.log('Authenticated User ID:', req.user.id);
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    // Support both old and new field names
    const { 
      product,
      productId,  // New field name
      rating, 
      title, 
      comment, 
      qualityRating,
      quality,    // New field name
      designRating,
      design,     // New field name
      fitRating,
      fit,        // New field name
      width,      // New field
      length      // New field
    } = req.body;

    // Use the product ID from either field
    const productIdToUse = product || productId;
    // Use the ratings from either the old or new field names
    const qualityRatingToUse = qualityRating || quality;
    const designRatingToUse = designRating || design;
    const fitRatingToUse = fitRating || fit;

    // Detailed validation with better error messages
    const requiredFields = [
      { 
        field: 'productId', 
        value: productIdToUse, 
        message: 'Product ID is required',
        type: typeof productIdToUse
      },
      { 
        field: 'rating', 
        value: rating, 
        message: 'Overall rating is required and must be a number',
        type: typeof rating
      },
      { 
        field: 'title', 
        value: title, 
        message: 'Review title is required',
        type: typeof title
      },
      { 
        field: 'comment', 
        value: comment, 
        message: 'Review comment is required',
        type: typeof comment
      },
      { 
        field: 'quality', 
        value: qualityRatingToUse, 
        message: 'Quality rating is required and must be a number',
        type: typeof qualityRatingToUse
      },
      { 
        field: 'design', 
        value: designRatingToUse, 
        message: 'Design rating is required and must be a number',
        type: typeof designRatingToUse
      },
      { 
        field: 'fit', 
        value: fitRatingToUse, 
        message: 'Fit rating is required and must be a number',
        type: typeof fitRatingToUse
      },
      {
        field: 'width',
        value: width,
        message: 'Width feedback is required',
        type: typeof width
      },
      {
        field: 'length',
        value: length,
        message: 'Length feedback is required',
        type: typeof length
      }
    ];

    // Check for missing or invalid fields
    const validationErrors = [];
    requiredFields.forEach(field => {
      const isMissing = field.value === undefined || field.value === null || field.value === '';
      const isNumberField = ['rating', 'qualityRating', 'designRating', 'fitRating'].includes(field.field);
      const isInvalidNumber = isNumberField && (isNaN(Number(field.value)) || field.value < 1 || field.value > 5);
      
      if (isMissing || isInvalidNumber) {
        console.log(`Validation error for ${field.field}:`, {
          value: field.value,
          type: field.type,
          isMissing,
          isInvalidNumber
        });
        
        validationErrors.push({
          field: field.field,
          message: isInvalidNumber ? `${field.field} must be a number between 1 and 5` : field.message
        });
      }
    });

    if (validationErrors.length > 0) {
      console.log('Validation errors:', validationErrors);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors,
        receivedData: req.body
      });
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({
      product,
      user: req.user.id
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product'
      });
    }

    console.log('Creating new review with data:', {
      product,
      user: req.user.id,
      rating,
      title,
      comment,
      qualityRating,
      designRating,
      fitRating
    });

    // Extract weight, height, and size from either root level or fit object
    const weight = req.body.weight !== undefined ? 
      (req.body.weight !== null ? Number(req.body.weight) : null) :
      (fit?.weight !== undefined ? (fit.weight !== null ? Number(fit.weight) : null) : null);
      
    const height = req.body.height !== undefined ? 
      (req.body.height !== null ? Number(req.body.height) : null) :
      (fit?.height !== undefined ? (fit.height !== null ? Number(fit.height) : null) : null);
      
    const size = req.body.size !== undefined ? 
      req.body.size :
      (fit?.size !== undefined ? fit.size : null);

    // Create the review with all required fields
    const reviewData = {
      product: productIdToUse,
      user: req.user.id,
      rating: Number(rating),
      title,
      comment,
      qualityRating: Number(qualityRatingToUse),
      designRating: Number(designRatingToUse),
      fitRating: Number(fitRatingToUse),
      width,
      length,
      weight,
      height,
      size,
      status: 'approved',
      isRecommended: true
    };
    
    console.log('Review data with fit information:', {
      weight,
      height,
      size,
      source: {
        weightFrom: req.body.weight !== undefined ? 'root' : (fit?.weight !== undefined ? 'fit' : 'none'),
        heightFrom: req.body.height !== undefined ? 'root' : (fit?.height !== undefined ? 'fit' : 'none'),
        sizeFrom: req.body.size !== undefined ? 'root' : (fit?.size !== undefined ? 'fit' : 'none')
      }
    });

    console.log('Creating review with data:', reviewData);
    const review = await Review.create(reviewData);

    // Populate the user and product fields for the response
    await review.populate('user', 'name email');
    await review.populate('product', 'name');

    console.log('Review created successfully:', review);

    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      data: review
    });

  } catch (error) {
    console.error('Error creating review:', error);
    
    // Handle duplicate key error (if user tries to review same product multiple times)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product',
        error: error.message
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }
    
    // Handle other errors
    res.status(500).json({
      success: false,
      message: 'Error creating review',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// @desc    Get reviews for a product
// @route   GET /api/product-reviews/product/:productId
// @access  Public
router.get('/product/:productId', async (req, res) => {
  try {
    const reviews = await Review.find({ product: req.params.productId })
      .populate('user', 'name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: reviews.length,
      data: reviews
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reviews',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

// In minimal-reviews.js
// @desc    Delete a review
// @route   DELETE /api/product-reviews/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user is admin or review owner
    if (req.user.role !== 'admin' && review.user.toString() !== req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to delete this review'
      });
    }

    // Store the product ID before deleting
    const productId = review.product;

    // Delete the review and get the deleted review
    const deletedReview = await Review.findByIdAndDelete(review._id);
    
    if (!deletedReview) {
      return res.status(404).json({
        success: false,
        message: 'Review not found or already deleted'
      });
    }

    // Recalculate the product's average rating
    const reviews = await Review.find({ product: productId });
    const totalRating = reviews.reduce((acc, item) => acc + item.rating, 0);
    const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;

    // Update the product's rating and review count
    await Product.findByIdAndUpdate(productId, {
      rating: averageRating,
      numReviews: reviews.length
    }, { new: true });

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting review',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

// // @desc    Mark a review as helpful
// // @route   PUT /api/product-reviews/:id/helpful
// // @access  Private
// router.put('/:id/helpful', protect, async (req, res) => {
//   try {
//     const review = await Review.findById(req.params.id);
//
//     if (!review) {
//       return res.status(404).json({
//         success: false,
//         message: 'Review not found'
//       });
//     }
//
//     // Check if user already marked this review as helpful
//     if (review.helpfulVotesBy && review.helpfulVotesBy.includes(req.user.id)) {
//       return res.status(400).json({
//         success: false,
//         message: 'You have already marked this review as helpful'
//       });
//     }
//
//     // Update helpful votes count and add user to helpfulVotesBy array
//     review.helpfulVotes += 1;
//     if (!review.helpfulVotesBy) {
//       review.helpfulVotesBy = [];
//     }
//     review.helpfulVotesBy.push(req.user.id);
//
//     await review.save();
//
//     res.json({
//       success: true,
//       message: 'Review marked as helpful',
//       data: {
//         helpfulVotes: review.helpfulVotes
//       }
//     });
//   } catch (error) {
//     console.error('Error marking review as helpful:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error marking review as helpful',
//       error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
//     });
//   }
// });

// @desc    Get reviews for a specific product
// @route   GET /api/product-reviews/:productId
// @access  Public
router.get('/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    console.log(`Fetching reviews for product ${productId}, page ${page}, limit ${limit}`);

    // Get total count for pagination
    const total = await Review.countDocuments({ product: productId });
    
    // Get paginated reviews
    const reviews = await Review.find({ product: productId })
      .sort({ createdAt: -1 }) // newest first
      .skip(skip)
      .limit(limit)
      .populate('user', 'name email')
      .lean();

    console.log(`Found ${reviews.length} reviews out of ${total}`);

    res.json({
      success: true,
      count: reviews.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: reviews
    });
  } catch (error) {
    console.error('Error fetching product reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product reviews',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

// @desc    Update a review
// @route   PUT /api/product-reviews/:id
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    console.log('=== UPDATE REVIEW REQUEST ===');
    console.log('Review ID:', req.params.id);
    console.log('Authenticated User ID:', req.user.id);
    console.log('Update data:', JSON.stringify(req.body, null, 2));

    // Find the review
    let review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Make sure user owns the review
    if (review.user.toString() !== req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to update this review'
      });
    }

    // Extract fields from request body
    const {
      title,
      comment,
      rating,
      qualityRating,
      designRating,
      fitRating,
      width,
      length,
      fit,
      // New root-level fields
      weight,
      height,
      size
    } = req.body;

    // Update review fields
    review.title = title || review.title;
    review.comment = comment || review.comment;
    review.rating = rating || review.rating;
    review.qualityRating = qualityRating || review.qualityRating;
    review.designRating = designRating || review.designRating;
    review.fitRating = fitRating || review.fitRating;
    review.width = width || review.width;
    review.length = length || review.length;
    
    // Handle weight, height, and size from either root level or fit object
    if (weight !== undefined) {
      review.weight = weight !== null ? Number(weight) : null;
    } else if (fit?.weight !== undefined) {
      review.weight = fit.weight !== null ? Number(fit.weight) : null;
    }
    
    if (height !== undefined) {
      review.height = height !== null ? Number(height) : null;
    } else if (fit?.height !== undefined) {
      review.height = fit.height !== null ? Number(fit.height) : null;
    }
    
    if (size !== undefined) {
      review.size = size || null;
    } else if (fit?.size !== undefined) {
      review.size = fit.size || null;
    }
    
    console.log('Updated review data:', {
      weight: review.weight,
      height: review.height,
      size: review.size
    });

    // Save the updated review
    const updatedReview = await review.save();

    // Recalculate the product's average rating
    const reviews = await Review.find({ product: review.product });
    const totalRating = reviews.reduce((acc, item) => acc + item.rating, 0);
    const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;
    const numReviews = reviews.length;

    // Update the product with the new average rating
    await Product.findByIdAndUpdate(
      review.product,
      {
        rating: averageRating,
        numReviews
      },
      { new: true }
    );

    console.log('Review updated successfully:', updatedReview);

    res.json({
      success: true,
      message: 'Review updated successfully',
      data: updatedReview
    });
  } catch (error) {
    console.error('Error updating review:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error updating review',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

// // @desc    Mark a review as helpful
// // @route   PUT /api/product-reviews/:id/helpful
// // @access  Private
// router.put('/:id/helpful', protect, async (req, res) => {
//   try {
//     const review = await Review.findById(req.params.id);
//
//     if (!review) {
//       return res.status(404).json({
//         success: false,
//         message: 'Review not found'
//       });
//     }
//
//     // Check if user already marked this review as helpful
//     if (review.helpfulVotesBy && review.helpfulVotesBy.includes(req.user.id)) {
//       return res.status(400).json({
//         success: false,
//         message: 'You have already marked this review as helpful'
//       });
//     }
//
//     // Update helpful votes count and add user to helpfulVotesBy array
//     review.helpfulVotes = (review.helpfulVotes || 0) + 1;
//     if (!review.helpfulVotesBy) {
//       review.helpfulVotesBy = [];
//     }
//     review.helpfulVotesBy.push(req.user.id);
//
//     await review.save();
//
//     res.json({
//       success: true,
//       message: 'Review marked as helpful',
//       data: {
//         helpfulVotes: review.helpfulVotes
//       }
//     });
//   } catch (error) {
//     console.error('Error marking review as helpful:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error marking review as helpful',
//       error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
//     });
//   }
// });

// @desc    Toggle helpful status for a review
// @route   PUT /api/product-reviews/:id/helpful
// @access  Private
router.put('/:id/helpful', protect, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Initialize helpfulVotes and helpfulVotesBy if they don't exist
    if (review.helpfulVotes === undefined) review.helpfulVotes = 0;
    if (!review.helpfulVotesBy) review.helpfulVotesBy = [];
    
    const userId = req.user.id;
    const userIdStr = userId.toString();
    
    // Check if user has already voted (handles both ObjectId and string comparisons)
    const hasVoted = review.helpfulVotesBy.some(id => {
      const idStr = id.toString();
      return idStr === userIdStr || (id._id ? id._id.toString() === userIdStr : false);
    });
    
    // Toggle the vote
    if (hasVoted) {
      // Remove vote
      review.helpfulVotes = Math.max(0, review.helpfulVotes - 1);
      review.helpfulVotesBy = review.helpfulVotesBy.filter(id => {
        const idStr = id.toString();
        return idStr !== userIdStr && (!id._id || id._id.toString() !== userIdStr);
      });
    } else {
      // Add vote
      review.helpfulVotes += 1;
      if (!review.helpfulVotesBy.some(id => {
        const idStr = id.toString();
        return idStr === userIdStr || (id._id ? id._id.toString() === userIdStr : false);
      })) {
        review.helpfulVotesBy.push(userId);
      }
    }
    
    // Save the updated review
    await review.save();
    
    // Populate the user data for the response
    await review.populate('user', 'name');
    
    res.json({
      success: true,
      message: hasVoted ? 'Removed helpful vote' : 'Review marked as helpful',
      data: {
        reviewId: review._id,
        helpfulVotes: review.helpfulVotes,
        hasVoted: !hasVoted,
        helpfulVotesBy: review.helpfulVotesBy
      }
    });
    
  } catch (error) {
    console.error('Error toggling helpful status:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling helpful status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

module.exports = router;
