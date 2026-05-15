// this file will connect our app to mongoDB database

const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log('=== DATABASE CONNECTION ===');
        console.log('MongoDB Connected:', conn.connection.host);
        console.log('Database Name:', conn.connection.name);
        
        // Log all collections
        const collections = await conn.connection.db.listCollections().toArray();
        console.log('Collections:', collections.map(c => c.name));
        
        return conn;
    } catch (err) {
        console.error('MongoDB connection error:', err.message);
        process.exit(1);
    }
};

module.exports = connectDB;

// open server.js file