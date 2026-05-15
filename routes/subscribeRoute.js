// // import express
// const express = require('express');
// const mongoose = require("mongoose");
//
// const router = express.Router();
//
// const Subscriber  = require("../models/Subscriber");
//
// // Add route
// // @route POST /api/subscribe
// // @desc Handle newsletter subscription
// // @access Public
// router.post('/subscribe', async (req, res) => {
//     // restructure email from the request body
//     const { email } = req.body;
//     // check if the email field is provided in the request body
//     if (!email) {
//         // If no email is provided respond with a 400 status code
//         return res.status(400).json({message: 'Email is required'});
//     }
//
//     try {
//         // Check if the email is already subscribed
//         let subscriber = await Subscriber.findOne({ email });
//         if (subscriber) {
//             // If the email is already in the database, respond with a 400 status code
//             return res.status(400).json({message: 'Email is already subscribed'});
//         }
//
//         // If email is not subscribed, create a new subscriber
//         subscriber = new Subscriber({
//             email
//         });
//         // Save the subscriber to the database
//         await subscriber.save();
//         // Send a 201 status code response
//         res.status(201).json({message: 'Successfully subscribed to the newsletter!'});
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({message: 'Server Error'});
//     }
// });
//
// module.exports = router

// open server.js file
// include the following routes in server.js

// // create a new collection "Subscribe" > name it "Subscribe" > POST > URL:http://localhost:9000/api/subscribe > Body > raw
// {
//     "email": "haha@example.com"
// }
// You should see the message "Successfully subscribed to the newsletter!"