const express = require('express');
const multer = require('multer');
const { protect, admin } = require('../middleware/authMiddleware');
const Report = require('../models/Report');
const { sendReportConfirmation } = require('../services/emailService');

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// @route   POST /api/reports
// @desc    Create a new report
// @access  Public
router.post('/', upload.array('attachments', 5), async (req, res) => {
    try {
        const { orderId, problemType, details, desiredOutcome, email } = req.body;
        const attachments = req.files || [];
        const uploadedFiles = [];

        // First create the report to get the reference number
        const report = new Report({
            orderId,
            problemType,
            details,
            desiredOutcome,
            email: email || (req.user ? req.user.email : null),
            userId: req.user?.id,
            attachments: []
        });

        await report.save();

        // Upload files to Supabase with reference number in filenames
        for (const [index, file] of attachments.entries()) {
            const fileExt = file.originalname.split('.').pop();
            const fileName = `${report.referenceNumber}${attachments.length > 1 ? `_${index}` : ''}.${fileExt.toLowerCase()}`;

            const { data, error } = await supabase.storage
                .from('reports')
                .upload(`attachments/${fileName}`, file.buffer, {
                    contentType: file.mimetype,
                    upsert: false
                });

            if (error) throw error;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('reports')
                .getPublicUrl(`attachments/${fileName}`);

            uploadedFiles.push({
                filename: file.originalname,
                path: `attachments/${fileName}`,
                url: publicUrl,
                mimetype: file.mimetype
            });
        }

        // Update report with attachments
        report.attachments = uploadedFiles;
        await report.save();

        // Send confirmation email
        const recipientEmail = email || (req.user ? req.user.email : null);
        if (recipientEmail) {
            try {
                await sendReportConfirmation({
                    to: recipientEmail,
                    referenceNumber: report.referenceNumber,
                    reportId: report._id,
                    orderId: report.orderId,
                    problemType: report.problemType,
                    details: report.details,
                    desiredOutcome: report.desiredOutcome,
                    attachments: uploadedFiles
                });
            } catch (emailError) {
                console.error('Failed to send confirmation email:', emailError);
                // Don't fail the request if email fails
            }
        }

        res.status(201).json({
            success: true,
            data: {
                ...report.toObject(),
                referenceNumber: report.referenceNumber
            },
            message: 'Report submitted successfully'
        });

    } catch (error) {
        console.error('Error submitting report:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting report',
            error: error.message
        });
    }
});

// @route   GET /api/reports/order/:orderId
// @desc    Get report by order ID
// @access  Public
router.get('/order/:orderId', async (req, res) => {
    try {
        const report = await Report.findOne({ orderId: req.params.orderId })
            .select('_id orderId status createdAt updatedAt')
            .lean();

        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'No report found for this order'
            });
        }

        res.json({
            success: true,
            data: report
        });
    } catch (error) {
        console.error('Error fetching report:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching report',
            error: error.message
        });
    }
});

// @route   GET /api/reports/user/:email
// @desc    Get reports by user email
// @access  Public
router.get('/user/:email', async (req, res) => {
    try {
        const userEmail = req.params.email;
        console.log(`[${new Date().toISOString()}] Fetching reports for email:`, userEmail);

        // Log the raw query being executed
        const query = { email: userEmail };
        console.log('Database query:', JSON.stringify(query, null, 2));

        const reports = await Report.find(query)
            .populate('orderId', 'orderNumber')
            .sort({ createdAt: -1 })
            .lean()
            .exec();

        console.log(`[${new Date().toISOString()}] Raw reports from DB (${reports.length}):`, JSON.stringify(reports, null, 2));

        // Filter out archived reports
        const filteredReports = reports.filter(report => {
            const isArchived = report.status === 'Archived';
            if (isArchived) {
                console.log(`Filtering out archived report:`, {
                    _id: report._id,
                    status: report.status,
                    problemType: report.problemType
                });
            }
            return !isArchived;
        });

        console.log(`[${new Date().toISOString()}] Returning ${filteredReports.length} non-archived reports`);

        res.json({
            success: true,
            reports: filteredReports
        });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error in /api/reports/user/:email:`, {
            error: error.message,
            stack: error.stack,
            params: req.params
        });
        res.status(500).json({
            success: false,
            message: 'Error fetching user reports',
            error: error.message
        });
    }
});

// @desc    Upload file for a report
// @route   POST /api/reports/upload/:reportId
// @access  Private
router.post('/upload/:reportId', protect, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const report = await Report.findById(req.params.reportId);
        if (!report) {
            return res.status(404).json({ success: false, message: 'Report not found' });
        }

        const file = req.file;
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        const filePath = `${report._id}/${fileName}`;

        // Upload to Supabase
        const { error: uploadError } = await supabase.storage
            .from('reports')
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: false,
                cacheControl: '3600',
            });

        if (uploadError) {
            console.error('Supabase upload error:', uploadError);
            return res.status(500).json({ 
                success: false, 
                message: 'Failed to upload file to storage',
                error: uploadError.message 
            });
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('reports')
            .getPublicUrl(filePath);

        const attachment = {
            filename: file.originalname,
            path: filePath,
            url: publicUrl,
            mimetype: file.mimetype,
            size: file.size
        };

        // Add the attachment to the report
        report.attachments = [...(report.attachments || []), attachment];
        await report.save();

        res.status(200).json({
            success: true,
            message: 'File uploaded successfully',
            attachment
        });

    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during file upload',
            error: error.message 
        });
    }
});

// Admin routes
const adminRouter = express.Router();

// Apply admin middleware to all admin routes
adminRouter.use(protect, admin);

// @desc    Get all reports with pagination and search
// @route   GET /api/admin/reports
// @access  Private/Admin
adminRouter.get('/', async (req, res) => {
    try {
        const pageSize = 10;
        const page = Number(req.query.page) || 1;

        // Search and filter
        const keyword = req.query.keyword
            ? {
                $or: [
                    { referenceNumber: { $regex: req.query.keyword, $options: 'i' } },
                    { problemType: { $regex: req.query.keyword, $options: 'i' } },
                    { email: { $regex: req.query.keyword, $options: 'i' } }
                ]
            }
            : {};

        const count = await Report.countDocuments({ ...keyword });
        const reports = await Report.find({ ...keyword })
            .populate('orderId', 'orderNumber')
            .sort({ createdAt: -1 })
            .limit(pageSize)
            .skip(pageSize * (page - 1));

        res.json({
            reports,
            page,
            pages: Math.ceil(count / pageSize),
            total: count
        });
    } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @desc    Update report status
// @route   PATCH /api/admin/reports/:id/status
// @access  Private/Admin
adminRouter.patch('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;

        if (!['Submitted', 'In Review', 'Needs Info', 'Resolved', 'Rejected', 'Archived'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status value' });
        }

        const report = await Report.findById(req.params.id);

        if (!report) {
            return res.status(404).json({ message: 'Report not found' });
        }

        report.status = status;
        const updatedReport = await report.save();

        res.json({
            _id: updatedReport._id,
            referenceNumber: updatedReport.referenceNumber,
            status: updatedReport.status,
            updatedAt: updatedReport.updatedAt
        });
    } catch (error) {
        console.error('Error updating report status:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @desc    Add attachments to a report
// @route   POST /api/admin/reports/:id/attachments
// @access  Private/Admin
adminRouter.post('/:id/attachments', upload.array('attachments', 5), async (req, res) => {
    try {
        const report = await Report.findById(req.params.id);
        
        if (!report) {
            return res.status(404).json({ message: 'Report not found' });
        }

        const files = req.files || [];
        const uploadedAttachments = [];

        // Upload each file to Supabase
        for (const file of files) {
            const fileExt = file.originalname.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
            const filePath = `reports/${report._id}/${fileName}`;
            
            // Upload to Supabase
            const { error: uploadError } = await supabase.storage
                .from('reports')
                .upload(filePath, file.buffer, {
                    contentType: file.mimetype,
                    upsert: false
                });
            
            if (uploadError) {
                console.error('Error uploading to Supabase:', uploadError);
                continue; // Skip this file but continue with others
            }
            
            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('reports')
                .getPublicUrl(filePath);
            
            uploadedAttachments.push({
                filename: file.originalname,
                path: `${report._id}/${fileName}`,
                url: publicUrl,
                mimetype: file.mimetype
            });
        }

        if (uploadedAttachments.length === 0) {
            return res.status(400).json({ message: 'No files were uploaded' });
        }

        // Add new attachments to the report
        report.attachments = [...(report.attachments || []), ...uploadedAttachments];
        
        await report.save();
        
        // Populate the report data for the response
        const updatedReport = await Report.findById(report._id)
            .populate('orderId')
            .populate('attachments');
        
        res.status(200).json({
            message: 'Files uploaded successfully',
            report: updatedReport
        });
    } catch (error) {
        console.error('Error uploading files:', error);
        res.status(500).json({ 
            message: 'Failed to upload files',
            error: error.message 
        });
    }
});

// @desc    Get single report
// @route   GET /api/admin/reports/:id
// @access  Private/Admin
adminRouter.get('/:id', async (req, res) => {
    try {
        const report = await Report.findById(req.params.id)
            .populate('orderId')
            .populate('attachments');

        if (!report) {
            return res.status(404).json({ message: 'Report not found' });
        }

        res.json(report);
    } catch (error) {
        console.error('Error fetching report:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Mount admin routes
router.use('/admin/reports', adminRouter);

module.exports = router;