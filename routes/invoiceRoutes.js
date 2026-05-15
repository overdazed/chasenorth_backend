const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Order = require('../models/Order');
const invoiceService = require('../utils/invoiceService');
const { supabase } = require('../services/supabaseClient');

// @desc    Generate invoice for an order
// @route   POST /api/invoices/generate
// @access  Private
router.post('/generate', protect, async (req, res) => {
    try {
        const { orderId } = req.body;

        // Get order details with user information
        const order = await Order.findById(orderId)
            .populate('user', 'name email');
        // In your route handler
        console.log('Order from DB:', JSON.stringify(order.shippingAddress, null, 2));

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Verify the order belongs to the user or user is admin
        if (order.user._id.toString() !== req.user._id.toString() && !req.user.isAdmin) {
            return res.status(401).json({ message: 'Not authorized to access this order' });
        }

        // In invoiceRoutes.js, update the orderData preparation:
        const orderData = {
            items: order.orderItems.map(item => ({
                name: item.name,
                description: item.description || '',
                quantity: item.quantity,
                price: item.price,
                total: item.quantity * item.price,
                size: item.size,
                color: item.color
            })),
            subtotal: order.price || order.orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
            discount: order.discount || null,
            tax: order.tax || 0,
            shippingCost: order.shippingCost || order.shippingPrice || 0, // Use shippingCost first, fallback to shippingPrice for backward compatibility
            total: order.totalPrice || (order.price + order.tax + (order.shippingCost || order.shippingPrice || 0)),
            orderDate: order.paidAt || order.createdAt,
            orderId: order._id,
            notes: 'Thank you for your order!',
            // Add shipping address to orderData
            shippingAddress: {
                firstName: order.shippingAddress.firstName || '',
                lastName: order.shippingAddress.lastName || '',
                address: order.shippingAddress.address,
                city: order.shippingAddress.city,
                postalCode: order.shippingAddress.postalCode,
                country: order.shippingAddress.country
            }
        };

        console.log('Prepared order data:', JSON.stringify(orderData, null, 2));

        // Company information
        const companyData = {
            name: process.env.COMPANY_NAME,
            contact_name: process.env.COMPANY_CONTACT_NAME,
            vat: process.env.COMPANY_VAT,
            address: process.env.COMPANY_ADDRESS,
            city: process.env.COMPANY_CITY,
            zip: process.env.COMPANY_ZIP,
            country: process.env.COMPANY_COUNTRY,
            email: process.env.COMPANY_EMAIL,
            phone: process.env.COMPANY_PHONE,
            website: process.env.COMPANY_WEBSITE,
            tax_rate: parseFloat(process.env.TAX_RATE)
        };

        // Customer information
        const customerData = {
            name: order.shippingAddress.firstName + ' ' + order.shippingAddress.lastName || `${order.user.name}`,
            address: order.shippingAddress.address,
            city: order.shippingAddress.city,
            postalCode: order.shippingAddress.postalCode,
            country: order.shippingAddress.country,
            email: order.user.email
        };

        // Generate the invoice
        const { pdfBuffer, invoiceNumber } = await invoiceService.generateInvoice(
            orderData,  // Don't include invoiceNumber here, let Python generate it
            companyData,
            customerData,
            order.invoiceNumber
        );

        // Always update the order with the new invoice number
        order.invoiceNumber = invoiceNumber;
        await order.save();

        // Update order with invoice number if not already set
        // if (!order.invoiceNumber) {
        //     order.invoiceNumber = invoiceNumber;
        //     await order.save();
        // }

        // Set headers for file download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoiceNumber}.pdf`);

        // Send the PDF file
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Invoice generation error:', error);
        res.status(500).json({
            message: 'Error generating invoice',
            error: error.message
        });
    }
});


// @desc    Get invoice by order ID
// @route   GET /api/invoices/order/:id
// @access  Private
router.get('/order/:id', protect, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Verify the order belongs to the user or user is admin
        if (order.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
            return res.status(401).json({ message: 'Not authorized to access this order' });
        }

        // In a real app, you might want to store the generated invoice
        // and return it here, or regenerate it on the fly
        res.json({
            orderId: order._id,
            invoiceNumber: order.invoiceNumber,
            status: 'Invoice available for download',
            downloadUrl: `/api/invoices/download/${order._id}`
        });

    } catch (error) {
        console.error('Get invoice error:', error);
        res.status(500).json({
            message: 'Error getting invoice',
            error: error.message
        });
    }
});

// @desc    Download invoice by order ID
// @route   GET /api/invoices/download/:id
// @access  Private
router.get('/download/:id', protect, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order || !order.invoiceNumber) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        // Verify the order belongs to the user or user is admin
        if (order.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
            return res.status(401).json({ message: 'Not authorized to access this invoice' });
        }

        // Get the date from the order to construct the file path
        const date = new Date(order.paidAt || order.createdAt);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const fileName = `invoice_${order.invoiceNumber}.pdf`;
        const filePath = `invoices/${year}/${month}/${fileName}`;

        // Get the file from Supabase
        const { data, error } = await supabase.storage
            .from('invoices')
            .download(filePath);

        if (error) {
            console.error('Error downloading invoice from Supabase:', error);
            return res.status(404).json({ message: 'Invoice file not found in storage' });
        }

        // Set headers for file download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.invoiceNumber}.pdf`);

        // Convert the file to a buffer and send it
        const buffer = await data.arrayBuffer();
        res.send(Buffer.from(buffer));

    } catch (error) {
        console.error('Download invoice error:', error);
        res.status(500).json({
            message: 'Error downloading invoice',
            error: error.message
        });
    }
});

module.exports = router;
