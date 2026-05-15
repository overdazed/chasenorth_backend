// import the required libraries
const express = require('express');
const Product = require('../models/Product');
const { protect, admin } = require('../middleware/authMiddleware');

const router = express.Router();

// @route POST /api/products
// @desc Create a new product in the database
// @access Private/Admin, only admin can create a new product
router.post('/', protect, admin, async (req, res) => {
    try {
        // 1. destruct the product details from the request body
        const {
            name,
            description,
            price,
            discountPrice,
            countInStock,
            category,
            brand,
            sizes,
            colors,
            collections,
            material,
            gender,
            images,
            isFeatured,
            isPublished,
            tags,
            dimensions,
            weight,
            sku
        } = req.body;

        // create a new product instance with the provided data
        const product = new Product({
            name,
            description,
            price,
            discountPrice,
            countInStock,
            category,
            brand,
            sizes,
            colors,
            collections,
            material,
            gender,
            images,
            isFeatured,
            isPublished,
            tags,
            dimensions,
            weight,
            sku,
            user: req.user._id // Reference to the admin user who created the product
        });

        // save the product to the database
        const createdProduct = await product.save();
        res.status(201).json(createdProduct);
    } catch (error) {
        console.error(error);
        res.status(500).send(("Server Error"));
        // create a new collection "Products" > name it "Create" > POST > URL:http://localhost:9000/api/products > Body > raw
        // add sample data
        // in Header the authorization will be Bearer > Token copy from Login request
        // Add routes to server.js

        // We do not want a customer to create a product
        // Add a middleware to check for the admin user before creating the product
    }
});

// How to update a product
// @route PUT /api/products/:id
// @desc Update an existing product by its ID
// @access Private/Admin, only admin can update a product
router.put('/:id', protect, admin, async (req, res) => {
    try {
        // copy product details from the request body
        const {
            name,
            description,
            price,
            discountPrice,
            countInStock,
            category,
            brand,
            sizes,
            colors,
            collections,
            material,
            gender,
            images,
            isFeatured,
            isPublished,
            tags,
            dimensions,
            weight,
            sku
        } = req.body;

        // find the product by its ID provided in the URL
        const product = await Product.findById(req.params.id);

        // if you are able to find the product
        if (product) {
            // update the product fields
            // If the values passed in the request, then we will update with the new value or written the old value if its not provided
            product.name = name || product.name;
            product.description = description || product.description;
            product.price = price || product.price;
            product.discountPrice = discountPrice || product.discountPrice;
            product.countInStock = countInStock || product.countInStock;
            product.category = category || product.category;
            product.brand = brand || product.brand;
            product.sizes = sizes || product.sizes;
            product.colors = colors || product.colors;
            product.collections = collections || product.collections;
            product.material = material || product.material;
            product.gender = gender || product.gender;
            product.images = images || product.images;
            // isFeatured it Boolean, check if it's not undefined
            product.isFeatured =
                isFeatured !== undefined ? isFeatured : product.isFeatured;
            product.isPublished =
                isPublished !== undefined ? isPublished : product.isPublished;
            product.tags = tags || product.tags;
            product.dimensions = dimensions || product.dimensions;
            product.weight = weight || product.weight;
            product.sku = sku || product.sku;

            // save the updated product to the database
            const updatedProduct = await product.save();
            res.json(updatedProduct);
        } else {
            res.status(404).json({ message: "Product not found" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
        // new request > Update > PUT > URL:http://localhost:9000/api/products/:id
    }
})

// Delete a product
// @route DELETE /api/products/:id
// @desc Delete a product by its ID
// @access Private/Admin, only admin can delete a product
router.delete('/:id', protect, admin, async (req, res) => {
    try {
        // find the product by its ID provided in the URL
        const product = await Product.findById(req.params.id);

        // if you are able to find the product
        if (product) {
            // delete the product from the database
            await product.deleteOne();
            res.json({ message: "Product removed" });
        } else {
            res.status(404).json({ message: "Product not found" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
        // new request > Delete > DELETE > URL:http://localhost:9000/api/products/:id
    }
})

// Before we proceed further to display all the products, let's first populate the data
// https://github.com/kushald/rabbit-assets

// @route GET /api/products
// @desc Get all products with optional query and filters
// @access Public
router.get('/', async (req, res) => {
    try {
        // extract the query parameters from the request
        // This will be the options that the user will select to filter the products
        const {
            collection,
            size,
            color,
            gender,
            minPrice,
            maxPrice,
            sortBy,
            search,
            category,
            material,
            brand,
            limit,
            sizes,
            colors
        } = req.query;

        // initialize a query object
        let query = {};

        // Filter logic based on the query parameters
        // We only add the collection to the query, if a specific collection is requested in the URL
        // It should not be a default all value
        if (collection && collection.toLocaleLowerCase() !== "all")  {
            query.collections = collection;
        }

        if (category && category.toLocaleLowerCase() !== "all")  {
            query.category = category;
        }

        if (material)  {
            // Convert material to array if it's a string
            const materialArray = Array.isArray(material) ? material : material.split(",");
            
            // Create a case-insensitive regex pattern for each material
            query.$or = query.$or || [];
            materialArray.forEach(m => {
                const trimmedMaterial = m.trim();
                if (trimmedMaterial) {
                    query.$or.push({ material: { $regex: trimmedMaterial, $options: 'i' } });
                }
            });
        }

        if (brand)  {
            // we are using $in operator, because we can have multiple materials selected in the filter
            query.brand = {$in: brand.split(",")};
        }

        if (size)  {
            // we are using $in operator, because we can have multiple materials selected in the filter
            const sizeArray = size.split(",");
            console.log('Size parameter received:', size);
            console.log('Size array:', sizeArray);
            query.sizes = {$in: sizeArray};
        }

        if (sizes)  {
            // we are using $in operator, because we can have multiple materials selected in the filter
            const sizesArray = sizes.split(",");
            console.log('Sizes parameter received:', sizes);
            console.log('Sizes array:', sizesArray);
            query.sizes = {$in: sizesArray};
        }


        if (color)  {
            // we are using $in operator, because we can have multiple materials selected in the filter
            const colorArray = color.split(',');
            console.log('Color parameter received:', color);
            console.log('Color array:', colorArray);
            query.colors = {$in: colorArray};
        }

        if (colors)  {
            // we are using $in operator, because we can have multiple materials selected in the filter
            const colorsArray = colors.split(',');
            console.log('Colors parameter received:', colors);
            console.log('Colors array:', colorsArray);
            query.colors = {$in: colorsArray};
        }

        if (gender)  {
            query.gender = gender
        }

        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) {
                const min = Number(minPrice);
                if (!isNaN(min)) {
                    query.price.$gte = min;
                    console.log('Setting min price filter:', min);
                }
            }
            if (maxPrice) {
                const max = Number(maxPrice);
                if (!isNaN(max)) {
                    query.price.$lte = max;
                    console.log('Setting max price filter:', max);
                }
            }
            console.log('Final price filter:', query.price);
        }

        if (search)  {
            query.$or = [
                // $regex = regular expression
                {name: {$regex: search, $options: "i"}}, // i = ignore case
                {description: {$regex: search, $options: "i"}},
                {tags: {$regex: search, $options: "i"}},
            ]
        }

        // Sort Logic
        let sort = {}; // empty object
        if (sortBy) {
            switch (sortBy) {
                case "priceAsc":
                    sort = {price: 1};
                    break;
                case "priceDesc":
                    sort = {price: -1};
                    break;
                case "popularity":
                    sort = {rating: -1};
                    break;
                default:
                    break;
            }
        }

        // Debug logging
        console.log('Executing query:', JSON.stringify({
            query,
            sort,
            limit: Number(limit) || 0
        }));

        // Log count of matching products
        const count = await Product.countDocuments(query);
        console.log(`Found ${count} matching products`);

        // Fetch the products from the database
        const products = await Product.find(query)
            .sort(sort)
            .limit(Number(limit) || 0);

        // Log sample prices
        if (products.length > 0) {
            console.log('Sample product prices:',
                products.slice(0, 3).map(p => ({
                    name: p.name,
                    price: p.price,
                    discountPrice: p.discountPrice
                }))
            );
        }

        console.log('Sending response with', products.length, 'products');

        res.json(products);
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
        // new request > "All Products" > GET > URL:http://localhost:9000/api/products

        // Test the filter: http://localhost:9000/api/products/?category=Top Wear
        // you can see all products with category "Top Wear"
    }
});

// Best Seller

// @route GET /api/products/best-seller
// @desc Retrieve the product with the highest rating and that will be our best seller
// @access Public
router.get('/best-seller', async (req, res) => {
    try {
        // the route will retrieve the best sellers ID, we don't want that
        // res.send("This should work.");
        // Add new request > Best Seller > GET > URL:http://localhost:9000/api/products/best-seller

        // Find a single product sorted by rating in descending order
        const bestSeller = await Product.findOne().sort({ rating: -1 });
        if(bestSeller) {
            res.json(bestSeller);
        } else {
            // If no best seller is found
            res.status(404).json({ message: "No Best Seller Found" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
        // Send request
    }
});

// New Arrivals
// @route GET /api/products/new-arrivals
// @desc Retrieve the 10 most recent products
// @access Public
router.get('/new-arrivals', async (req, res) => {
    try {
        // Fetch the 10 most recent products, sorted by newest first
        const newArrivals = await Product.find({})
            .sort({ createdAt: -1 })
            .limit(10);
        
        // respond with the list of the 10 most recent products
        res.json(newArrivals);
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
});


// Single Product Details

// @route GET /api/products/:id
// @desc Get a single product by ID
// @access Public
router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (product) {
            res.json(product);
        } else {
            res.status(404).json({ message: "Product Not Found" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
        // new request > "Product Details" > GET > URL:http://localhost:9000/api/products/684af05ebfa594e0b051f78a
        // now you can see all the details of the product
    }
});

// Display similar products that will be visible on the product details page
// @route GET /api/products/similar/:id
// @desc Retrieve similar products based on the current product's *gender* and *category*
// @access Public
router.get('/similar/:id', async (req, res) => {
   // extract the product ID from the request parameters
    const { id }= req.params;
    // check if the route is working fine
    // console.log(id);
    // new request > "Similar Products" > GET > URL:http://localhost:9000/api/products/similar/:id > SAVE
    // copy the product ID from the "Product Details" request > paste in "Similar Products" Path Variables in Value
    // You can see the product ID printed in the Terminal

    try {
        // find the product by ID
        const product = await Product.findById(id);
        // check if the product exists
        // we need to exclude the current product id, we don't want the same product to be listed in the similar products
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        // find similar products based on the product's gender and category
        const similarProducts = await Product.find({
            // $ne = not equal
            _id: { $ne: id }, // exclude the current product ID
            gender: product.gender,
            // Take care of the category, so it matches the category of the current product
            category: product.category,
            // limit the number of similar products to 4
        }).limit(4);

        res.json(similarProducts);

    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
});

// @route   GET /api/products/:id
// @desc    Get a single product by ID
// @access  Public
router.get('/:id', async (req, res) => {
    try {
        console.log('Fetching product with ID:', req.params.id);
        const product = await Product.findById(req.params.id);
        if (product) {
            console.log('Product found:', product.name);
            console.log('Number of images:', product.images ? product.images.length : 0);
            res.json(product);
        } else {
            console.log('Product not found with ID:', req.params.id);
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/products/weekly
// @desc    Get a random featured product for the weekly showcase
// @access  Public
router.get('/weekly', async (req, res) => {
    try {
        // Get the count of all featured products
        const count = await Product.countDocuments({ isFeatured: true });

        // Get a random skip value
        const random = Math.floor(Math.random() * count);

        // Find one random featured product
        const weeklyProduct = await Product.findOne({ isFeatured: true })
            .skip(random)
            .select('-reviews -__v') // Exclude reviews and version key
            .populate('user', 'name email'); // Include basic user info

        if (!weeklyProduct) {
            return res.status(404).json({
                message: "No featured products found"
            });
        }

        // Calculate next update time (next Friday at 19:00)
        const now = new Date();
        const nextFriday = new Date(now);
        const daysUntilFriday = (5 - now.getDay() + 7) % 7 || 7; // 5 is Friday (0 is Sunday)
        nextFriday.setDate(now.getDate() + daysUntilFriday);
        nextFriday.setHours(19, 0, 0, 0); // Set to 7 PM

        res.json({
            product: weeklyProduct,
            nextUpdate: nextFriday.toISOString()
        });

    } catch (error) {
        console.error('Error in /api/products/weekly:', error);
        res.status(500).json({
            message: "Server error while fetching weekly product",
            error: error.message
        });
    }
});

// Add this debug route
router.get('/debug/top-wear-prices', async (req, res) => {
    try {
        const products = await Product.find({ category: "Top Wear" })
            .select('name price discountPrice')
            .sort({ price: 1 });
        res.json(products);
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
});

module.exports = router;