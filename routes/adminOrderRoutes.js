// import express
const express = require('express');
// import Order model from models folder
const Order = require('../models/Order');
const { protect, admin } = require('../middleware/authMiddleware');

// initialize router
const router = express.Router();

// Create a route that use Admin Access to get all orders
// @route GET /api/admin/orders
// @desc Get all orders (Admin only)
// @access Private/Admin, only admin can get all orders
router.get('/', protect, admin, async (req, res) => {
    try {
        // Fetch all orders from the database
        // include user details by populating
        const orders = await Order.find({}).populate('user', 'name email');
        // send a list of orders back in response
        res.json(orders);
    } catch (error) {
        console.error(error);
        res.status(500).json({message: "Server Error"});
    }
});

// Add new collection "Admin Orders" > name it "All Orders" > GET > URL:http://localhost:9000/api/admin/orders
// Authorisation > Bearer > Token copy from Admin Login request
// You can see all orders


// Update the Status of an Order
// @route PUT /api/admin/orders/:id
// @desc Update the status of an order (Admin only)
// @access Private/Admin, only admin can update order status
router.put('/:id', protect, admin, async (req, res) => {
    try {
        // Find the order by id from the URL
        const order = await Order.findById(req.params.id).populate('user', 'name');
        // If order is found, update status
        if (order) {
            order.status = req.body.status || order.status;
            order.isDelivered =
                // if the status is delivered, mark the order as delivered
                req.body.status === "Delivered" ? true : order.isDelivered;
                // Set delivery timestamp if the status is delivered
            order.deliveredAt =
                req.body.status === "Delivered" ? Date.now() : order.deliveredAt;

            // save the updated order to the database
            const updatedOrder = await order.save();
            // save the updated order as response
            res.json({message: "Order updated successfully", order: updatedOrder});
        } else {
            // If the order does not exist, return 404
            res.status(404).json({message: "Order not found"});
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({message: "Server Error"});
    }
});

// Add new request > name it "Update Status" > PUT > URL:http://localhost:9000/api/admin/orders/:id
// Authorisation > Bearer > Token copy from Admin Login request
// {
//     "status": "Delivered"
// }
// status has been set to "Delivered"
// You should see a 200 status code
// {
//     "status": "Processing"
// }

// Create a route for Deleting an Order
// @route DELETE /api/admin/orders/:id
// @desc Delete an order (Admin only)
// @access Private/Admin, only admin can delete an order
router.delete('/:id', protect, admin, async (req, res) => {
    try {
        // Find the order by id from the URL
        const order = await Order.findById(req.params.id);
        // Check if the order exists
        if (order) {
            // If if exists, delete it from the database
            await order.deleteOne();
            // send a success message back to the client
            res.json({message: "Order removed"});
        } else {
            // If the order does not exist, return 404
            res.status(404).json({message: "Order not found"});
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({message: "Server Error"});
    }
});

// Add new request > name it "Delete" > DELETE > URL:http://localhost:9000/api/admin/orders/:id
// Authorisation > Bearer > Token copy from Admin Login request
// Add Params > ID > ID of the order
// You should see a 200 status code "Order removed"

// export the router
module.exports = router;

// Add in server.js