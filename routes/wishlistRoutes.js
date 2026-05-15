const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
    addToWishlist,
    removeFromWishlist,
    getWishlist
} = require('../controllers/wishlistController');

const router = express.Router();

// All routes are protected
router.use(protect);

router.route('/')
    .get(getWishlist)
    .post(addToWishlist);

router.delete('/:productId', removeFromWishlist);

module.exports = router;