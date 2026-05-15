import os
import json
import base64
import uuid
import sys
from datetime import datetime
from jinja2 import Environment, FileSystemLoader
from xhtml2pdf import pisa
from dateutil.relativedelta import relativedelta
import traceback
import sys
import random
import pymongo
from pymongo import MongoClient

# Add this class variable at the top of the InvoiceGenerator class
class InvoiceGenerator:
    _invoice_counter = 0
    _last_date = None

    def __init__(self, output_dir='invoices', mongo_uri=None):
        self.env = Environment(loader=FileSystemLoader(os.path.join(os.path.dirname(__file__), 'templates')))
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
        
        # Initialize MongoDB connection if URI is provided
        self.mongo_client = None
        self.mongo_db = None
        if mongo_uri:
            try:
                self.mongo_client = MongoClient(mongo_uri)
                self.mongo_db = self.mongo_client.get_database()
                sys.stderr.write("Connected to MongoDB for counter storage\n")
            except Exception as e:
                sys.stderr.write(f"Failed to connect to MongoDB: {str(e)}\n")
                sys.stderr.write("Falling back to file-based counter storage\n")
        
        # If MongoDB is not available, use file-based storage
        if self.mongo_db is None:
            self.counter_file = os.path.join(os.path.dirname(__file__), '.invoice_counter')
        
        self._load_counter()

    def _load_counter(self):
        try:
            if self.mongo_db is not None:
                # Try to get counter from MongoDB
                counters = self.mongo_db['counters']
                counter_doc = counters.find_one({'_id': 'invoice_counter'})
                if counter_doc:
                    self._invoice_counter = counter_doc.get('seq', 0)
                    self._last_date = counter_doc.get('last_date', '')
                else:
                    self._invoice_counter = 0
                    self._last_date = None
            else:
                # Fallback to file-based storage
                if os.path.exists(self.counter_file):
                    with open(self.counter_file, 'r') as f:
                        data = json.load(f)
                        self._invoice_counter = data.get('counter', 0)
                        self._last_date = data.get('last_date', '')
                else:
                    self._invoice_counter = 0
                    self._last_date = None
        except Exception as e:
            sys.stderr.write(f"Error loading counter: {str(e)}\n")
            self._invoice_counter = 0
            self._last_date = None

    def _save_counter(self):
        try:
            if self.mongo_db is not None:
                # Save counter to MongoDB
                counters = self.mongo_db['counters']
                counters.update_one(
                    {'_id': 'invoice_counter'},
                    {'$set': {
                        'seq': self._invoice_counter,
                        'last_date': self._last_date
                    }},
                    upsert=True
                )
            else:
                # Fallback to file-based storage
                with open(self.counter_file, 'w') as f:
                    json.dump({
                        'counter': self._invoice_counter,
                        'last_date': self._last_date
                    }, f)
        except Exception as e:
            sys.stderr.write(f"Error saving counter: {str(e)}\n")

    def generate_invoice_number(self, existing_number=None):
        # Debug logging
        sys.stderr.write("=== Invoice Number Debug ===\n")
        sys.stderr.write(f"Existing number received: {existing_number}\n")
        sys.stderr.write(f"Type of existing_number: {type(existing_number)}\n")

        # Check if the existing number matches the correct format: INV-YYYYMMDD-XXXXX
        import re
        if existing_number and isinstance(existing_number, str):
            if re.match(r'^INV-\d{8}-\d{5}$', existing_number):
                sys.stderr.write("Using existing valid invoice number\n")
                return existing_number
            else:
                sys.stderr.write(f"Existing invoice number has invalid format: {existing_number}\n")

        # If we get here, either no existing number or it's invalid, so generate a new one
        # Get current date in YYYYMMDD format
        date_str = datetime.now().strftime('%Y%m%d')
        sys.stderr.write(f"Generated date string: {date_str}\n")

        # Check if date has changed, reset counter if needed
        if self._last_date != date_str:
            self._invoice_counter = 0
            self._last_date = date_str
            sys.stderr.write(f"Date changed, resetting counter to: {self._invoice_counter}\n")
        
        # Increment counter and format as 5-digit number
        self._invoice_counter += 1
        unique_id = f"{self._invoice_counter:05d}"
        new_number = f"INV-{date_str}-{unique_id}"

        # Save the updated counter
        self._save_counter()

        sys.stderr.write(f"Generated new invoice number: {new_number}\n")
        sys.stderr.write("===========================\n")
        return new_number

    def format_date(self, value, format='%B %d, %Y'):
        if isinstance(value, str):
            try:
                value = datetime.fromisoformat(value.replace('Z', '+00:00'))
            except (ValueError, AttributeError):
                return value
        elif value is None:
            return 'N/A'
        return value.strftime(format)

    def generate_invoice(self, order, company_data):
        try:
            # Add format_date filter to the environment
            self.env.filters['format_date'] = self.format_date

            # Debug logging
            sys.stderr.write("=== Invoice Generation Started ===\n")
            sys.stderr.write(f"Order data: {json.dumps(order, indent=2)}\n")

            # Get existing invoice number if it exists
            existing_invoice_number = order.get('invoiceNumber')
            sys.stderr.write(f"Existing invoice number from order: {existing_invoice_number}\n")

            # Generate invoice number (this will use existing one if valid)
            invoice_number = self.generate_invoice_number(existing_invoice_number)
            sys.stderr.write(f"Generated invoice number: {invoice_number}\n")

            # Ensure order is a dictionary
            if not isinstance(order, dict):
                order = order.to_dict() if hasattr(order, 'to_dict') else dict(order)

            # Ensure shipping address exists
            if 'shippingAddress' not in order:
                order['shippingAddress'] = {}
            
            # Add taxRate from company_data if not present
            if 'taxRate' not in order and 'tax_rate' in company_data:
                order['taxRate'] = company_data['tax_rate']
            elif 'taxRate' not in order:
                order['taxRate'] = 0
            
            # Ensure tax field is present for the template
            if 'tax' not in order:
                tax_rate = order.get('taxRate', 0) / 100
                subtotal = sum(item.get('price', 0) * item.get('quantity', 0) for item in order.get('orderItems', order.get('items', [])))
                order['tax'] = subtotal * tax_rate
            
            # Ensure total is present
            if 'total' not in order and 'totalPrice' not in order:
                subtotal = sum(item.get('price', 0) * item.get('quantity', 0) for item in order.get('orderItems', order.get('items', [])))
                tax = order.get('tax', 0)
                shipping = order.get('shippingCost', 0) + order.get('shippingPrice', 0)
                order['total'] = subtotal + tax + shipping
                order['totalPrice'] = order['total']
            
            # Update shipping address with default values if needed
            order['shippingAddress'].update({
                'firstName': order['shippingAddress'].get('firstName', '') or '',
                'lastName': order['shippingAddress'].get('lastName', '') or '',
                'company': order['shippingAddress'].get('company', '') or '',
                'address': order['shippingAddress'].get('address', '') or '',
                'address2': order['shippingAddress'].get('address2', '') or '',
                'city': order['shippingAddress'].get('city', '') or '',
                'postalCode': order['shippingAddress'].get('postalCode', '') or order['shippingAddress'].get('postal_code', ''),
                'state': order['shippingAddress'].get('state', '') or '',
                'country': order['shippingAddress'].get('country', '') or ''
            })

            # Ensure orderItems exists
            if 'orderItems' not in order and 'items' in order:
                order['orderItems'] = order['items']

            # Prepare context for template
            context = {
                'order': {
                    **order,
                    'total': order.get('totalPrice', 0)
                },
                'company_name': company_data.get('name', ''),
                'company_contact_name': company_data.get('contact_name', ''),
                'company_vat': company_data.get('vat', ''),
                'company_address': company_data.get('address', ''),
                'company_city': company_data.get('city', ''),
                'company_zip': company_data.get('zip', ''),
                'company_country': company_data.get('country', ''),
                'company_email': company_data.get('email', ''),
                'company_phone': company_data.get('phone', ''),
                'company_website': company_data.get('website', ''),
                'invoice_number': invoice_number,
                'invoice_date': datetime.now().strftime('%B %d, %Y'),
                'due_date': (datetime.now() + relativedelta(days=30)).strftime('%B %d, %Y'),
                'total': order.get('totalPrice', 0)
            }

            # Debug logging
            sys.stderr.write("=== Context for template ===\n")
            sys.stderr.write(f"Invoice number in context: {context['invoice_number']}\n")
            sys.stderr.write("============================\n")

            # Generate PDF
            template = self.env.get_template('invoice_template.html')
            html_content = template.render(**context)

            # Generate PDF filename
            pdf_filename = f"invoice_{invoice_number}.pdf".replace(" ", "_")
            pdf_path = os.path.join(self.output_dir, pdf_filename)

            # Create PDF from HTML
            with open(pdf_path, 'wb') as output_file:
                pisa_status = pisa.CreatePDF(
                    html_content,
                    dest=output_file,
                    encoding='UTF-8'
                )

            if pisa_status.err:
                raise Exception(f'Error generating PDF: {pisa_status.err}')

            # Read the generated PDF and encode as base64
            with open(pdf_path, 'rb') as pdf_file:
                pdf_content = pdf_file.read()

            # Clean up the PDF file
            try:
                os.remove(pdf_path)
            except:
                pass

            # Return result as a dictionary
            result = {
                'pdf_content': base64.b64encode(pdf_content).decode('utf-8'),
                'invoice_number': invoice_number,
                'invoice_date': context['invoice_date'],
                'total': context['total']
            }

            return json.dumps(result)

        except Exception as e:
            error_msg = {
                'error': str(e),
                'type': type(e).__name__,
                'traceback': traceback.format_exc()
            }
            sys.stderr.write(f"Error in generate_invoice: {json.dumps(error_msg, indent=2)}\n")
            return json.dumps(error_msg)
#     def generate_invoice(self, order, company_data):
#         try:
#             # Add format_date filter to the environment
#             self.env.filters['format_date'] = self.format_date
#
#             # Ensure order has required fields
#             if not isinstance(order, dict):
#                 raise ValueError("Order must be a dictionary")
#
#             # Prepare order items
#             order_items = order.get('items', [])
#             if not order_items and 'orderItems' in order:
#                 order_items = order['orderItems']
#                 order['items'] = order_items
#
#             # Calculate totals if not provided
#             if 'totalPrice' not in order:
#                 subtotal = sum(item.get('price', 0) * item.get('quantity', 0) for item in order_items)
#                 tax_rate = company_data.get('tax_rate', 0) / 100
#                 tax = subtotal * tax_rate
#                 order['totalPrice'] = subtotal + tax
#
#             # Prepare context for template
#             context = {
#                 'order': order,
#                 'company_name': company_data.get('name', ''),
#                 'company_address': company_data.get('address', ''),
#                 'company_city': company_data.get('city', ''),
#                 'company_zip': company_data.get('zip', ''),
#                 'company_country': company_data.get('country', ''),
#                 'company_email': company_data.get('email', ''),
#                 'company_phone': company_data.get('phone', ''),
#                 'company_website': company_data.get('website', ''),
#                 'invoice_number': self.generate_invoice_number(),
#                 'invoice_date': datetime.now().strftime('%B %d, %Y'),
#                 'due_date': (datetime.now() + relativedelta(days=30)).strftime('%B %d, %Y'),
#                 'total': order.get('totalPrice', 0)
#             }
#
#             # Render the template
#             template = self.env.get_template('invoice_template.html')
#             html_content = template.render(**context)
#
#             # Generate PDF
#             pdf_filename = f"invoice_{context['invoice_number']}.pdf".replace(" ", "_")
#             pdf_path = os.path.join(self.output_dir, pdf_filename)
#
#             # Create PDF from HTML
#             with open(pdf_path, 'wb') as output_file:
#                 pisa_status = pisa.CreatePDF(
#                     html_content,
#                     dest=output_file,
#                     encoding='UTF-8'
#                 )
#
#             if pisa_status.err:
#                 raise Exception(f'Error generating PDF: {pisa_status.err}')
#
#             # Read the generated PDF and encode as base64
#             with open(pdf_path, 'rb') as pdf_file:
#                 pdf_content = pdf_file.read()
#
#             # Clean up the PDF file
#             try:
#                 os.remove(pdf_path)
#             except:
#                 pass
#
#             # Return result as a dictionary
#             result = {
#                 'pdf_content': base64.b64encode(pdf_content).decode('utf-8'),
#                 'invoice_number': context['invoice_number'],
#                 'invoice_date': context['invoice_date'],
#                 'total': context['total']
#             }
#
#             return json.dumps(result)
#
#         except Exception as e:
#             return json.dumps({
#                 'error': str(e),
#                 'type': type(e).__name__
#             })


def read_input_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        return {
            'error': f'Failed to read input file: {str(e)}',
            'type': type(e).__name__
        }

def main():
    try:
        if len(sys.argv) > 1:
            try:
                # Read input from file
                input_file = sys.argv[1]
                if not os.path.exists(input_file):
                    raise FileNotFoundError(f"Input file not found: {input_file}")

                # Read and parse the input data
                data = read_input_file(input_file)
                if 'error' in data:
                    print(json.dumps(data))
                    sys.exit(1)

                order_data = data.get('order_data', {})
                company_data = data.get('company_data', {})

                # Create the invoice generator
                invoice_gen = InvoiceGenerator()

                # Generate the invoice and print the result
                result = invoice_gen.generate_invoice(order_data, company_data)
                print(result)

            except Exception as e:
                error_msg = {
                    'error': str(e),
                    'type': type(e).__name__
                }
                print(json.dumps(error_msg))
                sys.exit(1)
        else:
            # Test with sample data if no arguments provided
            invoice_gen = InvoiceGenerator()
            company_data = {
                'name': 'Adventure Store',
                'address': '123 Adventure St',
                'city': 'Adventure City',
                'zip': '12345',
                'country': 'Adventureland',
                'email': 'billing@adventurestore.com',
                'phone': '+1 (555) 123-4567',
                'website': 'www.adventurestore.com',
                'tax_rate': 15.0
            }
            order = {
                '_id': 'test_' + str(uuid.uuid4()),
                'createdAt': datetime.now().isoformat(),
                'status': 'Processing',
                'paymentMethod': 'credit_card',
                'isPaid': True,
                'paidAt': datetime.now().isoformat(),
                'totalPrice': 429.97,
                'orderItems': [
                    {
                        'name': 'Test Item',
                        'price': 99.99,
                        'quantity': 2,
                        'size': 'M',
                        'color': 'Blue'
                    }
                ],
                'shippingAddress': {
                    'address': '123 Test St',
                    'city': 'Test City',
                    'postalCode': '12345',
                    'country': 'Testland'
                }
            }
            result = invoice_gen.generate_invoice(order, company_data)
            print(result)

    except Exception as e:
        print(json.dumps({
            'error': str(e),
            'type': type(e).__name__
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()