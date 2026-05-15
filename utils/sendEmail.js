// utils/sendEmail.js
const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // 1) Create a transporter
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

    // 2) Define the email options
    const mailOptions = {
        from: `"ChaseNorth Support" <${process.env.SYSTEM_EMAIL}>`,
        to: options.email,
        subject: options.subject,
        text: options.message,
        html: options.html
        // html: options.html // you can also send HTML emails
    };

    // Add attachments if they exist
    if (options.attachments && options.attachments.length > 0) {
        mailOptions.attachments = options.attachments.map(file => ({
            filename: file.originalname,
            content: file.buffer
        }));
    }

    // 3) Actually send the email
    await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;