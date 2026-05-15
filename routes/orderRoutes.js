// import express
const express = require("express");
const Order = require("../models/Order");
const { protect } = require("../middleware/authMiddleware");
const { default: mongoose } = require("mongoose");
// const fs = require('fs');
// import Order model from models folder
// const { generate_invoice, get_invoice_url } = require("../utils/invoiceGenerator");
// const { exec } = require('child_process');
// const path = require('path');
// const { promisify } = require('util');
// const execAsync = promisify(exec);

// finishilize router
const router = express.Router();


// Get all orders for the logged in user
// @route GET /api/orders/my-orders
// @desc Get logged in user's orders
// @access Private
router.get("/my-orders", protect, async (req, res) => {
    try {
        // Fetch all orders for the currently logged in user
        // the users id is available in req.user._id
        const orders = await Order.find({ user: req.user._id }).sort({
            createdAt: -1,
        }); // sort order by creation date showing the most recent orders first
        // once we have the orders, send them back to the client as json
        res.json(orders);
    } catch (error) {
        console.error(error);
        res.status(500).send({message: "Server Error"});
    }
});

// Route where users can retrieve the full order details
// @route GET /api/orders/:id
// @desc Get order by id
// @access Private
router.get("/:id", protect, async (req, res) => {
    try {
        // Find the order in the database using the id from the router params
        const order = await Order.findById(req.params.id).populate(
            "user",
            "name email"
        );

        // check if the order exists
        if (!order) {
            // if no order is found, return a 404 status code
            return res.status(404).json({message: "Order not found"});
        } else {
            // if the order is found, return full order details
            res.json(order);
        }
    } catch (error) {
        console.error(error);
        res.status(500).send({message: "Server Error"});
    }
});

// @route   GET /api/orders/:id/invoice_template
// @desc    Download invoice_template for an order
// @access  Private
router.get('/:id/invoice', protect, async (req, res) => {
    try {
        // Find the order
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check if the order belongs to the user or if user is admin
        if (order.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
            return res.status(401).json({ message: 'Not authorized to access this invoice_template' });
        }

        // Check if order is paid
        if (!order.isPaid) {
            return res.status(400).json({ message: 'Invoice not available for unpaid orders' });
        }

        try {
            // Try to get existing invoice_template URL
            let invoiceUrl = await get_invoice_url(order._id.toString());

            // If no invoice_template exists, generate one
            if (!invoiceUrl) {
                // Convert Mongoose document to plain JavaScript object
                const orderObj = order.toObject();
                // Add user info to the order object
                orderObj.user = {
                    _id: req.user._id,
                    name: req.user.name,
                    email: req.user.email
                };

                // Generate and upload the invoice_template
                invoiceUrl = await generate_invoice(orderObj);

                // Optionally, you can store the invoice_template URL in the order document
                // order.invoiceUrl = invoiceUrl;
                // await order.save();
            }

            // Redirect to the invoice_template URL
            return res.redirect(invoiceUrl);

        } catch (error) {
            console.error('Invoice generation error:', error);
            return res.status(500).json({
                message: 'Error generating invoice_template',
                error: error.message
            });
        }

    } catch (error) {
        console.error('Invoice download error:', error);
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
});

// In orderRoutes.js, replace the existing /:id/invoice route with this:

// router.get('/:id/invoice', protect, async (req, res) => {
//     try {
//         // Find the order
//         const order = await Order.findById(req.params.id).populate('user', 'name email');
//
//         if (!order) {
//             return res.status(404).json({ message: 'Order not found' });
//         }
//
//         // Check if the order belongs to the user or if user is admin
//         if (order.user._id.toString() !== req.user._id.toString() && !req.user.isAdmin) {
//             return res.status(401).json({ message: 'Not authorized to access this invoice' });
//         }
//
//         // Check if order is paid
//         if (!order.isPaid) {
//             return res.status(400).json({ message: 'Invoice not available for unpaid orders' });
//         }
//
//         try {
//             // Convert order to plain object and prepare for template
//             const orderObj = order.toObject();
//             orderObj.user = {
//                 _id: order.user._id.toString(),
//                 name: order.user.name,
//                 email: order.user.email
//             };
//
//             // Call the Python script to generate the invoice
//             const scriptPath = path.join(__dirname, '../utils/invoiceGenerator.py');
//
//             async function runPythonScript(scriptPath, data) {
//                 const commands = [
//                     'python3',  // Most Unix-like systems
//                     'python',   // Some Unix-like systems and some Windows
//                     'py -3',    // Windows Python launcher
//                     'py'        // Windows Python launcher (default)
//                 ];
//
//                 let lastError;
//
//                 for (const cmd of commands) {
//                     try {
//                         const { stdout } = await execAsync(
//                             `${cmd} "${scriptPath}" '${JSON.stringify(data).replace(/'/g, "\\'")}'`
//                         );
//                         return JSON.parse(stdout);
//                     } catch (error) {
//                         lastError = error;
//                         continue;  // Try next command
//                     }
//                 }
//
//                 // If we get here, all commands failed
//                 throw new Error(`Failed to execute Python script. Tried: ${commands.join(', ')}\nLast error: ${lastError.message}`);
//             }
//
//             // If we have a URL, redirect to it
//             if (result.url && (result.url.startsWith('http') || result.url.startsWith('https'))) {
//                 return res.redirect(result.url);
//             }
//
//             // If we have a local file path, send the file
//             if (result.url) {
//                 return res.sendFile(path.resolve(result.url), (err) => {
//                     if (err) {
//                         console.error('Error sending file:', err);
//                         // Clean up the temp file
//                         try { fs.unlinkSync(result.url); } catch (e) {}
//                         return res.status(500).json({
//                             message: 'Error generating invoice',
//                             error: err.message
//                         });
//                     }
//                     // Clean up the temp file after sending
//                     try { fs.unlinkSync(result.url); } catch (e) {}
//                 });
//             }
//
//             throw new Error('No URL or file path returned from invoice generator');
//
//         } catch (error) {
//             console.error('Invoice generation error:', error);
//             return res.status(500).json({
//                 message: 'Error generating invoice',
//                 error: error.message
//             });
//         }
//
//     } catch (error) {
//         console.error('Invoice download error:', error);
//         res.status(500).json({
//             message: 'Server error',
//             error: error.message
//         });
//     }
// });

// /**
//  * @route   GET /api/orders/:id/invoice
//  * @desc    Generate or retrieve invoice for an order
//  * @access  Private
//  */
// router.get('/:id/invoice', protect, async (req, res) => {
//     try {
//         // Find the order
//         const order = await Order.findById(req.params.id).populate('user', 'name email');
//
//         if (!order) {
//             return res.status(404).json({ message: 'Order not found' });
//         }
//
//         // Check if the order belongs to the user or if user is admin
//         if (order.user._id.toString() !== req.user._id.toString() && !req.user.isAdmin) {
//             return res.status(401).json({ message: 'Not authorized to access this invoice' });
//         }
//
//         // Check if order is paid
//         if (!order.isPaid) {
//             return res.status(400).json({ message: 'Invoice not available for unpaid orders' });
//         }
//
//         try {
//             // Convert order to plain object and prepare for template
//             const orderObj = order.toObject();
//             orderObj.user = {
//                 _id: order.user._id.toString(),
//                 name: order.user.name,
//                 email: order.user.email
//             };
//
//             // Call the Python script to generate the invoice
//             const scriptPath = path.join(__dirname, '../utils/invoiceGenerator.py');
//             const { stdout } = await execAsync(
//                 `python "${scriptPath}" '${JSON.stringify(orderObj)}'`
//             );
//
//             const result = JSON.parse(stdout);
//
//             if (result.error) {
//                 throw new Error(result.error);
//             }
//
//             // If we have a URL, redirect to it
//             if (result.url && result.url.startsWith('http')) {
//                 return res.redirect(result.url);
//             }
//
//             // If we have a local file path, send the file
//             if (result.url) {
//                 return res.sendFile(result.url, (err) => {
//                     if (err) {
//                         console.error('Error sending file:', err);
//                         // Clean up the temp file
//                         try { fs.unlinkSync(result.url); } catch (e) {}
//                         return res.status(500).json({ message: 'Error generating invoice' });
//                     }
//                     // Clean up the temp file after sending
//                     try { fs.unlinkSync(result.url); } catch (e) {}
//                 });
//             }
//
//             throw new Error('No URL or file path returned from invoice generator');
//
//         } catch (error) {
//             console.error('Invoice generation error:', error);
//             return res.status(500).json({
//                 message: 'Error generating invoice',
//                 error: error.message
//             });
//         }
//
//     } catch (error) {
//         console.error('Invoice download error:', error);
//         res.status(500).json({
//             message: 'Server error',
//             error: error.message
//         });
//     }
// });
//
// router.get('/:id/invoice', protect, async (req, res) => {
//     try {
//         // Find the order
//         const order = await Order.findById(req.params.id).populate('user', 'name email');
//
//         if (!order) {
//             return res.status(404).json({ message: 'Order not found' });
//         }
//
//         // Check if the order belongs to the user or if user is admin
//         if (order.user._id.toString() !== req.user._id.toString() && !req.user.isAdmin) {
//             return res.status(401).json({ message: 'Not authorized to access this invoice' });
//         }
//
//         // Check if order is paid
//         if (!order.isPaid) {
//             return res.status(400).json({ message: 'Invoice not available for unpaid orders' });
//         }
//
//         try {
//             // Convert order to plain object and prepare for template
//             const orderObj = order.toObject();
//             orderObj.user = {
//                 _id: order.user._id.toString(),
//                 name: order.user.name,
//                 email: order.user.email
//             };
//
//             // Call the Python script to generate the invoice
//             const scriptPath = path.join(__dirname, '../utils/invoiceGenerator.py');
//             const { stdout } = await execAsync(
//                 `python "${scriptPath}" '${JSON.stringify(orderObj).replace(/'/g, "\\'")}'`
//             );
//
//             const result = JSON.parse(stdout);
//
//             if (result.error) {
//                 throw new Error(result.error);
//             }
//
//             // If we have a URL, redirect to it
//             if (result.url && (result.url.startsWith('http') || result.url.startsWith('https'))) {
//                 return res.redirect(result.url);
//             }
//
//             // If we have a local file path, send the file
//             if (result.url) {
//                 return res.sendFile(path.resolve(result.url), (err) => {
//                     if (err) {
//                         console.error('Error sending file:', err);
//                         // Clean up the temp file
//                         try { fs.unlinkSync(result.url); } catch (e) {}
//                         return res.status(500).json({
//                             message: 'Error generating invoice',
//                             error: err.message
//                         });
//                     }
//                     // Clean up the temp file after sending
//                     try { fs.unlinkSync(result.url); } catch (e) {}
//                 });
//             }
//
//             throw new Error('No URL or file path returned from invoice generator');
//
//         } catch (error) {
//             console.error('Invoice generation error:', error);
//             return res.status(500).json({
//                 message: 'Error generating invoice',
//                 error: error.message
//             });
//         }
//
//     } catch (error) {
//         console.error('Invoice download error:', error);
//         res.status(500).json({
//             message: 'Server error',
//             error: error.message
//         });
//     }
// });

// export the router
module.exports = router;

// include the following routes in server.js

// Create a new collection "Orders" > name it "My Orders" > GET > URL:http://localhost:9000/api/orders/my-orders
// Authorisation > Bearer > Token copy from Login request
// You can see all your orders

// Create a new request "Order Details" > GET > URL:http://localhost:9000/api/orders/:id
// Authorisation > Bearer > Token copy from Login request
// Params > id > copy an _id from "My Orders" request
// You get a 200 response with the order details

// We have completed the order routes

// open .env file

module.exports = router;
