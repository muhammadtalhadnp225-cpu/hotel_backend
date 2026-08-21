import mongoose, { Schema } from 'mongoose';

const RestaurantCategorySchema = new Schema(
  {
    _id: { type: String },
    name: { type: String, required: true },
    code: { type: String },
    description: { type: String },
    icon: { type: String },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, _id: false }
);

const RestaurantMenuItemSchema = new Schema(
  {
    _id: { type: String },
    categoryId: { type: String },
    categoryName: { type: String },
    name: { type: String, required: true },
    code: { type: String },
    description: { type: String },
    price: { type: Number, required: true },
    costPrice: { type: Number },
    preparationTimeMinutes: { type: Number, default: 15 },
    isAvailable: { type: Boolean, default: true },
    isVegetarian: { type: Boolean, default: false },
    isGlutenFree: { type: Boolean, default: false },
    isSpicy: { type: Boolean, default: false },
    allergens: [{ type: String }],
    imageUrl: { type: String },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true, _id: false }
);

const RestaurantTableSchema = new Schema(
  {
    _id: { type: String },
    tableNumber: { type: String, required: true },
    capacity: { type: Number, required: true },
    locationZone: { type: String, default: 'Main Dining' },
    status: { type: String, default: 'available' },
    currentOrderId: { type: String },
    currentBookingId: { type: String },
    currentGuestName: { type: String },
  },
  { timestamps: true, _id: false }
);

const RestaurantOrderSchema = new Schema(
  {
    _id: { type: String },
    orderNumber: { type: String, required: true },
    orderType: { type: String, default: 'dine_in' },
    tableId: { type: String },
    tableNumber: { type: String },
    bookingId: { type: String },
    roomNumber: { type: String },
    guestName: { type: String },
    guestEmail: { type: String },
    items: [
      {
        itemId: String,
        name: String,
        quantity: Number,
        unitPrice: Number,
        totalPrice: Number,
        notes: String,
      },
    ],
    subtotal: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    status: { type: String, default: 'completed' },
    paymentStatus: { type: String, default: 'paid' },
    paymentMethod: { type: String, default: 'cash' },
    notes: { type: String },
    createdBy: { type: String },
  },
  { timestamps: true, _id: false }
);

export const RestaurantCategory =
  mongoose.models.RestaurantCategory || mongoose.model('RestaurantCategory', RestaurantCategorySchema);

export const RestaurantMenuItem =
  mongoose.models.RestaurantMenuItem || mongoose.model('RestaurantMenuItem', RestaurantMenuItemSchema);

export const RestaurantTable =
  mongoose.models.RestaurantTable || mongoose.model('RestaurantTable', RestaurantTableSchema);

export const RestaurantOrder =
  mongoose.models.RestaurantOrder || mongoose.model('RestaurantOrder', RestaurantOrderSchema);
