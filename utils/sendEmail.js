// utils/sendEmail.js
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY, { region: 'eu-west-1' });

const sendEmail = async (options) => {
    if (!options.email) {
        throw new Error('No recipient email provided');
    }

    const attachments = options.attachments && options.attachments.length > 0
        ? options.attachments.map(file => ({
            filename: file.originalname,
            content: file.buffer
        }))
        : undefined;

    await resend.emails.send({
        from: `ChaseNorth Support <${process.env.SYSTEM_EMAIL}>`,
        to: options.email,
        subject: options.subject,
        text: options.message,
        html: options.html,
        attachments
    });
};

module.exports = sendEmail;