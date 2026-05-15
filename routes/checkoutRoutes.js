const express = require('express');
const Checkout = require('../models/Checkout');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { protect } = require('../middleware/authMiddleware');
const { generateAndSaveInvoice } = require('../utils/invoiceStorage');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

const router = express.Router();


// 1. Route = Checkout Section
// @route POST /api/checkout
// @desc Create a new checkout session
// @access Private/Customer, only customer can create a new checkout
// In the POST / route of checkoutRoutes.js
router.post('/', protect, async (req, res) => {
    const { 
        checkoutItems, 
        shippingAddress, 
        paymentMethod, 
        subtotal, 
        discount = {},
        shippingCost = 0,
        totalPrice 
    } = req.body;

    // Add validation for required fields
    if (!checkoutItems || checkoutItems.length === 0) {
        return res.status(400).json({message: 'No items in checkout.'});
    }

    try {
        const completeShippingAddress = {
            ...shippingAddress,
            firstName: shippingAddress?.firstName || 'Customer',
            lastName: shippingAddress?.lastName || 'Name'
        };

        // Create a new checkout session with all pricing details
        const newCheckout = await Checkout.create({
            user: req.user._id,
            checkoutItems: checkoutItems,
            shippingAddress: completeShippingAddress,
            paymentMethod,
            subtotal: subtotal || totalPrice, // Use provided subtotal or fallback to totalPrice
            discount: {
                code: discount.code || '',
                amount: discount.amount || 0,
                percentage: discount.percentage || 0,
                isFreeShipping: discount.isFreeShipping || false
            },
            shippingCost: shippingCost, // Use the shipping cost provided by the frontend
            totalPrice: totalPrice,
            paymentStatus: 'Pending',
            isPaid: false
        });

        res.status(201).json(newCheckout);
    } catch (error) {
        console.error("Error creating checkout session:", error);
        res.status(500).json({
            message: 'Server Error',
            error: error.message
        });
    }
});

// Add Pay Route
// @route PUT /api/checkout/:id/pay
// @desc Update checkout to mark after successful payment
// @access Private
router.put('/:id/pay', protect, async (req, res) => {
    const { paymentStatus, paymentDetails } = req.body;
    try {
        // We need to find the checkout by id passed in the URL parameter
        const checkout = await Checkout.findById(req.params.id);
        // If the checkout does not exist, return 404
        if (!checkout) {
            return res.status(404).json({message: 'Checkout not found'});
        }
        // Check if paymentStatus is "Paid"
        if (paymentStatus === "paid") {
            checkout.isPaid = true;
            // Update paymentStatus to "Paid"
            checkout.paymentStatus = paymentStatus;
            // Store the additional payment details like transaction ID or payment method
            checkout.paymentDetails = paymentDetails;
            // record the time when the payment was made
            checkout.paidAt = Date.now();
            // safe the updated checkout account to the database
            await checkout.save();
            // respond with 200 and update the checkout object
            res.status(200).json(checkout);
        } else {
            // If paymentStatus is not "Paid", return 400
            res.status(400).json({message: 'Invalid Payment Status.'});
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({message: 'Server Error'});
    }
})

// Finalized Route
// @route POST /api/checkout/:id/finalize
// @desc Finalize checkout and convert to an order after payment confirmation
// @access Private
// In checkoutRoutes.js, update the POST /:id/finalize route
router.post('/:id/finalize', protect, async (req, res) => {
    try {
        // Retrieve the checkout by id from the URL
        const checkout = await Checkout.findById(req.params.id);

        // If the checkout session is not present, return 404
        if (!checkout) {
            return res.status(404).json({message: 'Checkout not found'});
        }

        // Ensure shipping address has required fields
        const shippingAddress = {
            ...checkout.shippingAddress,
            firstName: checkout.shippingAddress?.firstName || 'Customer',
            lastName: checkout.shippingAddress?.lastName || 'Name'
        };

        // Check if checkout is paid, but not finalized
        if (checkout.isPaid && !checkout.isFinalized) {
            // Calculate the correct values for the order
            const subtotal = checkout.subtotal || checkout.checkoutItems.reduce((sum, item) =>
                sum + (item.price * item.quantity), 0);

            const discountAmount = checkout.discount?.amount || 0;

            // Use the shippingCost from checkout, which is already 0 if free shipping was applied
            const shippingCost = checkout.shippingCost || 0;

            // Calculate total price
            const totalPrice = subtotal - discountAmount + shippingCost;

            // Create the final order with the updated shipping address
            const finalOrder = await Order.create({
                user: checkout.user,
                orderItems: checkout.checkoutItems.map(item => ({
                    productId: item.productId,
                    name: item.name,
                    image: item.image,
                    price: item.price,
                    quantity: item.quantity,
                    size: item.size,
                    color: item.color
                })),
                shippingAddress: shippingAddress,
                paymentMethod: checkout.paymentMethod,
                subtotal: subtotal,
                discount: {
                    code: checkout.discount?.code || '',
                    amount: discountAmount,
                    percentage: checkout.discount?.percentage || 0,
                    isFreeShipping: checkout.discount?.isFreeShipping || false
                },
                shippingCost: shippingCost,  // This will be 0 if free shipping was applied
                totalPrice: totalPrice,
                isPaid: true,
                paidAt: checkout.paidAt,
                paymentResult: {
                    id: checkout.paymentDetails?.id || 'N/A',
                    status: checkout.paymentStatus,
                    update_time: checkout.paidAt,
                    email_address: req.user.email
                }
            });

            // Generate and save invoice
            try {
                // Prepare company data
                const companyData = {
                    name: process.env.COMPANY_NAME || 'Adventure Store',
                    contact_name: process.env.COMPANY_CONTACT_NAME || 'Customer Service',
                    vat: process.env.COMPANY_VAT || '',
                    address: process.env.COMPANY_ADDRESS || '123 Adventure St',
                    city: process.env.COMPANY_CITY || 'Adventure City',
                    zip: process.env.COMPANY_ZIP || '12345',
                    country: process.env.COMPANY_COUNTRY || 'Adventureland',
                    email: process.env.COMPANY_EMAIL || 'billing@adventurestore.com',
                    phone: process.env.COMPANY_PHONE || '+1 (555) 123-4567',
                    website: process.env.COMPANY_WEBSITE || 'www.adventurestore.com',
                    tax_rate: parseFloat(process.env.TAX_RATE) || 0
                };

                // Generate and save the invoice
                const { invoiceNumber, invoicePath } = await generateAndSaveInvoice(
                    finalOrder,
                    companyData,
                    {
                        name: `${shippingAddress.firstName} ${shippingAddress.lastName}`,
                        email: req.user.email,
                        address: shippingAddress.address,
                        city: shippingAddress.city,
                        postalCode: shippingAddress.postalCode,
                        country: shippingAddress.country
                    },
                    supabase
                );

                // Update the order with invoice information
                finalOrder.invoiceNumber = invoiceNumber;
                finalOrder.invoicePath = invoicePath;
                await finalOrder.save();

                console.log(`Invoice generated and saved: ${invoiceNumber}`);
            } catch (invoiceError) {
                console.error('Error generating/saving invoice:', invoiceError);
                // Don't fail the order if invoice generation fails
            }

            // Rest of the code remains the same...
            // [Previous invoice generation and other code...]

            // Mark the checkout as finalized
            checkout.isFinalized = true;
            await checkout.save();

            // Clear the user's cart
            await Cart.findOneAndDelete({ user: req.user._id });

            // Update product counts in stock
            for (const item of checkout.checkoutItems) {
                await Product.updateOne(
                    { _id: item.productId },
                    { $inc: { countInStock: -item.quantity } }
                );
            }

            res.status(201).json(finalOrder);
        } else {
            res.status(400).json({
                message: checkout.isFinalized ?
                    'Order already finalized' :
                    'Payment not completed'
            });
        }
    } catch (error) {
        console.error('Error finalizing order:', error);
        res.status(500).json({
            message: 'Server Error',
            error: error.message
        });
    }
});

module.exports = router

// include this file in server.js

// Test the route with Postman
// Add a new collection "Checkout" > name it "Create" > POST > URL:http://localhost:9000/api/checkout > Body > raw
// Add Authorization > Bearer > Token copy from Login request
// Send > 200 > Payment Status is not paid
// {
//     "checkoutItems": [
//     {
//         "productId": "684cb51e3f2947ea741f7edc",
//         "name": "Classic Oxford Button-Down Shirt",
//         "image": "http://picsum.photos/seed/denim1/500/500",
//         "price": 20,
//         "quantity": 1
//     }
// ],
//     "shippingAddress": {
//     "address": "123 street",
//         "city": "New York",
//         "postalCode": "10001",
//         "country": "USA"
// },
//     "paymentMethod": "PayPal",
//     "totalPrice": 20
// }

// Test Finalize Request, creates an order on successful payment
// New request > Finalize > POST > URL:http://localhost:9000/api/checkout/:id/finalize > Body > raw > nothing
// Add Authorization > Bearer > Token copy from Login request
// Send > 201 > We are able to finalize the checkout session