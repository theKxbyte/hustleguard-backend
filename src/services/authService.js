import User from '../models/User.js';
import jwt from 'jsonwebtoken';

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Register new user
export const registerUser = async (userData) => {
  const { name, email, password, shopName, phone } = userData;

  // Check if user exists
  const userExists = await User.findOne({ email });
  if (userExists) {
    throw new Error('User already exists');
  }

  // Create user
  const user = await User.create({
    name,
    email,
    password,
    shopName,
    phone
  });

  if (user) {
    return {
      _id: user.id,
      name: user.name,
      email: user.email,
      shopName: user.shopName,
      phone: user.phone,
      role: user.role,
      token: generateToken(user.id)
    };
  } else {
    throw new Error('Invalid user data');
  }
};

// Login user
export const loginUser = async (email, password) => {
  // Check for user email
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw new Error('Invalid credentials');
  }

  // Check password
  const isPasswordMatch = await user.matchPassword(password);
  if (!isPasswordMatch) {
    throw new Error('Invalid credentials');
  }

  return {
    _id: user.id,
    name: user.name,
    email: user.email,
    shopName: user.shopName,
    phone: user.phone,
    role: user.role,
    token: generateToken(user.id)
  };
};