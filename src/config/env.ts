import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb+srv://muhammadtalhadnp225_db_user:23pQfb3BldINYotY@hotel.tvj7lm3.mongodb.net/hotelerp?retryWrites=true&w=majority',
  JWT_SECRET: process.env.JWT_SECRET || 'hotel_erp_default_secure_jwt_secret_key_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CORS_ORIGIN: process.env.CORS_ORIGIN || process.env.CLIENT_URL || '*',
  CLIENT_URL: process.env.CLIENT_URL || process.env.APP_URL || 'http://localhost:3000',
  APP_URL: process.env.APP_URL || '',
  
  // Hotel Mail Configuration
  HOTEL_EMAIL: process.env.HOTEL_EMAIL || 't02407446@gmail.com',
  HOTEL_NAME: process.env.HOTEL_NAME || 'Aethelgard Resort & Sanctuary',
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
  SMTP_SECURE: process.env.SMTP_SECURE === 'true' || false,
  SMTP_USER: process.env.SMTP_USER || 't02407446@gmail.com',
  SMTP_PASS: process.env.SMTP_PASS || '',
};

