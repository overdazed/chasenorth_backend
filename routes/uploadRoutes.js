const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

require('dotenv').config();

const router = express.Router();

// Cloudinary configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer configuration
// We are telling the multer to store the uploaded files directly in the RAM as buffer objects
// rather than saving them to the file system
const storage = multer.memoryStorage();
// Can be used as middleware to handle file uploads
const upload = multer({ storage });

router.post('/', upload.single('image'), async (req, res) => {
    try {
        // Check if the request contains a file
        if (!req.file) {
            // If no file is found
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Function to handle the stream upload to Cloudinary
        // function converts the file buffer into a readable stream and uploads it using cloudinaries upload stream API
        const streamUpload = (fileBuffer) => {
            return new Promise((resolve, reject) => {
                // uploader allows us to stream the file directly
                const stream = cloudinary.uploader.upload_stream((error, result) => {
                    // if the upload is successful
                    if (result) {
                        // resolve the promise with the result
                        resolve(result);
                    } else {
                        // if there is an error, reject the promise with the error
                        reject(error);
                    }
                });
                // Use streamifier to convert file buffer into a stream
                // pipe it to cloudinary
                streamifier.createReadStream(fileBuffer).pipe(stream);
            });
        };
        // Call the stream upload function to upload the file
        const result = await streamUpload(req.file.buffer);
        // If upload is successful, respond with the secure URL of the uploaded image
        res.json({imageUrl: result.secure_url});
    } catch (error) {
        console.error(error);
        res.status(500).json({message: 'Server Error'});
    }
})

module.exports = router


// add routes to server.js

// Create a new collection "Upload" > name it "Create" > POST > URL:http://localhost:9000/api/upload
// in Header the authorization will be Bearer > Token copy from Login request
// > Body > form-data > key: image > value: select image to upload > Send
// You should see the image URL in the response
// add sample data
// Add routes to server.js