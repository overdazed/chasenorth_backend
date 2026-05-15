const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const invoiceService = require('./invoiceService');
const { supabase } = require('../services/supabaseClient');

// Ensure invoices directory exists
// const INVOICES_DIR = path.join(__dirname, '../invoices');
//
// async function ensureInvoicesDir() {
//   try {
//     await fs.mkdir(INVOICES_DIR, { recursive: true });
//   } catch (error) {
//     if (error.code !== 'EEXIST') {
//       throw error;
//     }
//   }
// }
//
// async function saveInvoice(pdfBuffer, orderId) {
//   await ensureInvoicesDir();
//   const fileName = `invoice_${orderId}.pdf`;
//   const filePath = path.join(INVOICES_DIR, fileName);
//
//   try {
//     await fs.writeFile(filePath, pdfBuffer);
//     return filePath;
//   } catch (error) {
//     console.error('Error saving invoice:', error);
//     throw new Error('Failed to save invoice');
//   }
// }

async function uploadToSupabase(pdfBuffer, invoiceNumber) {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const fileName = `invoice_${invoiceNumber}.pdf`;
  const filePath = `invoices/${year}/${month}/${fileName}`;

  try {
    const { error } = await supabase.storage
        .from('invoices')
        .upload(filePath, pdfBuffer, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'application/pdf'
        });

    if (error) {
      if (error.message.includes('The resource already exists')) {
        console.log('Invoice already exists in storage, using existing file');
        return getPublicUrl(filePath);
      }
      throw error;
    }

    return getPublicUrl(filePath);
  } catch (error) {
    console.error('Error uploading to Supabase:', error);
    throw new Error(`Failed to upload invoice to Supabase: ${error.message}`);
  }
}

function getPublicUrl(filePath) {
  const { data: { publicUrl } } = supabase.storage
      .from('invoices')
      .getPublicUrl(filePath);
  return publicUrl;
}

// async function generateAndSaveInvoice(order, companyData, customerData, supabaseClient) {
//   try {
//     // Check if the order already has an invoice number
//     const existingInvoiceNumber = order.invoiceNumber;
//
//     const { pdfBuffer, invoiceNumber } = await invoiceService.generateInvoice(
//         order,
//         companyData,
//         customerData,
//         existingInvoiceNumber // Pass the existing invoice number
//     );
//
//     // If there was no existing invoice number, use the one generated
//     const finalInvoiceNumber = existingInvoiceNumber || invoiceNumber;
//
//     // Upload to Supabase with the correct invoice number
//     const publicUrl = await uploadToSupabase(pdfBuffer, finalInvoiceNumber);
//
//     return {
//       invoiceNumber: finalInvoiceNumber,
//       invoicePath: publicUrl
//     };
//   } catch (error) {
//     console.error('Error in generateAndSaveInvoice:', error);
//     throw error;
//   }
// }

async function generateAndSaveInvoice(order, companyData, customerData) {
  try {
    // Check if the order already has an invoice number
    const existingInvoiceNumber = order.invoiceNumber;
    
    // Generate the invoice with the existing invoice number if it exists
    const { pdfBuffer, invoiceNumber } = await invoiceService.generateInvoice(
        order,
        companyData,
        customerData,
        existingInvoiceNumber // Pass the existing invoice number to the service
    );

    // Use the invoice number from the response, or fall back to the existing one
    const finalInvoiceNumber = invoiceNumber || existingInvoiceNumber;
    
    if (!finalInvoiceNumber) {
      throw new Error('Failed to generate invoice number');
    }

    // Upload to Supabase with the final invoice number
    const publicUrl = await uploadToSupabase(pdfBuffer, finalInvoiceNumber);

    return {
      invoiceNumber: finalInvoiceNumber,
      invoicePath: publicUrl
    };
  } catch (error) {
    console.error('Error in generateAndSaveInvoice:', error);
    throw error;
  }
}

module.exports = {
  // saveInvoice,
  generateAndSaveInvoice,
};
