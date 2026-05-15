const User = require('../models/User');
const Product = require('../models/Product');

exports.addToWishlist = async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.user._id;

        const user = await User.findById(userId);
        if (!user.wishlist.includes(productId)) {
            user.wishlist.push(productId);
            await user.save();
        }

        res.status(200).json({
            status: 'success',
            data: {
                wishlist: user.wishlist
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

exports.removeFromWishlist = async (req, res) => {
    try {
        const { productId } = req.params;
        const userId = req.user._id;

        const user = await User.findByIdAndUpdate(
            userId,
            { $pull: { wishlist: productId } },
            { new: true }
        );

        res.status(200).json({
            status: 'success',
            data: {
                wishlist: user.wishlist
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

exports.getWishlist = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate('wishlist');
        res.status(200).json({
            status: 'success',
            data: {
                wishlist: user.wishlist
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};