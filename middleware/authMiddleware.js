// this will contain the middleware to protect routes

// import the jsonwebtoken library
const jwt = require('jsonwebtoken');

// import the User model
const User = require('../models/User');

// Middleware to protect routes
const protect = async (req, res, next) => {
    console.log('Auth middleware called');
    console.log('Request headers:', req.headers);
    
    let token;

    // Check if the authorization header exists and the header starts with 'Bearer' string
    if (req.headers.authorization) {
        console.log('Authorization header found:', req.headers.authorization);
        
        if (req.headers.authorization.startsWith('Bearer ')) {
            // Extract the token from the Authorization header
            token = req.headers.authorization.split(' ')[1];
            console.log('Token extracted from Authorization header');
        } else {
            console.log('Authorization header does not start with Bearer');
        }
    } else if (req.headers['x-access-token']) {
        // Check for token in x-access-token header
        token = req.headers['x-access-token'];
        console.log('Token found in x-access-token header');
    }

    if (token) {
        try {
            console.log('Verifying token...');
            console.log('Token being verified:', token.substring(0, 20) + '...'); // Log first 20 chars of token
            
            // Verify the token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log('Token verified successfully. Decoded:', {
                id: decoded.user?.id,
                role: decoded.user?.role,
                iat: decoded.iat ? new Date(decoded.iat * 1000) : 'No iat',
                exp: decoded.exp ? new Date(decoded.exp * 1000) : 'No exp'
            });
            
            if (!decoded.user?.id) {
                console.error('Token is missing user ID');
                return res.status(401).json({ message: 'Invalid token format' });
            }
            
            // Get user from the database
            console.log('Fetching user from database...');
            const user = await User.findById(decoded.user.id).select('-password');
            
            if (!user) {
                console.error('User not found for token');
                return res.status(401).json({ message: 'User not found' });
            }
            
            // Check if token was issued before the last password change
            if (user.passwordChangedAt && decoded.iat < user.passwordChangedAt.getTime() / 1000) {
                console.error('Token was issued before password change');
                return res.status(401).json({ message: 'Token expired. Please log in again.' });
            }
            
            // Attach user to request object
            req.user = user;
            console.log('User authenticated successfully:', { 
                id: user._id, 
                email: user.email,
                role: user.role 
            });
            
            next();
        } catch (error) {
            console.error('Token verification failed:', {
                name: error.name,
                message: error.message,
                expiredAt: error.expiredAt,
                date: new Date().toISOString()
            });
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ message: 'Invalid token' });
            } else if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Token expired' });
            }
            res.status(500).json({ message: 'Internal server error during authentication' });
        }
    } else {
        console.log('No token provided');
        res.status(401).json({ message: 'Not authorized, no token provided' });
    }
}

// We do not want a customer to create a product
// Add a middleware to check for the admin user before creating the product
// Middleware to check if the user is an admin
const admin = (req, res, next) => {
    console.log('Admin middleware - User role:', req.user?.role);
    if (req.user && req.user.role === 'admin') {
        // allow the operation by calling the next function
        next();
    } else {
        res.status(403).json({message: "Not authorized as an admin"});
    }
}

module.exports = { protect, admin };

// import in userRoutes

// in postman, create a new Request, name it "Profile" > change to GET > URL:http://localhost:9000/api/users/profile
// Header > Authorization > Bearer > " " > Token
// Response:
// {
//     "_id": "6849efc3b81356f9645b440d",
//     "name": "John",
//     "email": "John@example.com",
//     "role": "customer",
//     "createdAt": "2025-06-11T21:06:11.641Z",
//     "updatedAt": "2025-06-11T21:06:11.641Z",
//     "__v": 0
// }