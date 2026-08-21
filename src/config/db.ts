import mongoose from 'mongoose';
import dns from 'dns';
import { ENV } from './env.js';

// Configure Public DNS resolvers (8.8.8.8, 1.1.1.1) to resolve mongodb+srv:// SRV records on Windows/local networks
try {
  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {
  // Ignore if system restricts custom DNS servers
}

export interface DatabaseStatus {
  isConnected: boolean;
  readyState: number; // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
  host?: string;
  name?: string;
  uriConfigured: boolean;
  storageType: 'mongodb_atlas' | 'in_memory_engine';
  lastError?: string;
  connectedAt?: string;
}

let dbStatus: DatabaseStatus = {
  isConnected: false,
  readyState: 0,
  uriConfigured: Boolean(ENV.MONGODB_URI && !ENV.MONGODB_URI.includes('<username>')),
  storageType: 'in_memory_engine',
};

export const getDatabaseStatus = (): DatabaseStatus => {
  const state = mongoose.connection.readyState;
  return {
    ...dbStatus,
    readyState: state,
    isConnected: state === 1,
    host: mongoose.connection.host || (state === 1 ? 'MongoDB Cluster' : undefined),
    name: mongoose.connection.name || (state === 1 ? 'hotel_erp' : undefined),
  };
};

export const connectDatabase = async (): Promise<boolean> => {
  const uri = ENV.MONGODB_URI;

  if (!uri || uri.includes('<username>') || uri.includes('<password>')) {
    console.warn('[MongoDB] No valid MONGODB_URI found. Fallback to In-Memory Engine.');
    dbStatus = {
      isConnected: false,
      readyState: 0,
      uriConfigured: false,
      storageType: 'in_memory_engine',
    };
    return false;
  }

  try {
    const isLocal = uri.includes('127.0.0.1') || uri.includes('localhost');
    console.log(`[MongoDB] Connecting to ${isLocal ? 'Local MongoDB (database: hotelerp)' : 'MongoDB Atlas'}...`);
    mongoose.set('strictQuery', true);
    mongoose.set('bufferCommands', false);
    
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2000,
      socketTimeoutMS: 10000,
    });

    const dbName = mongoose.connection.name || 'hotelerp';

    dbStatus = {
      isConnected: true,
      readyState: 1,
      uriConfigured: true,
      storageType: isLocal ? 'mongodb_atlas' : 'mongodb_atlas',
      host: mongoose.connection.host,
      name: dbName,
      connectedAt: new Date().toISOString(),
    };

    console.log(`[MongoDB] Successfully connected to database: "${dbName}" at ${mongoose.connection.host}:${mongoose.connection.port || 27017}`);
    return true;
  } catch (error: any) {
    console.warn(`[MongoDB] Local/Cloud database connection failed (${error.message}). Defaulting to In-Memory Engine.`);
    dbStatus = {
      isConnected: false,
      readyState: 0,
      uriConfigured: true,
      storageType: 'in_memory_engine',
      lastError: error.message,
    };
    return false;
  }
};

// Listen to Mongoose connection events
mongoose.connection.on('connected', () => {
  console.log('[MongoDB] Mongoose connected');
  dbStatus.isConnected = true;
  dbStatus.readyState = 1;
  dbStatus.storageType = 'mongodb_atlas';
});

mongoose.connection.on('error', (err) => {
  console.error('[MongoDB] Mongoose connection error:', err);
  dbStatus.lastError = err.message;
});

mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB] Mongoose disconnected');
  dbStatus.isConnected = false;
  dbStatus.readyState = 0;
});
