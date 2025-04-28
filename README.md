# Shopping Cart API

A scalable shopping cart system API built with NestJS, MongoDB, and Redis, designed to handle concurrent operations efficiently.

## Features

- Product inventory management
- User cart operations (add, update, remove items)
- Checkout process with inventory updates
- Concurrent operation handling with distributed locks
- Caching for improved performance
- MongoDB for persistent storage
- Redis for caching and distributed locking

## Tech Stack

- Node(NestJS)
- MongoDB (Mongoose)
- Redis (ioredis)
- TypeScript
- Docker for containerization

## Setup Instructions

### Prerequisites

- Node.js (v16+)
- Docker and Docker Compose (for containerized setup)
- MongoDB (local or containerized)
- Redis (local or containerized)

### Setup with Docker

1. Clone the repository
2. Run the application using Docker Compose:

```bash
docker-compose up
```

This will:

- Start MongoDB and Redis services
- Build and start the API service
- Expose the API on port 3000

### Manual Setup

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the project root with the following content:

```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/shopping-cart
REDIS_HOST=localhost
REDIS_PORT=6379
```

4. Start MongoDB and Redis services (if not already running):

```bash
# Using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
docker run -d -p 6379:6379 --name redis redis:alpine
```

5. Start the application:

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

## API Documentation

Once the application is running, access the Swagger UI documentation:

```
http://localhost:3000/api
```

## Key Endpoints

### Users

- `POST /users` - Create a new user
- `GET /users` - Get all users
- `GET /users/:id` - Get a specific user

### Products

- `POST /products` - Create a new product
- `GET /products` - Get all products with pagination
- `GET /products/:id` - Get a specific product
- `PATCH /products/:id` - Update a product
- `DELETE /products/:id` - Delete a product

### Carts

- `GET /carts/user/:userId` - Get user cart
- `POST /carts/user/:userId/items` - Add item to cart
- `PUT /carts/user/:userId/items/:productId` - Update cart item quantity
- `DELETE /carts/user/:userId/items/:productId` - Remove item from cart
- `POST /carts/user/:userId/checkout` - Checkout user cart
- `DELETE /carts/user/:userId` - Clear user cart

## Design Decisions

### Concurrency Handling

Redis-based distributed locks are used to prevent race conditions when:

- Updating product stock levels
- Adding, updating, or removing items from carts
- Processing checkouts

### Caching Strategy

The application uses Redis caching for:

- Product details and listings
- User information
- Cart data

Cache invalidation occurs when:

- Products are created, updated, or deleted
- Cart items are modified
- Checkout operations complete

### Database Design

MongoDB collections:

- Products - Stores product information including stock levels
- Users - Stores user information
- Carts - Stores cart items and checkout status

### Checkout Process

The checkout process:

1. Validates product availability
2. Updates stock levels atomically
3. Marks the cart as checked out
4. Uses MongoDB transactions to ensure data consistency

## Performance Optimizations

- Database indexes on frequently queried fields
- Redis caching to reduce database load
- Distributed locking for concurrent operations
- Pagination for large product listings
- Optimized MongoDB queries
