const mongoose = require('mongoose');
const Counter = require('./models/Counter');

const initializeCounters = async () => {
    try {
        // Check if the report counter exists
        const reportCounter = await Counter.findById('reportRef');
        if (!reportCounter) {
            await Counter.create({ _id: 'reportRef', seq: 0 });
            console.log('Initialized report counter');
        }

        console.log('Counters initialized successfully');
        return true;
    } catch (error) {
        console.error('Error initializing counters:', error);
        return false;
    }
};

module.exports = initializeCounters;