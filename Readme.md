# InterIIT Backend API

A robust Node.js backend API for a social forum platform featuring posts, comments, user management, and voting systems. Built with Express.js, MongoDB, and Docker for scalable deployment.
##env
MONGODB_URI="mongodb+srv://nasifhossain040:ilovepdf@interiit2025.xndujfx.mongodb.net/?retryWrites=true&w=majority&appName=INTERIIT2025"
PORT = 8000
JWT_SECRET = "atiggaAtigga"
JWT_EXPIRES_IN = "7d"

## 🚀 Features

- **User Management**: Authentication, authorization, user profiles
- **Posts System**: Create, read, update, delete posts with rich content
- **Comments System**: Nested commenting with unlimited depth
- **Voting System**: Upvote/downvote functionality for posts and comment
- **File Upload**: Image and media handling
- **Admin Panel**: Administrative controls and moderation
- **Security**: JWT authentication, input validation, rate limiting
- **Logging**: Comprehensive logging system
- **Docker Support**: Containerized deployment

## 🛠 Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **File Upload**: Multer
- **Validation**: Express-validator
- **Logging**: Winston
- **Documentation**: Swagger/OpenAPI
- **Containerization**: Docker & Docker Compose
- **Environment**: dotenv for configuration

## 📁 Project Structure

```
backend/
├── controllers/           # Route controllers
├── middleware/           # Custom middleware functions
├── models/              # MongoDB schemas and models
│   ├── comments.model.js
│   ├── posts.model.js
│   ├── user.model.js
│   └── upvotes.model.js
├── routes/              # API route definitions
├── services/            # Business logic layer
│   ├── comments.services.js
│   ├── posts.services.js
│   ├── user.services.js
│   └── upvotes.services.js
├── utils/               # Utility functions
│   ├── appError.js
│   ├── logger.js
│   └── CurrentTime.js
├── uploads/             # File upload directory
├── docker-compose.yml   # Docker composition
├── Dockerfile          # Docker container definition
├── package.json        # Dependencies and scripts
└── server.js           # Application entry point
```

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Node.js 16+ (for local development)
- MongoDB (if running locally)

### 🐳 Docker Setup (Recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd InterIIT/backend
   ```

2. **Initial build and start**
   ```bash
   docker-compose up --build
   ```
   This command will:
   - Build the Docker images
   - Create and start all containers
   - Set up the MongoDB database
   - Start the Node.js application

3. **Subsequent runs**
   ```bash
   docker-compose up
   ```
   Use this for regular startup after the initial build.

4. **Run in background**
   ```bash
   docker-compose up -d
   ```

5. **Stop services**
   ```bash
   docker-compose down
   ```

6. **Rebuild after changes**
   ```bash
   docker-compose up --build
   ```

### 🔧 Local Development Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Environment setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start MongoDB**
   ```bash
   # Using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   
   # Or install locally
   mongod
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user profile

### Users
- `GET /api/users` - Get all users (admin)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user profile
- `DELETE /api/users/:id` - Delete user (admin)

### Posts
- `GET /api/posts` - Get all posts with pagination
- `POST /api/posts` - Create new post
- `GET /api/posts/:id` - Get post by ID
- `PUT /api/posts/:id` - Update post
- `DELETE /api/posts/:id` - Delete post
- `POST /api/posts/:id/vote` - Vote on post

### Comments
- `GET /api/posts/:postId/comments` - Get comments for a post
- `POST /api/posts/:postId/comments` - Create comment
- `GET /api/comments/:id` - Get comment by ID
- `PUT /api/comments/:id` - Update comment
- `DELETE /api/comments/:id` - Delete comment
- `GET /api/comments/:id/replies` - Get replies to comment
- `POST /api/comments/:id/vote` - Vote on comment

### Voting
- `POST /api/votes/comment/:id` - Vote on comment
- `POST /api/votes/post/:id` - Vote on post
- `GET /api/votes/stats/:type/:id` - Get voting statistics

## 📊 Database Models

### User Schema
```javascript
{
  username: String (unique),
  email: String (unique),
  password: String (hashed),
  name: String,
  avatar: String,
  user_type: Number, // 0: user, 1: admin
  joined: Date,
  is_active: Boolean
}
```

### Post Schema
```javascript
{
  title: String,
  content: String,
  user_id: ObjectId (ref: User),
  createdAt: Date,
  updatedAt: Date,
  upvotes: Number,
  is_deleted: Boolean
}
```

### Comment Schema
```javascript
{
  post: ObjectId (ref: Post),
  content: String,
  user: ObjectId (ref: User),
  parent_comment: ObjectId (ref: Comment),
  commented_at: Date,
  upvotes: Number,
  is_deleted: Boolean
}
```

### Upvote Schema
```javascript
{
  user: ObjectId (ref: User),
  post: ObjectId (ref: Post),
  comment: ObjectId (ref: Comment),
  type: Number // 1: upvote, -1: downvote
}
```

## 🔐 Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/interiit
DB_NAME=interiit

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRE=7d

# File Upload
MAX_FILE_SIZE=10485760  # 10MB
UPLOAD_PATH=./uploads

# Rate Limiting
RATE_LIMIT_WINDOW=15    # minutes
RATE_LIMIT_MAX=100      # requests per window

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- --grep "comments"
```

## 🚀 Docker Commands

### Development
```bash
# Build and start
docker-compose up --build

# Start services
docker-compose up

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Execute commands in container
docker-compose exec backend bash
```

### Production
```bash
# Build production image
docker build -t interiit-backend:latest .

# Run production container
docker run -d \
  --name interiit-backend \
  -p 3000:3000 \
  --env-file .env.production \
  interiit-backend:latest
```

## 📈 Features Deep Dive

### Comments System
- **Nested Comments**: Unlimited depth threading
- **Soft Delete**: Comments marked as deleted but preserved for thread integrity
- **Vote Integration**: Upvote/downvote functionality
- **Pagination**: Efficient loading of large comment threads
- **Reply Counting**: Automatic reply count calculation

### Voting System
- **Dual Voting**: Support for both upvotes and downvotes
- **Vote Statistics**: Detailed voting analytics
- **User Restrictions**: Users can only vote once per item
- **Vote Toggle**: Change or remove votes

### User Management
- **Role-based Access**: Admin and regular user roles
- **Profile Management**: Avatar upload and profile editing
- **Authentication**: JWT-based secure authentication
- **Authorization**: Route-level permission checks

## 🛡 Security Features

- JWT token authentication
- Password hashing with bcrypt
- Input validation and sanitization
- Rate limiting
- CORS protection
- File upload restrictions
- SQL injection prevention
- XSS protection

## 📝 API Documentation

Access the interactive API documentation at:
- Development: `http://localhost:3000/api-docs`  
- Production: `https://your-domain.com/api-docs`

## 🔍 Monitoring & Logging

- **Winston Logger**: Structured logging with multiple levels
- **Request Logging**: All API requests logged
- **Error Tracking**: Comprehensive error logging
- **Performance Metrics**: Response time tracking

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   ```bash
   # Check if MongoDB is running
   docker-compose ps
   
   # Restart MongoDB container
   docker-compose restart mongodb
   ```

2. **Port Already in Use**
   ```bash
   # Find process using port 3000
   lsof -i :3000
   
   # Kill the process
   kill -9 <PID>
   ```

3. **Permission Denied (Docker)**
   ```bash
   # Fix Docker permissions
   sudo chmod 666 /var/run/docker.sock
   ```

4. **Node Modules Issues**
   ```bash
   # Clean install
   rm -rf node_modules package-lock.json
   npm install
   ```

### Log Files

Check application logs:
```bash
# Docker logs
docker-compose logs backend

# Local logs
tail -f logs/app.log
```

## 📞 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation at `/api-docs`

---

Made with ❤️ for InterIIT Tech Meet