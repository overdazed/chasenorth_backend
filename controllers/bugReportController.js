const nodemailer = require('nodemailer');
require('dotenv').config();

const sendBugReport = async (req, res) => {
    try {
        const { subject, description, email, pageUrl } = req.body;
        // const attachments = req.files?.attachments || [];
        const attachments = req.files || []; // Changed from req.files?.attachments

        // Log incoming request for debugging

        console.log('Request body:', { subject, description, email, pageUrl });
        console.log('Files received:', {
            count: attachments.length,
            files: attachments.map(f => ({
                originalname: f.originalname,
                mimetype: f.mimetype,
                size: f.size,
                buffer: f.buffer ? `Buffer(${f.buffer.length} bytes)` : 'No buffer'
            }))
        });

        // Validate required fields
        if (!subject || !description || !email) {
            console.log('Missing required fields:', { subject, email, hasDescription: !!description });
            return res.status(400).json({
                success: false,
                message: 'Please provide subject, description, and email'
            });
        }

        // Check if required environment variables are set
        const requiredEnvVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SUPPORT_EMAIL', 'SUPPORT_PASS', 'SYSTEM_EMAIL'];
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

        if (missingVars.length > 0) {
            console.error('Missing required environment variables:', missingVars);
            return res.status(500).json({
                success: false,
                message: 'Server configuration error',
                error: 'Missing required environment variables'
            });
        }

        // Configure nodemailer transporter
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT, 10),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SYSTEM_EMAIL,
                pass: process.env.SYSTEM_PASS
            }
        });

        // Format attachments for email
        const emailAttachments = attachments.map((file, index) => {
            return {
                filename: file.originalname,
                content: file.buffer,
                contentType: file.mimetype,
                cid: `image${index}@bugreport`  // Add @bugreport to make it a valid Content-ID
            };
        });

        // Email options
        const mailOptions = {
            from: `"ChaseNorth Support" <${process.env.SYSTEM_EMAIL}>`,
            to: process.env.SUPPORT_EMAIL,
            replyTo: email,
            subject: `[Bug Report] ${subject}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #333;">New Bug Report</h2>
                  <p><strong>From:</strong> ${email}</p>
                  <p><strong>Page URL:</strong> <a href="${pageUrl}">${pageUrl}</a></p>
                  <div style="margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 5px;">
                    ${description}
                  </div>
                  ${emailAttachments.length > 0 ? `
                    <div style="margin-top: 20px;">
                      <h3 style="color: #333; margin-bottom: 10px;">Attached Screenshots (${emailAttachments.length})</h3>
                      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-top: 10px;">
                        ${emailAttachments.map((file, index) => `
                          <div style="border: 1px solid #ddd; padding: 5px; border-radius: 4px; text-align: center;">
                            <img src="cid:image${index}@bugreport" style="max-width: 100%; height: auto; border-radius: 3px;" alt="Screenshot ${index + 1}">
                            <p style="margin: 5px 0 0; font-size: 12px; color: #666;">Screenshot ${index + 1}</p>
                          </div>
                        `).join('')}
                      </div>
                    </div>
                  ` : ''}
                  <p style="margin-top: 30px; font-size: 12px; color: #999;">
                    This is an automated message. Please do not reply directly to this email.
                  </p>
                </div>
              `,
            attachments: emailAttachments
        };

        // Send email
        await transporter.sendMail(mailOptions);
        console.log('Bug report email sent successfully');

        res.status(200).json({
            success: true,
            message: 'Bug report submitted successfully!',
            // data: {
            //     reference: `BUG-${Date.now()}`,
            //     email: email
            // }
        });

    } catch (error) {
        console.error('Error in sendBugReport:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit bug report',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    sendBugReport
};
