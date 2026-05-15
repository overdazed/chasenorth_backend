const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const Report = require('../models/Report');

// @route   GET /api/admin/reports
// @desc    Get all reports with pagination
// @access  Private/Admin
router.get('/', protect, admin, async (req, res) => {
    try {
        const pageSize = 10;
        const page = Number(req.query.page) || 1;
        const status = req.query.status; // Optional status filter
        
        const query = {};
        if (status) {
            query.status = status;
        }
        
        // Exclude archived reports from the main list
        query.status = { $ne: 'Archived' };
        
        const count = await Report.countDocuments(query);
        const reports = await Report.find(query)
            .sort({ createdAt: -1 })
            .limit(pageSize)
            .skip(pageSize * (page - 1))
            .populate({
                path: 'orderId',
                select: 'orderNumber shippingAddress'
            })
            .lean();
            
        // Add customer name from shipping address to each report
        reports.forEach(report => {
            if (report.orderId?.shippingAddress) {
                const { firstName, lastName } = report.orderId.shippingAddress;
                report.customerName = `${firstName} ${lastName}`.trim();
            }
        });
            
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

// @route   GET /api/admin/reports/:id
// @desc    Get single report by ID
// @access  Private/Admin
router.get('/:id', protect, admin, async (req, res) => {
    try {
        const report = await Report.findById(req.params.id)
            .populate({
                path: 'orderId',
                select: 'shippingAddress'
            })
            .lean();
            
        if (!report) {
            return res.status(404).json({ message: 'Report not found' });
        }
        
        res.json(report);
    } catch (error) {
        console.error('Error fetching report:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/admin/reports/:id
// @desc    Update report status and add admin notes
// @access  Private/Admin
router.put('/:id', protect, admin, async (req, res) => {
    try {
        const { status, note } = req.body;
        const report = await Report.findById(req.params.id);

        if (!report) {
            return res.status(404).json({ message: 'Report not found' });
        }

        // Update status if provided
        if (status) {
            report.status = status;
            // If status is changed to Archived, set the archivedAt timestamp
            if (status === 'Archived' && !report.archivedAt) {
                report.archivedAt = new Date();
            }
        }

        // Add new note if provided
        if (note && note.trim() !== '') {
            report.adminNotes = report.adminNotes || [];
            report.adminNotes.push({
                content: note,
                adminName: req.user.name,
                timestamp: new Date(),
                status: req.body.noteStatus || status || report.status
            });
        }

        // Save the report
        await report.save();

        // Populate the orderId field for the response
        const updatedReport = await Report.findById(report._id)
            .populate({
                path: 'orderId',
                select: 'shippingAddress'
            })
            .lean();

        res.json(updatedReport);
    } catch (error) {
        console.error('Error updating report:', error);
        res.status(500).json({
            message: 'Error updating report',
            error: error.message
        });
    }
});

// @route   DELETE /api/admin/reports/:id
// @desc    Delete a report
// @access  Private/Admin
router.delete('/:id', protect, admin, async (req, res) => {
    try {
        const report = await Report.findById(req.params.id);
        
        if (!report) {
            return res.status(404).json({ message: 'Report not found' });
        }
        
        await report.remove();
        
        res.json({ message: 'Report removed' });
    } catch (error) {
        console.error('Error deleting report:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Add this route to your adminReportRoutes.js file
router.delete('/:reportId/notes/:noteId', protect, admin, async (req, res) => {
    try {
        const { reportId, noteId } = req.params;

        const report = await Report.findById(reportId);
        if (!report) {
            return res.status(404).json({ message: 'Report not found' });
        }

        // Find the index of the note to delete
        const noteIndex = report.adminNotes.findIndex(
            note => note._id.toString() === noteId
        );

        if (noteIndex === -1) {
            return res.status(404).json({ message: 'Note not found' });
        }

        // Remove the note from the array
        report.adminNotes.splice(noteIndex, 1);

        // Save the updated report
        await report.save();

        // Return the updated report with populated fields
        const updatedReport = await Report.findById(reportId)
            .populate({
                path: 'orderId',
                select: 'shippingAddress'
            })
            .lean();

        res.json(updatedReport);
    } catch (error) {
        console.error('Error deleting note:', error);
        res.status(500).json({
            message: 'Error deleting note',
            error: error.message
        });
    }
});

// Add this route for updating a note
router.put('/:reportId/notes/:noteId', protect, admin, async (req, res) => {
    try {
        const { reportId, noteId } = req.params;
        const { content, isEdited } = req.body;

        if (!content || typeof content !== 'string') {
            return res.status(400).json({ message: 'Content is required' });
        }

        const report = await Report.findById(reportId);
        if (!report) {
            return res.status(404).json({ message: 'Report not found' });
        }

        const noteIndex = report.adminNotes.findIndex(
            note => note._id.toString() === noteId
        );

        if (noteIndex === -1) {
            return res.status(404).json({ message: 'Note not found' });
        }

        // Update the note
        report.adminNotes[noteIndex].content = content;
        if (isEdited) {
            report.adminNotes[noteIndex].editedAt = new Date();
        }

        await report.save();

        // Return the updated report with populated fields
        const updatedReport = await Report.findById(reportId)
            .populate({
                path: 'orderId',
                select: 'shippingAddress'
            })
            .lean();

        res.json(updatedReport);
    } catch (error) {
        console.error('Error updating note:', error);
        res.status(500).json({
            message: 'Error updating note',
            error: error.message
        });
    }
});

module.exports = router;
