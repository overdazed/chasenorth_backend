// import express
const express = require("express");
// import the user model
const User = require("../models/User");
// import the protect middleware
const { protect, admin } = require("../middleware/authMiddleware");

// initialize router
const router = express.Router();

// Create a route to retrieve a list of all users in the system
// @route GET /api/admin/users
// @desc Get all users (Admin only)
// @access Private/Admin, only admin can get all users
// @route GET /api/admin/users
// @desc Get all users (Admin only)
// @access Private/Admin, only admin can get all users
router.get("/users", protect, admin, async (req, res) => {
    try {
        // Fetch all users found in the database
        const users = await User.find({});
        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({message: "Server Error"});
    }
});

// Create a new collection "Admin User" > name it "All Users" > GET > URL:http://localhost:9000/api/admin/users
// Authorisation > Bearer > Token copy from Admin Login request
// You can see all users as Array


// Add route to allow admins to create new users
// @route POST /api/admin/users
// @desc Create a new user (Admin only)
// @access Private/Admin, only admin can create new users
// @route POST /api/admin/users
// @desc Create a new user (Admin only)
// @access Private/Admin, only admin can create new users
router.post("/users", protect, admin, async (req, res) => {
    // we will search for user details in req.body
    const { name, email, password, role } = req.body;
    try {
        // Check if there is already a user with the same email
        let user = await User.findOne({ email });
        // If email is already taken, return 400
        if (user) {
            return res.status(400).json({message: "User already exists"});
        }
        // If email is not taken, create a new user
        user = new User({
            name,
            email,
            password,
            role: role || "customer", // default role
        });

        // save the user to the database
        await user.save();
        // we'll send a success message after this, along with the user details
        res.status(201).json({message: "User created successfully", user});
    } catch (error) {
        console.error(error);
        res.status(500).json({message: "Server Error"});
    }
});

// Create a new request "Create User" > GET > URL:http://localhost:9000/api/admin/users
// Authorisation > Bearer > Token copy from Admin Login request
// {
//     "name": "Jimmy",
//     "email": "jimmy@example.com",
//     "password": "123456"
// }
// You should see the message "User created successfully"
// Entry created in the database "users"


// Set up a route to let admin update user details like name, email address, role
// @route PUT /api/admin/users/:id
// @desc Update user information (Admin only) - Name, email, role
// @access Private/Admin, only admin can update users
router.put("/users/:id", protect, admin, async (req, res) => {
    try {
        // Find the user by id from their URL
        const user = await User.findById(req.params.id);
        // If user is found, update details
        if (user) {
            user.name = req.body.name || user.name;
            user.email = req.body.email || user.email;
            user.role = req.body.role || user.role;
        }
        // save the user to the database
        const updatedUser = await user.save();
        // we'll send a success message, along with the user details
        res.json({message: "User updated successfully", user: updatedUser});
    } catch (error) {
        console.error(error);
        res.status(500).json({message: "Server Error"});
    }
});

// Create a new request "Update User" > GET > URL:http://localhost:9000/api/admin/users/:id
// Authorisation > Bearer > Token copy from Admin Login request
// {
//     "name": "Jimmy",
//     "email": "jimmy1@example.com",
// }
// You should see a 200 status code
// Entry updated in the database "users"


// Set up a route to let admin delete a user
// @route DELETE /api/admin/users/:id
// @desc Delete a user (Admin only)
// @access Private/Admin, only admin can delete users
router.delete("/:id", protect, admin, async (req, res) => {
    try {
        // Find the user by id from their URL
        const user = await User.findById(req.params.id);
        // If user is found, delete it
        if (user) {
            await user.deleteOne();
            res.json({message: "User deleted successfully"});
        } else {
            // If the user is not found, return 404
            res.status(404).json({message: "User not found"});
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({message: "Server Error"});
    }
});

// Create a new request "Delete User" > GET > URL:http://localhost:9000/api/admin/users/:id
// Authorisation > Bearer > Token copy from Admin Login request
// Params > ID > ID of the user
// You should see a 200 status code and the message "User deleted successfully"

// export the router
module.exports = router;

// include the following routes in server.js