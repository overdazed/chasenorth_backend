const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs').promises;
const { promisify } = require('util');
const { compile } = require('handlebars');

console.log('SMTP Config:', {
    host: process.env.SMTP_HOST || 'smtp.hostinger.com',
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE,
    user: process.env.SYSTEM_EMAIL
});

// Create a transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.hostinger.com',
    port:  process.env.SMTP_PORT,
    secure: true,
    auth: {
        user: process.env.SYSTEM_EMAIL,
        pass: process.env.SYSTEM_PASS
    },
    debug: true, // Enable debug output
    logger: true // Log to console
});

// Compile email template
const compileTemplate = async (templateName, data) => {
    try {
        const templatePath = path.join(__dirname, '../templates', `${templateName}.html`);
        const source = await fs.readFile(templatePath, 'utf-8');
        const template = compile(source);
        return template(data);
    } catch (error) {
        console.error('Error compiling email template:', error);
        throw error;
    }
};

// Send email function
const sendReportConfirmation = async (emailData) => {
    try {
        if (!emailData.to) {
            console.error('No recipient email provided');
            throw new Error('No recipient email provided');
        }

        // Compile the email template with the provided data
        const html = await compileTemplate('reportEmail', {
            referenceNumber: emailData.referenceNumber || 'N/A',
            orderId: emailData.orderId,
            problemType: emailData.problemType,
            details: emailData.details,
            desiredOutcome: emailData.desiredOutcome
        });

        // Send confirmation email to customer
        const customerEmail = {
            from: `"ChaseNorth Support" <${process.env.SYSTEM_EMAIL}>`,
            to: emailData.to,
            subject: `Your Report Has Been Submitted - Reference #${emailData.referenceNumber || 'Pending'}`,
            html: html,
            text: `Your report has been submitted successfully.\n\nReference Number: ${emailData.referenceNumber || 'Pending'}\nOrder ID: ${emailData.orderId}\nProblem Type: ${emailData.problemType}\n\nWe'll get back to you soon.`
        };

        // Prepare support email with all report details
        const supportEmail = {
            from: `"ChaseNorth Support" <${process.env.SYSTEM_EMAIL}>`,
            to: 'support@chasenorth.com',
            subject: `New Report Submitted - #${emailData.referenceNumber || 'Pending'}`,
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
                    <h2>New Report Submitted</h2>
                    <p><strong>Reference Number:</strong> ${emailData.referenceNumber || 'Pending'}</p>
                    <p><strong>Order ID:</strong> ${emailData.orderId || 'N/A'}</p>
                    <p><strong>Problem Type:</strong> ${emailData.problemType || 'N/A'}</p>
                    <p><strong>Details:</strong><br>${emailData.details || 'N/A'}</p>
                    <p><strong>Desired Outcome:</strong> ${emailData.desiredOutcome || 'N/A'}</p>
                    <p><strong>Contact Email:</strong> ${emailData.to || 'N/A'}</p>
                    ${emailData.attachments && emailData.attachments.length > 0 ? 
                        `<p><strong>Attachments (${emailData.attachments.length}):</strong><br>` + 
                        emailData.attachments.map(file => 
                            `<a href="${file.url || file.path}" target="_blank">${file.filename || 'Attachment'}</a>`
                        ).join('<br>') + '</p>' : 
                        '<p>No attachments included.</p>'
                    }
                </div>
            `,
            text: `New Report Submitted

Reference Number: ${emailData.referenceNumber || 'Pending'}
Order ID: ${emailData.orderId || 'N/A'}
Problem Type: ${emailData.problemType || 'N/A'}

Details:
${emailData.details || 'N/A'}

Desired Outcome: ${emailData.desiredOutcome || 'N/A'}
Contact Email: ${emailData.to || 'N/A'}

${emailData.attachments && emailData.attachments.length > 0 ? 
    `Attachments (${emailData.attachments.length}):\n` + 
    emailData.attachments.map(file => 
        `- ${file.filename || 'Attachment'}: ${file.url || file.path}`
    ).join('\n') : 
    'No attachments included.'
}`
        };

        // Send both emails
        const [customerInfo, supportInfo] = await Promise.all([
            transporter.sendMail(customerEmail),
            transporter.sendMail(supportEmail)
        ]);

        console.log('Confirmation email sent:', customerInfo.messageId);
        console.log('Support notification sent:', supportInfo.messageId);
        return { customerInfo, supportInfo };
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};

const sendEmailVerification = async (email, verificationLink) => {
    try {
        const html = await compileTemplate('emailVerification', {
            verificationLink: verificationLink,
            email: email
        });

        const emailOptions = {
            from: `"ChaseNorth Support" <${process.env.SYSTEM_EMAIL}>`,
            to: email,
            subject: 'Verify Your New Email Address',
            html: html,
            text: `Please verify your new email address by clicking the following link: ${verificationLink}`
        };

        const info = await transporter.sendMail(emailOptions);
        console.log('Email verification sent:', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending verification email:', error);
        throw error;
    }
};

module.exports = {
    sendReportConfirmation,
    sendEmailVerification
};
