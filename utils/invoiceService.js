const { exec } = require('child_process');
const path = require('path');
const { promisify } = require('util');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

const execAsync = promisify(exec);
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);

class InvoiceService {
    constructor() {
        this.pythonPath = process.env.PYTHON_PATH || 'python3';
        // Fallbacks for different environments (Railway, Docker, etc.)
        this.pythonCandidates = [
            process.env.PYTHON_PATH,
            'python3',
            'python',
            '/usr/bin/python3',
            '/usr/local/bin/python3'
        ].filter(Boolean);

        this.scriptPath = path.join(__dirname, '../invoice_generator/invoice_generator.py');
    }

    // In invoiceService.js, update the generateInvoice method
    async generateInvoice(orderData, companyData, customerData, invoiceNumber = null) {
        const tempFile = path.join(os.tmpdir(), `invoice_${uuidv4()}.json`);

        try {

            // Prepare the data to send to Python script
            const data = {
                order_data: {
                    ...orderData,
                    // Only include invoiceNumber if it's a valid format
                    invoiceNumber: (invoiceNumber && invoiceNumber.startsWith('INV-')) ? invoiceNumber : null
                },
                company_data: companyData
            };

            // Debug log the data being sent
            console.log('Data being sent to Python script:', JSON.stringify(data, null, 2));

            await writeFileAsync(tempFile, JSON.stringify(data), 'utf8');

            // TTry different Python executables until one works
            let stdout = '';
            let stderr = '';
            let lastError = null;

            for (const pythonCmd of this.pythonCandidates) {
                try {
                    const command = `"${pythonCmd}" "${this.scriptPath}" "${tempFile}"`;
                    const result = await execAsync(command, {
                        maxBuffer: 1024 * 1024 * 10,
                        encoding: 'utf8',
                        timeout: 60000
                    });
                    stdout = result.stdout;
                    stderr = result.stderr;
                    this.pythonPath = pythonCmd; // remember working one
                    break;
                } catch (err) {
                    lastError = err;
                    console.warn(`Python command failed with "${pythonCmd}": ${err.message}`);
                    continue;
                }
            }

            if (!stdout && lastError) {
                throw lastError;
            }

            console.log('Python stdout:', stdout);
            if (stderr) {
                console.error('Python stderr:', stderr);
            }

            if (!stdout) {
                throw new Error('Error generating invoice: ' + stderr);
            }

            // Parse the response
            let result;
            try {
                result = JSON.parse(stdout.trim());
            } catch (parseError) {
                console.error('Failed to parse Python output:', stdout);
                throw new Error('Invalid JSON response from Python script');
            }

            if (result.error) {
                throw new Error(`Python error: ${result.error} (${result.type || 'Unknown'})`);
            }

            if (!result.pdf_content) {
                throw new Error('No PDF content received from generator');
            }

            // Always use the invoice number from the Python script
            const finalInvoiceNumber = result.invoice_number;
            console.log('Final invoice number from Python:', finalInvoiceNumber);

            return {
                pdfBuffer: Buffer.from(result.pdf_content, 'base64'),
                invoiceNumber: finalInvoiceNumber,
                invoiceDate: result.invoice_date,
                total: result.total
            };
        } catch (error) {
            console.error('Error in generateInvoice:', error.message);
            console.error('Error stack:', error.stack);
            // Check if it's a spawn error (Python not found)
            if (error.code === 'ENOENT') {
                throw new Error('Python interpreter not found. Please check PYTHON_PATH environment variable.');
            }
            throw new Error(`Failed to generate invoice: ${error.message}`);
        } finally {
            // Clean up the temporary file
            try {
                await unlinkAsync(tempFile);
            } catch (cleanupError) {
                console.error('Error cleaning up temporary file:', cleanupError);
            }
        }
    }
}

module.exports = new InvoiceService();