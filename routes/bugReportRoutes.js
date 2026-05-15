const express = require('express');
const multer = require('multer');
const { sendBugReport } = require('../controllers/bugReportController');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit per file
        files: 5 // Max 5 files
    },
    fileFilter: (req, file, cb) => {
        // Accept only image files
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            console.log('File rejected - not an image:', file.originalname, file.mimetype);
            cb(new Error('Only image files are allowed (jpg, jpeg, png, gif)'), false);
        }
    }
});

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // A Multer error occurred when uploading
        console.error('Multer Error:', err);
        return res.status(400).json({
            success: false,
            message: err.message || 'File upload error',
            code: err.code
        });
    } else if (err) {
        // An unknown error occurred
        console.error('Upload Error:', err);
        return res.status(400).json({
            success: false,
            message: err.message || 'Error uploading file'
        });
    }
    // No error, proceed to next middleware
    next();
};

// @route   POST /api/bug-report
// @desc    Submit a bug report
// @access  Public
router.post('/',
    (req, res, next) => {
        console.log('Request received. Checking for files...');
        next();
    },
    upload.array('attachments', 5),
    handleMulterError,
    async (req, res) => {
        try {
            console.log('Request body:', {
                email: req.body.email,
                subject: req.body.subject,
                hasDescription: !!req.body.description,
                fileCount: req.files ? req.files.length : 0
            });

            if (!req.body.email || !req.body.subject || !req.body.description) {
                return res.status(400).json({
                    success: false,
                    message: 'Please provide email, subject, and description'
                });
            }

            // Call the controller
            await sendBugReport(req, res);
        } catch (error) {
            console.error('Error in bug report route:', error);
            res.status(500).json({
                success: false,
                message: 'Server error',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
);

module.exports = router;