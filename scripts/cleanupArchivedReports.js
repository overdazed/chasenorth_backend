const mongoose = require('mongoose');
const Report = require('../models/Report');
const { supabase } = require('../config/supabase');
const cron = require('node-cron');

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB connected for cleanup job');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

// Function to delete attachments from Supabase
const deleteAttachmentsFromSupabase = async (attachments) => {
    if (!attachments || attachments.length === 0) {
        return;
    }

    try {
        // Delete each attachment from Supabase storage
        for (const attachment of attachments) {
            if (attachment.path) {
                const filePath = `reports/attachments/${attachment.path}`;
                const { error } = await supabase.storage.from('reports').remove([filePath]);
                
                if (error) {
                    console.error(`Error deleting attachment ${filePath}:`, error.message);
                } else {
                    console.log(`Successfully deleted attachment: ${filePath}`);
                }
            }
        }
    } catch (error) {
        console.error('Error deleting attachments from Supabase:', error.message);
    }
};

// Function to cleanup archived reports
const cleanupArchivedReports = async () => {
    console.log('Starting cleanup of archived reports...');
    
    try {
        // Calculate the date 30 days ago
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 1);
        
        // Find all reports that were archived more than 30 days ago
        const archivedReports = await Report.find({
            status: 'Archived',
            archivedAt: { $lte: thirtyDaysAgo }
        });
        
        console.log(`Found ${archivedReports.length} reports to cleanup`);
        
        // Process each archived report
        for (const report of archivedReports) {
            console.log(`Processing report ${report.referenceNumber} (ID: ${report._id})`);
            
            // Delete attachments from Supabase
            if (report.attachments && report.attachments.length > 0) {
                await deleteAttachmentsFromSupabase(report.attachments);
            }
            
            // Optionally: You could also delete the report from MongoDB here
            // await Report.deleteOne({ _id: report._id });
            // console.log(`Deleted report ${report.referenceNumber} from database`);
        }
        
        console.log('Cleanup completed successfully');
    } catch (error) {
        console.error('Error during cleanup:', error.message);
    }
};

// Schedule the cleanup job to run daily at midnight
const scheduleCleanupJob = () => {
    console.log('Scheduling cleanup job to run daily at midnight...');
    
    cron.schedule('0 0 * * *', async () => {
        console.log('Running scheduled cleanup job...');
        await cleanupArchivedReports();
    }, {
        scheduled: true,
        timezone: 'UTC'
    });
};

// Main function
const main = async () => {
    await connectDB();
    scheduleCleanupJob();
    
    // Also run once immediately for testing
    // await cleanupArchivedReports();
};

// Run the main function
main();

module.exports = { cleanupArchivedReports };