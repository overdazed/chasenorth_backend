// import mongoose
const mongoose = require("mongoose");
// import dotenv
const dotenv = require("dotenv");
// import models
const Product = require("./models/Product");
const User = require("./models/User");
const Cart = require("./models/Cart");

// import products.js file from the data folder
const products = require("./data/products");

dotenv.config();

// connect to mongoDB database
mongoose.connect(process.env.MONGO_URI)

// function to seed the database
const seedData = async () => {
    try {
        // Everytime I run this file, clear previous data
        await Product.deleteMany();
        await User.deleteMany();
        await Cart.deleteMany(); // create a new file under routes folder > cartRoutes.js

        // Create a default admin user
        const createdUser = await User.create({
            name: "Admin User",
            email: "admin@example.com",
            password: "123456",
            role: "admin"
        });

        // Assign default user id to each product
        const userID = createdUser._id;

        // We need to append this user id
        // Look through the products
        const sampleProducts = products.map((product) => {
            // Path `user` is required.
            return {...product, user: userID }
        })

        // Insert the products into the database
        await Product.insertMany(sampleProducts);

        console.log("Product data seeded successfully!");
        process.exit();
    } catch (error) {
        console.error("Error seeding the data", error)
        process.exit(1);
    }
}

// call the seedData function
seedData()

// to run this file, open the package.json file
// Add script "seed": "node backend/seeder.js"


// When there is data in the database, it will be deleted and new data will be added

// Now that we have data to work with, work on displaying the products