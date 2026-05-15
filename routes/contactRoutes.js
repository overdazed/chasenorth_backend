const express = require('express');
const { body, validationResult } = require('express-validator');
const sendEmail = require('../utils/sendEmail');
const multer = require('multer');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// @route   POST /api/contact
// @desc    Handle contact form submission
// @access  Public
router.post(
    '/',
    upload.array('attachments', 5), // Limit to 5 files
    async (req, res) => {
        try {
            console.log('Received contact form data:', req.body);
            console.log('Received files:', req.files);

            // Manual validation
            const { name, email, subject, message, priority } = req.body;
            const attachments = req.files || [];
            const errors = [];

            // Validate required fields
            if (!name || name.trim() === '') {
                errors.push({
                    param: 'name',
                    msg: 'Name is required',
                    location: 'body'
                });
            }
            if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
                errors.push({
                    param: 'email',
                    msg: 'Please enter a valid email',
                    location: 'body'
                });
            }
            if (!subject || subject.trim() === '') {
                errors.push({
                    param: 'subject',
                    msg: 'Subject is required',
                    location: 'body'
                });
            }
            if (!message || message.trim() === '') {
                errors.push({
                    param: 'message',
                    msg: 'Message is required',
                    location: 'body'
                });
            }

            // Validate file types
            const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
            const invalidFiles = attachments.filter(
                file => !allowedTypes.includes(file.mimetype)
            );

            if (invalidFiles.length > 0) {
                errors.push({
                    param: 'attachments',
                    msg: 'Invalid file type. Only JPG, PNG, and PDF files are allowed',
                    location: 'body'
                });
            }

            if (errors.length > 0) {
                console.error('Validation errors:', errors);
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors
                });
            }
            // Prepare email options
            const emailOptions = {
                email: 'support@chasenorth.com',
                subject: `[${priority || 'No Priority'}] ${subject}`,
                message: `
                    You have received a new contact form submission:
                     
                    Name: ${name}
                    Email: ${email}
                    Priority: ${priority || 'Not specified'}
                    
                    Message:
                    ${message}`,
                html: `
                    <h2>New Contact Form Submission</h2>
                    <p><strong>Name:</strong> ${name}</p>
                    <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
                    <p><strong>Priority:</strong> ${priority || 'Not specified'}</p>
                    <h3>Message:</h3>
                    <p>${message.replace(/\n/g, '<br>')}</p>
                    ${attachments.length > 0 ? '<h3>Attachments:</h3>' : ''}
                    ${attachments.map(file => `<p>${file.originalname}</p>`).join('')}
                `,
                attachments: attachments
            };

            // Send email using the sendEmail utility
            await sendEmail(emailOptions);

            res.status(200).json({ message: 'Your message has been sent successfully!' });
        } catch (error) {
            console.error('Error sending email:', error);
            res.status(500).json({ message: 'Error sending message. Please try again later.' });
        }
    }
);

module.exports = router;
