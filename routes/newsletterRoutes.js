// In your server.js or routes/newsletter.js
const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const Subscription = require('../models/Subscription');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Email transporter setup (using Gmail as an example)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE,
    auth: {
        user: process.env.EMAIL_USER, // e.g. newsletter@yourdomain.com
        pass: process.env.EMAIL_PASS  // mailbox password
    }
});

// Get a random discount code from environment variables
function getRandomDiscountCode() {
    const codes = [];
    for (let i = 1; i <= 10; i++) {
        if (process.env[`VITE_DISCOUNT_NL${i}`]) {
            codes.push(process.env[`VITE_DISCOUNT_NL${i}`]);
        }
    }
    return codes[Math.floor(Math.random() * codes.length)] || 'DISCOUNT10';
}

// Subscribe to newsletter
router.post('/subscribe', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    try {
        // Check if email already exists
        const existingSubscription = await Subscription.findOne({ email: email.toLowerCase() });
        if (existingSubscription) {
            return res.status(400).json({
                success: false,
                message: 'You are already subscribed!'
            });
        }
        const discountCode = getRandomDiscountCode();

        // In your route handler, replace the mailOptions.html with:
        const emailTemplatePath = path.join(__dirname, '../data/compass_newsletter.html');
        let emailTemplate = fs.readFileSync(emailTemplatePath, 'utf8');

        // Replace the discount code placeholder with the actual code
        emailTemplate = emailTemplate.replace('COMPASS10', discountCode);

        // Save to database first
        const subscription = new Subscription({
            email: email.toLowerCase(),
            discountCode
        });
        await subscription.save();

        // Send email
        const mailOptions = {
            from: '"ChaseNorth" <compass@chasenorth.com>',
            to: email,
            subject: 'Setz deinen Kompass 🧭',
            html: emailTemplate
        };

        await transporter.sendMail(mailOptions);

        // Here you would typically save the email and code to your database
        // await saveToDatabase(email, discountCode);

        res.json({
            success: true,
            // message: 'Subscription successful'
        });

    } catch (error) {
        console.error('Error processing subscription:', error);
        if (error.code === 11000) { // MongoDB duplicate key error
            return res.status(400).json({
                success: false,
                message: 'This email is already subscribed.'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Failed to process subscription. Please try again.'
        });
    }
});

module.exports = router;