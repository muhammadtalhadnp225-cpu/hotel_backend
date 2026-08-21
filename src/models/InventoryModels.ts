import mongoose, { Schema } from 'mongoose';

const InventoryItemSchema = new Schema(
  {
    _id: { type: String },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    category: { type: String, required: true },
    unit: { type: String, required: true },
    currentStock: { type: Number, required: true, default: 0 },
    minimumThreshold: { type: Number, required: true, default: 10 },
    reorderQuantity: { type: Number, required: true, default: 50 },
    costPerUnit: { type: Number, required: true, default: 0 },
    sellingPrice: { type: Number },
    supplierId: { type: String },
    supplierName: { type: String },
    location: { type: String },
    status: { type: String, default: 'in_stock' },
  },
  { timestamps: true, _id: false }
);

const InventoryLogSchema = new Schema(
  {
    _id: { type: String },
    itemId: { type: String },
    sku: { type: String },
    itemName: { type: String },
    changeType: { type: String, default: 'Adjustment' },
    quantityChanged: { type: Number, default: 0 },
    previousStock: { type: Number, default: 0 },
    newStock: { type: Number, default: 0 },
    referenceNumber: { type: String },
    notes: { type: String },
    performedBy: { type: String },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true, _id: false }
);

const SupplierSchema = new Schema(
  {
    _id: { type: String },
    name: { type: String, required: true },
    code: { type: String },
    supplierCode: { type: String },
    contactPerson: { type: String },
    email: { type: String },
    phone: { type: String },
    address: { type: String },
    taxId: { type: String },
    paymentTerms: { type: String },
    rating: { type: Number, default: 5 },
    status: { type: String, default: 'active' },
  },
  { timestamps: true, _id: false }
);

const PurchaseOrderSchema = new Schema(
  {
    _id: { type: String },
    poNumber: { type: String, required: true },
    supplierId: { type: String, required: true },
    supplierName: { type: String, required: true },
    items: [
      {
        itemId: String,
        sku: String,
        name: String,
        category: String,
        unit: String,
        quantityOrdered: Number,
        quantityReceived: Number,
        unitCost: Number,
        totalCost: Number,
      },
    ],
    subtotal: { type: Number, required: true },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    status: { type: String, default: 'Draft' },
    deliveryDate: { type: Date },
    createdByName: { type: String },
    approvedByName: { type: String },
    notes: { type: String },
  },
  { timestamps: true, _id: false }
);

const SupplierPaymentSchema = new Schema(
  {
    _id: { type: String },
    paymentNumber: { type: String, required: true },
    poId: { type: String },
    poNumber: { type: String },
    supplierId: { type: String, required: true },
    supplierName: { type: String, required: true },
    amount: { type: Number, required: true },
    paymentDate: { type: Date, default: Date.now },
    paymentMethod: { type: String, default: 'Bank Transfer' },
    referenceNumber: { type: String },
    recordedByName: { type: String },
    status: { type: String, default: 'Completed' },
  },
  { timestamps: true, _id: false }
);

export const InventoryItem =
  mongoose.models.InventoryItem || mongoose.model('InventoryItem', InventoryItemSchema);

export const InventoryLog =
  mongoose.models.InventoryLog || mongoose.model('InventoryLog', InventoryLogSchema);

export const Supplier =
  mongoose.models.Supplier || mongoose.model('Supplier', SupplierSchema);

export const PurchaseOrder =
  mongoose.models.PurchaseOrder || mongoose.model('PurchaseOrder', PurchaseOrderSchema);

export const SupplierPayment =
  mongoose.models.SupplierPayment || mongoose.model('SupplierPayment', SupplierPaymentSchema);
