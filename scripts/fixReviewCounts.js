require('dotenv').config();
const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');

async function fixReviewCounts() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Get all products
    const products = await Product.find({});
    
    console.log(`Found ${products.length} products to process...`);
    
    for (const product of products) {
      // Count reviews for this product
      const reviewCount = await Review.countDocuments({ product: product._id });
      
      if (reviewCount === 0) {
        // If no reviews, reset all rating fields
        console.log(`No reviews found for product ${product._id}, resetting ratings...`);
        await Product.findByIdAndUpdate(
          product._id,
          {
            $set: {
              rating: 0,
              numReviews: 0,
              averageRating: 0,
              reviewCount: 0,
              'ratings.quality': 0,
              'ratings.design': 0,
              'ratings.fit': 0
            }
          }
        );
      } else {
        // If there are reviews, recalculate the averages
        const stats = await Review.aggregate([
          { $match: { product: product._id } },
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

        if (stats.length > 0) {
          console.log(`Updating product ${product._id} with ${stats[0].numReviews} reviews...`);
          await Product.findByIdAndUpdate(
            product._id,
            {
              $set: {
                rating: parseFloat(stats[0].averageRating.toFixed(1)),
                averageRating: parseFloat(stats[0].averageRating.toFixed(1)),
                numReviews: stats[0].numReviews,
                reviewCount: stats[0].numReviews,
                'ratings.quality': parseFloat(stats[0].averageQuality.toFixed(1)),
                'ratings.design': parseFloat(stats[0].averageDesign.toFixed(1)),
                'ratings.fit': parseFloat(stats[0].averageFit.toFixed(1))
              }
            }
          );
        }
      }
    }
    
    console.log('Review counts and ratings have been updated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing review counts:', error);
    process.exit(1);
  }
}

fixReviewCounts();
