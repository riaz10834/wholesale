export type Role = "customer" | "admin" | "delivery";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "packed"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "failed"
  | "returned";

export type DeliveryStatus = "assigned" | "picked_up" | "out_for_delivery" | "delivered" | "failed" | "cancelled";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string;
  phone: string;
  role: Role;
  is_active: boolean;
  is_online: boolean;
  last_lat: number | null;
  last_lng: number | null;
  last_accuracy: number | null;
  last_heading: number | null;
  last_speed: number | null;
  last_location_at: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface Inventory {
  variant_id: string;
  quantity: number;
  low_stock_threshold: number;
}

export interface Variant {
  id: string;
  product_id: string;
  sku: string | null;
  size: string | null;
  color: string | null;
  color_hex: string | null;
  price: number | null;
  cost_price: number | null;
  is_active: boolean;
  inventory?: Inventory | null;
}

export interface Product {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  unit: string;
  wholesale_price: number;
  retail_price: number | null;
  cost_price: number;
  min_order_qty: number;
  images: string[];
  is_featured: boolean;
  is_active: boolean;
  created_at: string;
  category?: Pick<Category, "id" | "name" | "slug"> | null;
  product_variants?: Variant[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  size: string | null;
  color: string | null;
  image_url: string | null;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  line_total: number;
}

export interface Delivery {
  id: string;
  order_id: string;
  delivery_person_id: string;
  status: DeliveryStatus;
  assigned_at: string;
  started_at: string | null;
  completed_at: string | null;
  failure_reason: string | null;
  notes: string | null;
  cash_collected: number;
  delivery_person?: Pick<Profile, "id" | "full_name" | "phone"> | null;
  order?: Order | null;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  shop_name: string | null;
  address: string | null;
  lat: number;
  lng: number;
  notes: string | null;
  status: OrderStatus;
  payment_method: string;
  payment_status: "unpaid" | "partial" | "paid" | "refunded";
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  total_cost: number;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
  delivered_at: string | null;
  order_items?: OrderItem[];
  deliveries?: Delivery[] | Delivery | null;
}

export interface Payment {
  id: string;
  order_id: string;
  amount: number;
  method: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
  order?: Pick<Order, "id" | "order_number" | "customer_name"> | null;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string | null;
  expense_date: string;
  created_at: string;
}

export interface StoreSettings {
  id: number;
  warehouse_name: string;
  warehouse_address: string | null;
  warehouse_lat: number | null;
  warehouse_lng: number | null;
  updated_at: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface CartItem {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  size: string | null;
  color: string | null;
  price: number;
  quantity: number;
  moq: number;
  stock: number;
  unit: string;
}
