const express = require('express');
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const { protect } = require("../middleware/authMiddleware");

// declare Router instance
const router = express.Router();

// Helper function to get the cart by user id or guest id
const getCart = async (userId, guestId) => {
    if (userId) {
        // If the user ID is present, create a cart using the user ID
        return await Cart.findOne({ user: userId });
    } else if (guestId) {
        // If the guest ID is present, create a cart using the guest ID
        return await Cart.findOne({ guestId });
    }
    // If neither user ID nor guest ID is present, return null
    return null;
}

// create the Cart
// @route POST /api/cart
// @desc Add a product to the cart for a guest or logged in user
// @access Public
router.post("/", async (req, res) => {
    const { productId, quantity, size, color, guestId, userId } = req.body;
    try {
        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({message: "Product not found!"});

        // determine the user is logged in or guest
        let cart = await getCart(userId, guestId); // provide us the cart information
        // if the cart exist, update it
        if (cart) {
            const productIndex = cart.products.findIndex(
            (p) =>
                p.productId.toString() === productId &&
                p.size === size &&
                p.color === color
            );
            // the reason why we want to check this index is, because we need to make sure cart items will contain
            // a unique combination of productId, size and color
            // Let's say we have a "Winter Jacket" with size "M" and color "Red"
            // We have another "Winter Jacket" with size "L" and color "Yellow"

            // We need to check if that particular "Winter Jacket" with size "M" and color "Red" is already in the cart
            if (productIndex > -1) {
                // If the product is already in the cart, update the quantity
                cart.products[productIndex].quantity += quantity;
            } else {
                // If the product is not in the cart, add it
                cart.products.push({
                    productId,
                    name: product.name,
                    image: product.images[0].url,
                    price: product.price,
                    size,
                    color,
                    quantity,
                });
            }

            // Recalculate the total price
            // acc = accumulator
            // initial value of acc is 0
            cart.totalPrice = cart.products.reduce(
                (acc, item) => acc + item.price * item.quantity,
                0
            )

            // Save the updated cart
            await cart.save();
            return res.status(200).json(cart);
        } else {
            // Create a new cart for guest or user
            const newCart = await Cart.create({
                // check for user id, if its present send the user id or undefined
                user: userId ? userId : undefined,
                // check for guest id, if its present send the guest id or create a new guest id
                guestId: guestId ? guestId : "guest_" + new Date().getTime(),
                products: [
                    {
                        productId,
                        name: product.name,
                        image: product.images[0].url,
                        price: product.price,
                        size,
                        color,
                        quantity,
                    },
                ],
                totalPrice: product.price * quantity,
            });
            return res.status(201).json(newCart);
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({message: "Server Error"});
    }
})

// Create a Collection for the Cart > New Request "Create"> POST > URL:http://localhost:9000/api/cart
// Body > raw >

// {
//     "productId": "684b1cf2c78d7e1bc4b83d6a",
//     "size": "M",
//     "color": "Red",
//     "quantity": 1
// }

// 404 Error, we haven't added the router in the server file
// Error again, not exported!!!

// 201 response: guestId generated
// in MongoDB, copy the guestId from the response, pass it in the request
// guest_1749767368868

// test with user id
// user id does not getting updated



// update the cart quantity
// @route PUT /api/cart
// @desc Update the quantity of a product in the cart for a guest or logged in user
// @access Public
router.put("/", async (req, res) => {
    const { productId, quantity, size, color, guestId, userId } = req.body;

    try {
        let cart = await getCart(userId, guestId);

        // if cart is not present
        if(!cart) return res.status(404).json({message: "Cart not found"});

        const productIndex = cart.products.findIndex(
            (p) =>
                p.productId.toString() === productId &&
                p.size === size &&
                p.color === color
        );

        // find the variance of this block

        if (productIndex > -1) {
            // update the quantity, if quantity is greater than 0. Quantity that we get from the user
            if (quantity > 0) {
                cart.products[productIndex].quantity = quantity;
            } else {
                cart.products.splice(productIndex, 1);
                // Romove product if quantity is 0
            }

            cart.totalPrice = cart.products.reduce(
                (acc, item) => acc + item.price * item.quantity,
                0
            )
            await cart.save();
            return res.status(200).json(cart);
        } else {
            return res.status(404).json({message: "Product not found in cart"});
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({message: "Server Error"});
    }
})

// Delete a product from the cart
// @route DELETE /api/cart
// @desc Delete a product from the cart
// @access Public
router.delete("/", async (req, res) => {
    const { productId, size, color, guestId, userId } = req.body;

    try {
        let cart = await getCart(userId, guestId);

        // if cart is not present
        if(!cart) return res.status(404).json({message: "Cart not found"});

        const productIndex = cart.products.findIndex(
            (p) =>
                p.productId.toString() === productId &&
                p.size === size &&
                p.color === color
        );

        // if you find the product then we will simply remove it using splice method
        if (productIndex > -1) {
            cart.products.splice(productIndex, 1);
            cart.totalPrice = cart.products.reduce(
                (acc, item) => acc + item.price * item.quantity,
                0
            )
            await cart.save();
            return res.status(200).json(cart);
        } else {
            return res.status(404).json({message: "Product not found in cart"});
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({message: "Server Error"});
    }
})


// Display the cart
// @route GET /api/cart?userId={userId}&guestId={guestId}
// @desc Get logged-in user's or guest's cart
// @access Public
router.get("/", async (req, res) => {
    const { userId, guestId } = req.query;
    
    if (!userId && !guestId) {
        return res.status(400).json({ message: 'Either userId or guestId is required' });
    }
    
    try {
        const cart = await getCart(userId, guestId);
        
        if (!cart) {
            // If no cart exists, return an empty cart
            return res.status(200).json({ 
                products: [],
                totalPrice: 0,
                totalItems: 0
            });
        }
        
        // Calculate total price and items
        const totalPrice = cart.products.reduce((total, item) => {
            return total + (item.quantity * item.price);
        }, 0);
        
        const totalItems = cart.products.reduce((total, item) => {
            return total + item.quantity;
        }, 0);
        
        res.status(200).json({
            products: cart.products,
            totalPrice,
            totalItems
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({message: "Server Error"});

    }

})

// Merge
// @route POST /api/cart/merge
// @desc Merge guest cart with user cart on login
// @access Private
router.post("/merge", protect,async (req, res) => {
    // get the guest id from the request body
    const { guestId } = req.body;
    try {
        // Find the guest cart and user cart
        const guestCart = await Cart.findOne({ guestId });
        const userCart = await Cart.findOne({ user: req.user._id });
        // if guest cart is present, then we will check if the products are present in the cart
        if (guestCart) {
            if (guestCart.products.length === 0) {
                return res.status(400).json({message: "Guest cart is empty"});
            }

            if (userCart) {
                // Merge guest cart into user cart
                guestCart.products.forEach((guestItem) => {
                    // for each guest cart item, we will check the productIndex
                    const productIndex = userCart.products.findIndex(
                        (item) =>
                            item.productId.toString() === guestItem.productId.toString() &&
                            item.size === guestItem.size &&
                            item.color === guestItem.color
                    );

                    if (productIndex > -1) {
                        // If the items exists in the user cart, update the quantity
                        userCart.products[productIndex].quantity += guestItem.quantity;
                    } else {
                        // Otherwise, add the guest item to the cart
                        userCart.products.push(guestItem);
                    }
                });
                userCart.totalPrice = userCart.products.reduce(
                    (acc, item) => acc + item.price * item.quantity,
                    0
                );
                await userCart.save();
                // remove the guest cart after merging
                try {
                    await Cart.findOneAndDelete({ guestId })
                } catch (error) {
                    console.error("Error deleting guest cart:", error);
                }
                res.status(200).json(userCart);
            } else {
                // If user has no existing cart, assign the guest cart to the user
                guestCart.user = req.user._id;
                guestCart.guestId = undefined;
                await guestCart.save();
                res.status(200).json(guestCart);
            }
        } else {
            if (userCart) {
                // If guest cart has been merged, respond with the user cart
                return res.status(200).json(userCart);
            }
            res.status(404).json({message: "Guest cart not found"});
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({message: "Server Error"});
    }
})

// Delete all entries in cart
// npm run seed
// > All Products > resend the request, products are also repopulated, the old IDs will not work
// Start by having a cart as a guest user > use merge request to be able to merge and link to the user that gets logged in

module.exports = router