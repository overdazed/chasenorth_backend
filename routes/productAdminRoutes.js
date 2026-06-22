// import express
const express = require("express");
// import the product model
const Product = require("../models/Product");
// import the protect middleware
const { protect, admin } = require("../middleware/authMiddleware");
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage: storage });

// initialize router
const router = express.Router();

// Get all unique categories from existing products
// @route GET /api/admin/products/categories
// @desc Get unique categories (Admin only)
// @access Private/Admin
router.get("/categories", protect, admin, async (req, res) => {
    try {
        const categories = await Product.distinct('category');
        res.json(categories.filter(Boolean).sort());
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error" });
    }
});

// Get all unique collections from existing products
// @route GET /api/admin/products/collections
// @desc Get unique collections (Admin only)
// @access Private/Admin
router.get("/collections", protect, admin, async (req, res) => {
    try {
        const collections = await Product.distinct('collections');
        res.json(collections.filter(Boolean).sort());
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error" });
    }
});

// Get all unique brands from existing products
// @route GET /api/admin/products/brands
// @desc Get unique brands (Admin only)
// @access Private/Admin
router.get("/brands", protect, admin, async (req, res) => {
    try {
        const brands = await Product.distinct('brand');
        res.json(brands.filter(Boolean).sort());
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error" });
    }
});

// Get all unique tags from existing products
// @route GET /api/admin/products/tags
// @desc Get unique tags (Admin only)
// @access Private/Admin
router.get("/tags", protect, admin, async (req, res) => {
    try {
        const tags = await Product.distinct('tags');
        res.json(tags.filter(Boolean).sort());
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error" });
    }
});

// Create a route to retrieve a list of all products in the system
// @route GET /api/admin/products
// @desc Get all products (Admin only)
// @access Private/Admin, only admin can get all products
router.get("/", protect, admin, async (req, res) => {
    try {
        // Fetch all products found in the database
        const products = await Product.find({});
        // send a list of products back in response
        res.json(products);
    } catch (error) {
        console.error(error);
        res.status(500).json({message: "Server Error"});
    }
});

// Add this route before module.exports
router.post(
    '/',
    protect,
    admin,
    async (req, res) => {
        try {
            const {
                name,
                description,
                price,
                discountPrice,
                countInStock,
                category,
                brand,
                collections,
                sizes,
                colors,
                material,
                gender,
                user,
                isFeatured,
                isPublished,
                images,
                tags
            } = req.body;
            
            // Ensure sizes, colors, and tags are arrays or convert from comma-separated strings
            const sizesArray = Array.isArray(sizes) ? sizes : (sizes ? sizes.split(',').map(s => s.trim()) : []);
            const colorsArray = Array.isArray(colors) ? colors : (colors ? colors.split(',').map(c => c.trim()) : []);
            const tagsArray = Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : []);
            
            // Generate SKU automatically
            const generateSKU = async (productName) => {
                const Counter = require('../models/Counter');
                  
                // Find and update the counter
                const counter = await Counter.findByIdAndUpdate(
                    { _id: 'skuCounter' },
                    { $inc: { seq: 1 } },
                    { new: true, upsert: true }
                );
                  
                const seq = counter.seq;
                  
                const words = productName.split(' ');
                const firstWord = words[0] || '';
                const secondWord = words[1] || '';
                  
                // Extract 4 random characters from the first word
                const firstPart = firstWord.length >= 4 ? firstWord.substring(0, 4).toUpperCase() : firstWord.toUpperCase();
                  
                // Generate the SKU with the counter, removing the second part if the product name is a single word
                const sku = words.length === 1 ? `${firstPart}-${seq.toString().padStart(3, '0')}` : `${firstPart}-${secondWord.substring(0, 3).toUpperCase()}-${seq.toString().padStart(3, '0')}`;
                return sku;
            };

            const sku = await generateSKU(name);

            const product = new Product({
                name,
                description,
                price: Number(price),
                discountPrice: Number(discountPrice),
                countInStock: Number(countInStock),
                sku,
                category,
                brand,
                collections,
                sizes: sizesArray,
                colors: colorsArray,
                tags: tagsArray,
                material: Array.isArray(material) ? material : (material ? material.split(',').map(m => m.trim()) : []),
                gender: gender || 'Unisex',
                images: images || [],
                user,
                isFeatured: isFeatured === 'true',
                isPublished: isPublished === 'true',
                sizeChartData: req.body.sizeChartData || []
            });

            const createdProduct = await product.save();
            res.status(201).json(createdProduct);
        } catch (error) {
            console.error(error);
            res.status(400).json({
                message: 'Product validation failed',
                error: error.message,
                details: error.errors
            });
        }
    }
);

// export the router
module.exports = router;

// include the following routes in server.js

// Create a new collection "Admin Product" > name it "Products" > GET > URL:http://localhost:9000/api/admin/products
// Authorisation > Bearer > Token copy from Admin Login request
// You can see a 200 status code and all products as Array