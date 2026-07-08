Perfect! Let me create clean, well-structured documentation for your README.md.

---

# HustleGuard Backend API

## Overview
HustleGuard is a voice-enabled shop management system designed for small and medium retail businesses. This backend API provides secure authentication, inventory management, sales recording, and profit tracking capabilities.

## Tech Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (with future PostgreSQL migration capability)
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcryptjs
- **File Upload**: Multer (future implementation)

---

## 📋 Table of Contents
1. [Getting Started](#getting-started)
2. [Authentication](#authentication)
3. [Products](#products)
4. [Sales](#sales)
5. [Error Handling](#error-handling)
6. [Data Models](#data-models)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- MongoDB Atlas or local MongoDB
- npm or yarn

### Installation

```bash
# Clone repository
git clone https://github.com/theKxbyte/hustleguard-backend.git

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Update .env with your credentials
# Start development server
npm run dev
```

### Environment Variables
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/hustleguard
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRE=7d
```

### API Base URL
```
http://localhost:5000/api
```

---

## 🔐 Authentication

All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

### Register User
```http
POST /auth/register
```

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@shop.com",
  "password": "password123",
  "shopName": "John's Store",
  "phone": "0712345678"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "6a4e260977b0e4457af882e3",
    "name": "John Doe",
    "email": "john@shop.com",
    "shopName": "John's Store",
    "phone": "0712345678",
    "role": "owner",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Login User
```http
POST /auth/login
```

**Request Body:**
```json
{
  "email": "john@shop.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "6a4e260977b0e4457af882e3",
    "name": "John Doe",
    "email": "john@shop.com",
    "shopName": "John's Store",
    "phone": "0712345678",
    "role": "owner",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

## 📦 Products

All product endpoints require authentication.

### Create Product
```http
POST /products
```

**Request Body:**
```json
{
  "name": "Laptop",
  "category": "Electronics",
  "buyingPrice": 500,
  "sellingPrice": 700,
  "quantity": 10,
  "minStockAlert": 3,
  "supplier": "Tech Corp",
  "supplierPrice": 480
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "6a4e2829df172b14e4e4133f",
    "name": "Laptop",
    "category": "Electronics",
    "buyingPrice": 500,
    "sellingPrice": 700,
    "quantity": 10,
    "minStockAlert": 3,
    "supplier": "Tech Corp",
    "supplierPrice": 480,
    "isActive": true,
    "owner": "6a4e260977b0e4457af882e3",
    "createdAt": "2026-07-08T10:36:25.154Z",
    "updatedAt": "2026-07-08T10:36:25.154Z"
  }
}
```

### Get All Products
```http
GET /products
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| category | string | Filter by product category |
| isActive | boolean | Filter by active status |

### Get Single Product
```http
GET /products/:id
```

### Update Product
```http
PUT /products/:id
```

**Request Body:** (Partial update supported)
```json
{
  "quantity": 15,
  "sellingPrice": 750,
  "minStockAlert": 5
}
```

### Delete Product
```http
DELETE /products/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Product deleted successfully"
  }
}
```

### Get Low Stock Products
```http
GET /products/low-stock
```

### Get Out of Stock Products
```http
GET /products/out-of-stock
```

### Update Product Stock
```http
PATCH /products/:id/stock
```

**Request Body:**
```json
{
  "quantityChange": -2
}
```

---

## 💰 Sales

All sales endpoints require authentication.

### Record a Sale
```http
POST /sales
```

**Request Body:**
```json
{
  "productId": "6a4e2829df172b14e4e4133f",
  "quantity": 2,
  "sellingPrice": 700,
  "customer": "Jane Smith",
  "paymentMethod": "cash",
  "notes": "Walk-in customer"
}
```

**Payment Methods:**
- `cash`
- `mobile_money`
- `bank_transfer`
- `credit`

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "6a4e2890df172b14e4e4140g",
    "product": "6a4e2829df172b14e4e4133f",
    "quantity": 2,
    "sellingPrice": 700,
    "buyingPrice": 500,
    "profit": 400,
    "customer": "Jane Smith",
    "paymentMethod": "cash",
    "notes": "Walk-in customer",
    "owner": "6a4e260977b0e4457af882e3",
    "saleDate": "2026-07-08T11:00:00.000Z"
  }
}
```

### Get All Sales
```http
GET /sales
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| startDate | string | Filter sales from this date (ISO) |
| endDate | string | Filter sales until this date (ISO) |
| productId | string | Filter by specific product |
| limit | number | Limit number of results |

### Get Daily Sales
```http
GET /sales/daily
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| date | string | Date to get sales (ISO, default: today) |

**Response:**
```json
{
  "success": true,
  "data": {
    "date": "2026-07-08T00:00:00.000Z",
    "totalSales": 3,
    "totalRevenue": 2100,
    "totalProfit": 600,
    "sales": [...]
  }
}
```

### Get Sales Statistics
```http
GET /sales/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "today": {
      "totalSales": 3,
      "totalRevenue": 2100,
      "totalProfit": 600
    },
    "month": {
      "totalSales": 45,
      "totalRevenue": 31500,
      "totalProfit": 9000
    },
    "topProducts": [
      {
        "_id": "6a4e2829df172b14e4e4133f",
        "product": {
          "name": "Laptop",
          "category": "Electronics"
        },
        "totalSold": 10,
        "totalRevenue": 7000,
        "totalProfit": 2000
      }
    ]
  }
}
```

---

## 🩺 System

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "success": true,
  "message": "HustleGuard API is running",
  "timestamp": "2026-07-08T11:00:00.000Z"
}
```

---

## ❌ Error Handling

All errors follow a consistent format:

```json
{
  "success": false,
  "message": "Error description here"
}
```

### Common HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## 📊 Data Models

### User Schema
```javascript
{
  name: String (required),
  email: String (required, unique),
  password: String (required, min: 6),
  role: String (enum: ['owner', 'employee']),
  shopName: String (required),
  phone: String (required),
  createdAt: Date
}
```

### Product Schema
```javascript
{
  name: String (required),
  description: String,
  category: String (required),
  buyingPrice: Number (required),
  sellingPrice: Number (required),
  quantity: Number (required, default: 0),
  minStockAlert: Number (default: 5),
  supplier: String,
  supplierPrice: Number,
  lastRestockDate: Date,
  isActive: Boolean (default: true),
  owner: ObjectId (ref: 'User', required)
}
```

### Sale Schema
```javascript
{
  product: ObjectId (ref: 'Product', required),
  quantity: Number (required),
  sellingPrice: Number (required),
  buyingPrice: Number (required),
  profit: Number (required),
  customer: String,
  paymentMethod: String (enum: ['cash', 'mobile_money', 'bank_transfer', 'credit']),
  saleDate: Date (default: now),
  owner: ObjectId (ref: 'User', required),
  notes: String
}
```

---

## 🔧 Development

### Available Scripts
```bash
# Start development server with auto-reload
npm run dev

# Start production server
npm start
```

### Project Structure
```
backend/
├── src/
│   ├── config/          # Database & environment config
│   ├── controllers/     # Request handlers
│   ├── middlewares/     # Auth, validation, error handling
│   ├── models/          # MongoDB schemas
│   ├── routes/          # API route definitions
│   ├── services/        # Business logic
│   ├── utils/           # Helper functions
│   ├── app.js           # Express app setup
│   └── server.js        # Entry point
├── uploads/             # File uploads
└── .env                 # Environment variables
```

---

## 📝 Postman Collection

Import this collection to test the API:

**Collection Variables:**
```json
{
  "baseUrl": "http://localhost:5000/api",
  "token": "YOUR_JWT_TOKEN_HERE"
}
```

**Endpoints Structure:**
```
HustleGuard API
├── Auth
│   ├── POST Register
│   └── POST Login
├── Products
│   ├── POST Create
│   ├── GET All
│   ├── GET One
│   ├── PUT Update
│   ├── DELETE Delete
│   ├── GET Low Stock
│   ├── GET Out of Stock
│   └── PATCH Update Stock
├── Sales
│   ├── POST Record
│   ├── GET All
│   ├── GET Daily
│   └── GET Stats
└── System
    └── GET Health
```

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

ISC License - see [LICENSE](LICENSE) file for details.

---

## 🔗 Links

- **Repository**: [https://github.com/theKxbyte/hustleguard-backend](https://github.com/theKxbyte/hustleguard-backend)
- **Issues**: [https://github.com/theKxbyte/hustleguard-backend/issues](https://github.com/theKxbyte/hustleguard-backend/issues)

---

## 🛣️ Roadmap

### Phase 1 (Current) ✅
- [x] User Authentication
- [x] Product Management
- [x] Sales Recording
- [x] Profit Tracking
- [x] Stock Alerts

### Phase 2 (Next)
- [ ] Voice-to-Text Sales
- [ ] Employee Management
- [ ] Advanced Analytics
- [ ] Notifications

### Phase 3 (Future)
- [ ] AI-Powered Insights
- [ ] Multi-Shop Support
- [ ] Mobile App Integration

---

**API Version**: v1.0.0
**Last Updated**: 2026-07-08