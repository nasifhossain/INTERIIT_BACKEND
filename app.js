const express  = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const ratelimit = require("express-rate-limit");
require("dotenv").config();

// Import routes
const userRoutes = require('./routes/user.routes');
const postRoutes = require('./routes/post.routes');
const commentRoutes = require('./routes/comments.routes');

// Import middleware
const { globalErrorHandler, requestLogger, errorLogger } = require('./middleware');
const { getCurrentTime } = require("./utils/CurrentTime");
const logger = require('./utils/logger');

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/mydatabase"; // Use the environment variable or fallback to localhost
const app = express();

// Logging middleware should be early in the middleware stack
app.use(requestLogger);

app.use(cors());
// app.use(bodyParser.json());  // Remove this line
// app.use(bodyParser.urlencoded({ extended: false }));  // Remove this line
app.use(express.static('public'));
app.use(express.json({limit: '1mb'}));
app.use(express.urlencoded({limit: '1mb', extended: true}));
app.set('trust proxy', 1);
//rate limit
/* The code snippet `const limiter = ratelimit({ windowMs: 15 * 60 * 1000, max: 100, message: "Too many
requests from this IP, please try again after 15 minutes" }); app.use(limiter);` is implementing
rate limiting for the Express application. Here's what it does: */
const limiter = ratelimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again after 15 minutes"
});
app.use(limiter);

mongoose.connect(MONGO_URI);
mongoose.connection.on("error",(err)=>{
    logger.error("Error Connecting to MONGO DB", err);
    console.log("Error Connecting to MONGO DB");
    console.error(err);
    
})
mongoose.connection.on("connected",()=>{
    logger.info("Connected to MONGO DB", { mongoUri: MONGO_URI });
    console.log("Connected to MONGO DB");
    
})

//payload size limiter testing

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);

// Health check route
app.get('/', (req, res) => {
    logger.info('Health check accessed');
    res.status(200).json({ 
        success: true,
        message: "API is running successfully",
        timestamp: getCurrentTime(),
        version: "1.0.0"
    });
});


// Error logging middleware (before global error handler)
app.use(errorLogger);

// Global error handler (must be last)
app.use(globalErrorHandler);

module.exports = app;