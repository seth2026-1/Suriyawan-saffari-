-- =====================================================
-- SURIYAWAN SAFFARI - COMPLETE DATABASE SCHEMA
-- =====================================================
-- This schema includes 30+ tables for:
-- Customers, Sellers, Riders, Hub Managers, Admin, Owner
-- Products, Categories, Tags, Orders, Cart, Wishlist
-- Services, Logistics, Shipment Tracking, Returns, Exchanges
-- Payouts, Wallet, Reviews, Coupons, Support Tickets
-- Barcodes, Invoices, Labels
-- =====================================================

-- =====================================================
-- EXTENSIONS
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- SEQUENCES FOR ID GENERATION
-- =====================================================

CREATE SEQUENCE IF NOT EXISTS cust_seq START 1;
CREATE SEQUENCE IF NOT EXISTS seller_seq START 1;
CREATE SEQUENCE IF NOT EXISTS rider_seq START 1;
CREATE SEQUENCE IF NOT EXISTS hub_seq START 1;
CREATE SEQUENCE IF NOT EXISTS admin_seq START 1;
CREATE SEQUENCE IF NOT EXISTS prod_seq START 1;
CREATE SEQUENCE IF NOT EXISTS order_seq START 1;
CREATE SEQUENCE IF NOT EXISTS tracking_seq START 1;
CREATE SEQUENCE IF NOT EXISTS serv_seq START 1;
CREATE SEQUENCE IF NOT EXISTS run_seq START 1;
CREATE SEQUENCE IF NOT EXISTS return_seq START 1;
CREATE SEQUENCE IF NOT EXISTS exchange_seq START 1;
CREATE SEQUENCE IF NOT EXISTS ticket_seq START 1;
CREATE SEQUENCE IF NOT EXISTS payout_seq START 1;
CREATE SEQUENCE IF NOT EXISTS bag_seq START 1;
CREATE SEQUENCE IF NOT EXISTS manifest_seq START 1;
CREATE SEQUENCE IF NOT EXISTS lr_seq START 1;

-- =====================================================
-- 1. USER TABLES (6 IDs)
-- =====================================================

-- Customers Table
CREATE TABLE IF NOT EXISTS customers (
    cust_id TEXT PRIMARY KEY DEFAULT ('CUST' || to_char(CURRENT_DATE, 'YYYYMMDD') || lpad(nextval('cust_seq')::text, 4, '0')),
    email TEXT UNIQUE NOT NULL,
    mobile TEXT NOT NULL,
    name TEXT NOT NULL,
    photo TEXT,
    dob DATE,
    gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
    fingerprint_data TEXT,
    trust_score INTEGER DEFAULT 100,
    cod_status TEXT DEFAULT 'ACTIVE' CHECK (cod_status IN ('ACTIVE', 'BLOCKED')),
    cod_block_reason TEXT,
    cod_block_until DATE,
    wallet_balance INTEGER DEFAULT 0,
    coins INTEGER DEFAULT 0,
    referral_code TEXT UNIQUE,
    referred_by TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Sellers Table
CREATE TABLE IF NOT EXISTS sellers (
    seller_id TEXT PRIMARY KEY DEFAULT ('SELL' || to_char(CURRENT_DATE, 'YYYYMMDD') || lpad(nextval('seller_seq')::text, 4, '0')),
    email TEXT UNIQUE NOT NULL,
    mobile TEXT NOT NULL,
    shop_name TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    upi_id TEXT NOT NULL,
    gst_number TEXT,
    pan_number TEXT,
    kyc_status TEXT DEFAULT 'PENDING' CHECK (kyc_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    kyc_documents JSONB,
    commission_rate INTEGER DEFAULT 10,
    trust_score INTEGER DEFAULT 100,
    rating DECIMAL(3,2) DEFAULT 0,
    total_sales INTEGER DEFAULT 0,
    wallet_balance INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Riders Table
CREATE TABLE IF NOT EXISTS riders (
    rider_id TEXT PRIMARY KEY DEFAULT ('RIDE' || to_char(CURRENT_DATE, 'YYYYMMDD') || lpad(nextval('rider_seq')::text, 4, '0')),
    email TEXT UNIQUE NOT NULL,
    mobile TEXT NOT NULL,
    name TEXT NOT NULL,
    upi_id TEXT NOT NULL,
    dl_number TEXT,
    rc_number TEXT,
    aadhar TEXT,
    fingerprint_data TEXT,
    assigned_area TEXT,
    assigned_pincodes TEXT[],
    rate_per_parcel INTEGER DEFAULT 18,
    pickup_rate INTEGER DEFAULT 10,
    service_rate INTEGER DEFAULT 50,
    is_active BOOLEAN DEFAULT true,
    is_online BOOLEAN DEFAULT false,
    rating DECIMAL(3,2) DEFAULT 0,
    total_deliveries INTEGER DEFAULT 0,
    total_pickups INTEGER DEFAULT 0,
    wallet_balance INTEGER DEFAULT 0,
    current_location JSONB,
    last_location_update TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Hub Managers Table
CREATE TABLE IF NOT EXISTS hub_managers (
    hub_id TEXT PRIMARY KEY DEFAULT ('HUB' || to_char(CURRENT_DATE, 'YYYYMMDD') || lpad(nextval('hub_seq')::text, 4, '0')),
    email TEXT UNIQUE NOT NULL,
    mobile TEXT NOT NULL,
    name TEXT NOT NULL,
    assigned_zone TEXT,
    assigned_pincodes TEXT[],
    fingerprint_data TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Admin Users Table (Staff)
CREATE TABLE IF NOT EXISTS admin_users (
    admin_id TEXT PRIMARY KEY DEFAULT ('ADM' || to_char(CURRENT_DATE, 'YYYYMMDD') || lpad(nextval('admin_seq')::text, 4, '0')),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    role TEXT CHECK (role IN ('SUPER_ADMIN', 'SUPPORT', 'ACCOUNTANT', 'WAREHOUSE')),
    permissions JSONB,
    fingerprint_data TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Owner Table (Single - Fixed)
CREATE TABLE IF NOT EXISTS owner (
    owner_id TEXT PRIMARY KEY DEFAULT 'OWN001',
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    upi_id TEXT,
    fingerprint_data TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert Owner (Run once)
INSERT INTO owner (owner_id, email, name, mobile) 
VALUES ('OWN001', 'owner@suriyawansaffari.com', 'Suriyawan Saffari Admin', '9876543210')
ON CONFLICT (owner_id) DO NOTHING;

-- =====================================================
-- 2. PRODUCT & CATALOG TABLES
-- =====================================================

-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
    cat_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    icon TEXT,
    image TEXT,
    parent_id INTEGER REFERENCES categories(cat_id),
    commission_rate INTEGER,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert Main Categories
INSERT INTO categories (name, slug, icon, sort_order) VALUES
('Electronics & Gadgets', 'electronics', 'fa-solid fa-laptop', 1),
('Fashion & Apparel', 'fashion', 'fa-solid fa-shirt', 2),
('Home & Kitchen', 'home-kitchen', 'fa-solid fa-house', 3),
('Beauty & Personal Care', 'beauty', 'fa-solid fa-spa', 4),
('Groceries & Essentials', 'groceries', 'fa-solid fa-basket-shopping', 5),
('Others', 'others', 'fa-solid fa-ellipsis', 6)
ON CONFLICT (slug) DO NOTHING;

-- Insert Sub-Categories
INSERT INTO categories (name, slug, parent_id, sort_order) VALUES
-- Electronics Sub-categories
('Mobiles', 'mobiles', 1, 1),
('Laptops & Computers', 'laptops', 1, 2),
('Audio', 'audio', 1, 3),
('Cameras', 'cameras', 1, 4),
-- Fashion Sub-categories
("Men's Wear", 'mens-wear', 2, 1),
("Women's Wear", 'womens-wear', 2, 2),
('Footwear', 'footwear', 2, 3),
('Accessories', 'accessories', 2, 4),
-- Home Sub-categories
('Appliances', 'appliances', 3, 1),
('Furniture', 'furniture', 3, 2),
('Kitchenware', 'kitchenware', 3, 3),
('Home Decor', 'home-decor', 3, 4),
-- Beauty Sub-categories
('Skincare', 'skincare', 4, 1),
('Haircare', 'haircare', 4, 2),
('Makeup', 'makeup', 4, 3),
('Grooming', 'grooming', 4, 4),
-- Groceries Sub-categories
('Daily Needs', 'daily-needs', 5, 1),
('Snacks & Beverages', 'snacks-beverages', 5, 2),
('Cleaning', 'cleaning', 5, 3),
-- Others Sub-categories
('Books & Stationery', 'books-stationery', 6, 1),
('Sports & Fitness', 'sports-fitness', 6, 2),
('Toys & Baby Care', 'toys-baby', 6, 3)
ON CONFLICT (slug) DO NOTHING;

-- Products Table
CREATE TABLE IF NOT EXISTS products (
    prod_id TEXT PRIMARY KEY DEFAULT ('PROD' || to_char(CURRENT_DATE, 'YYYYMMDD') || lpad(nextval('prod_seq')::text, 4, '0')),
    seller_id TEXT REFERENCES sellers(seller_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    short_description TEXT,
    mrp INTEGER NOT NULL,
    selling_price INTEGER NOT NULL,
    flash_price INTEGER,
    flash_start TIMESTAMP,
    flash_end TIMESTAMP,
    stock INTEGER DEFAULT 0,
    category_id INTEGER REFERENCES categories(cat_id),
    sub_category_id INTEGER REFERENCES categories(cat_id),
    tags TEXT[],
    images TEXT[],
    video_url TEXT,
    specifications JSONB,
    is_cod_available BOOLEAN DEFAULT true,
    min_cod_amount INTEGER DEFAULT 200,
    is_active BOOLEAN DEFAULT true,
    is_approved BOOLEAN DEFAULT false,
    rating DECIMAL(3,2) DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    total_sold INTEGER DEFAULT 0,
    total_views INTEGER DEFAULT 0,
    barcode TEXT,
    qr_code TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Product Variations Table
CREATE TABLE IF NOT EXISTS product_variations (
    var_id SERIAL PRIMARY KEY,
    prod_id TEXT REFERENCES products(prod_id) ON DELETE CASCADE,
    size TEXT,
    color TEXT,
    material TEXT,
    sku TEXT UNIQUE,
    stock INTEGER DEFAULT 0,
    price_adjustment INTEGER DEFAULT 0,
    barcode TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Product Tags Table (40+ Tags)
CREATE TABLE IF NOT EXISTS product_tags (
    tag_id SERIAL PRIMARY KEY,
    tag_name TEXT UNIQUE NOT NULL,
    category TEXT CHECK (category IN ('attractive', 'premium', 'trendy', 'bonus')),
    icon TEXT,
    is_active BOOLEAN DEFAULT true
);

-- Insert 40 Tags
INSERT INTO product_tags (tag_name, category) VALUES
-- Top Attractive Tags (1-10)
('Hot', 'attractive'), ('Fabulous', 'attractive'), ('Super', 'attractive'),
('Epic', 'attractive'), ('Awesome', 'attractive'), ('Amazing', 'attractive'),
('Stunning', 'attractive'), ('Gorgeous', 'attractive'), ('Breathtaking', 'attractive'),
('Mind-blowing', 'attractive'),
-- Premium & Luxurious Tags (11-20)
('Luxury', 'premium'), ('Premium', 'premium'), ('Exclusive', 'premium'),
('Elite', 'premium'), ('Signature', 'premium'), ('Ultimate', 'premium'),
('Legendary', 'premium'), ('Royal', 'premium'), ('Divine', 'premium'),
('Celestial', 'premium'),
-- Trendy & Energetic Tags (21-30)
('Viral', 'trendy'), ('Trending', 'trendy'), ('Fire', 'trendy'),
('Slay', 'trendy'), ('Glow', 'trendy'), ('Boss', 'trendy'),
('Iconic', 'trendy'), ('Unreal', 'trendy'), ('Next Level', 'trendy'),
('Obsessed', 'trendy'),
-- Bonus Extra Catchy Tags (31-40)
('Must-Have', 'bonus'), ('Game Changer', 'bonus'), ('Showstopper', 'bonus'),
('Dazzling', 'bonus'), ('Irresistible', 'bonus'), ('Spellbinding', 'bonus'),
('Radiant', 'bonus'), ('Flawless', 'bonus'), ('Killer', 'bonus'),
('Sizzling', 'bonus')
ON CONFLICT (tag_name) DO NOTHING;

-- =====================================================
-- 3. ORDER & TRANSACTION TABLES
-- =====================================================

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
    book_id TEXT PRIMARY KEY DEFAULT ('BOOK' || to_char(CURRENT_DATE, 'YYYYMMDD') || lpad(nextval('order_seq')::text, 4, '0')),
    cust_id TEXT REFERENCES customers(cust_id) ON DELETE CASCADE,
    seller_id TEXT REFERENCES sellers(seller_id) ON DELETE CASCADE,
    tracking_id TEXT UNIQUE DEFAULT ('SS' || to_char(CURRENT_DATE, 'YYYYMMDD') || lpad(nextval('tracking_seq')::text, 12, '0')),
    cancel_code TEXT UNIQUE DEFAULT floor(random() * 900000 + 100000)::text,
    cancel_code_expiry TIMESTAMP DEFAULT (NOW() + INTERVAL '48 hours'),
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RTO')),
    total_amount INTEGER NOT NULL,
    delivery_charge INTEGER DEFAULT 40,
    discount_amount INTEGER DEFAULT 0,
    final_amount INTEGER NOT NULL,
    payment_method TEXT DEFAULT 'COD',
    address JSONB NOT NULL,
    rider_id TEXT REFERENCES riders(rider_id),
    awb_barcode TEXT,
    qr_code TEXT,
    invoice_barcode TEXT,
    placed_at TIMESTAMP DEFAULT NOW(),
    accepted_at TIMESTAMP,
    packed_at TIMESTAMP,
    shipped_at TIMESTAMP,
    out_for_delivery_at TIMESTAMP,
    delivered_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    rto_at TIMESTAMP,
    cancel_reason TEXT,
    cancel_code_used_by TEXT,
    cancel_code_used_at TIMESTAMP
);

-- Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
    item_id SERIAL PRIMARY KEY,
    book_id TEXT REFERENCES orders(book_id) ON DELETE CASCADE,
    prod_id TEXT REFERENCES products(prod_id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    price_at_time INTEGER NOT NULL,
    variation_id INTEGER REFERENCES product_variations(var_id),
    product_snapshot JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 4. CART & WISHLIST
-- =====================================================

-- Cart Table
CREATE TABLE IF NOT EXISTS cart (
    cart_id SERIAL PRIMARY KEY,
    cust_id TEXT REFERENCES customers(cust_id) ON DELETE CASCADE,
    prod_id TEXT REFERENCES products(prod_id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    variation_id INTEGER REFERENCES product_variations(var_id),
    added_at TIMESTAMP DEFAULT NOW()
);

-- Wishlist Table
CREATE TABLE IF NOT EXISTS wishlist (
    wish_id SERIAL PRIMARY KEY,
    cust_id TEXT REFERENCES customers(cust_id) ON DELETE CASCADE,
    prod_id TEXT REFERENCES products(prod_id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(cust_id, prod_id)
);

-- =====================================================
-- 5. SERVICES TABLE (13 Services)
-- =====================================================

CREATE TABLE IF NOT EXISTS services (
    serv_id TEXT PRIMARY KEY DEFAULT ('SERV' || to_char(CURRENT_DATE, 'YYYYMMDD') || lpad(nextval('serv_seq')::text, 4, '0')),
    cust_id TEXT REFERENCES customers(cust_id) ON DELETE CASCADE,
    seller_id TEXT REFERENCES sellers(seller_id),
    service_type TEXT NOT NULL CHECK (service_type IN (
        'vehicle_booking', 'other_booking', 'breakfast_drink', 'send_product',
        'shadi_card', 'suriyawan_special', 'ac_repair', 'painter',
        'electrician', 'plumber', 'car_wash', 'mehndi', 'catering'
    )),
    service_name TEXT,
    cancel_code TEXT UNIQUE DEFAULT floor(random() * 900000 + 100000)::text,
    cancel_code_expiry TIMESTAMP DEFAULT (NOW() + INTERVAL '48 hours'),
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    token_amount INTEGER DEFAULT 100,
    balance_amount INTEGER,
    total_amount INTEGER,
    scheduled_date DATE,
    scheduled_time TEXT,
    address JSONB,
    expert_id TEXT,
    problem_description TEXT,
    problem_photos TEXT[],
    before_photos TEXT[],
    after_photos TEXT[],
    rating INTEGER,
    review TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    accepted_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP
);

-- =====================================================
-- 6. LOGISTICS TABLES
-- =====================================================

-- Runsheet Table
CREATE TABLE IF NOT EXISTS runsheets (
    run_id TEXT PRIMARY KEY DEFAULT ('RUN' || to_char(CURRENT_DATE, 'YYYYMMDD') || lpad(nextval('run_seq')::text, 4, '0')),
    hub_id TEXT REFERENCES hub_managers(hub_id),
    rider_id TEXT REFERENCES riders(rider_id),
    shift TEXT CHECK (shift IN ('MORNING', 'EVENING', 'NIGHT')),
    date DATE DEFAULT CURRENT_DATE,
    route_data JSONB,
    pickup_orders TEXT[],
    delivery_orders TEXT[],
    total_pickups INTEGER DEFAULT 0,
    total_deliveries INTEGER DEFAULT 0,
    total_cod INTEGER DEFAULT 0,
    estimated_distance INTEGER,
    estimated_time INTEGER,
    status TEXT DEFAULT 'ASSIGNED' CHECK (status IN ('ASSIGNED', 'ACCEPTED', 'STARTED', 'COMPLETED', 'CANCELLED')),
    accepted_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by TEXT
);

-- Bags Table (50 packets = 1 bag)
CREATE TABLE IF NOT EXISTS bags (
    bag_id TEXT PRIMARY KEY DEFAULT ('BAG' || to_char(CURRENT_DATE, 'YYYYMMDD') || lpad(nextval('bag_seq')::text, 6, '0')),
    seal_number TEXT UNIQUE,
    order_ids TEXT[],
    awb_numbers TEXT[],
    packet_count INTEGER DEFAULT 0,
    total_weight DECIMAL(10,2),
    from_hub TEXT,
    to_hub TEXT,
    status TEXT DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'IN_TRANSIT', 'RECEIVED', 'OPENED')),
    seal_photo TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    received_at TIMESTAMP,
    opened_at TIMESTAMP
);

-- LR Number (Truck Tracking)
CREATE TABLE IF NOT EXISTS lr_numbers (
    lr_id TEXT PRIMARY KEY DEFAULT ('LR' || to_char(CURRENT_DATE, 'YYYYMMDD') || lpad(nextval('lr_seq')::text, 8, '0')),
    eway_bill_number TEXT,
    from_hub TEXT,
    to_hub TEXT,
    bag_ids TEXT[],
    truck_number TEXT,
    driver_name TEXT,
    driver_mobile TEXT,
    status TEXT DEFAULT 'DISPATCHED',
    dispatched_at TIMESTAMP,
    expected_arrival TIMESTAMP,
    arrived_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Manifest Table
CREATE TABLE IF NOT EXISTS manifests (
    manifest_id TEXT PRIMARY KEY DEFAULT ('MNF' || to_char(CURRENT_DATE, 'YYYYMMDD') || lpad(nextval('manifest_seq')::text, 8, '0')),
    type TEXT CHECK (type IN ('PICKUP', 'DELIVERY')),
    run_id TEXT REFERENCES runsheets(run_id),
    order_ids TEXT[],
    seller_sign BOOLEAN DEFAULT false,
    rider_sign BOOLEAN DEFAULT false,
    hub_sign BOOLEAN DEFAULT false,
    printed_at TIMESTAMP DEFAULT NOW(),
    signed_at TIMESTAMP
);

-- Shipment Tracking
CREATE TABLE IF NOT EXISTS shipment_tracking (
    track_id SERIAL PRIMARY KEY,
    book_id TEXT REFERENCES orders(book_id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    location TEXT,
    lat DECIMAL(10,8),
    lng DECIMAL(11,8),
    rider_id TEXT REFERENCES riders(rider_id),
    hub_id TEXT REFERENCES hub_managers(hub_id),
    notes TEXT,
    photo TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 7. RETURNS & EXCHANGE
-- =====================================================

-- Returns Table (Same Time Return)
CREATE TABLE IF NOT EXISTS returns (
    return_id TEXT PRIMARY KEY DEFAULT ('RET' || to_char(CURRENT_DATE, 'YYYYMMDD') || lpad(nextval('return_seq')::text, 4, '0')),
    book_id TEXT REFERENCES orders(book_id) ON DELETE CASCADE,
    prod_id TEXT REFERENCES products(prod_id),
    reason TEXT NOT NULL,
    reason_detail TEXT,
    product_photo TEXT,
    product_video TEXT,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED')),
    refund_amount INTEGER,
    rider_id TEXT REFERENCES riders(rider_id),
    picked_up_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Exchanges Table
CREATE TABLE IF NOT EXISTS exchanges (
    exchange_id TEXT PRIMARY KEY DEFAULT ('EXCH' || to_char(CURRENT_DATE, 'YYYYMMDD') || lpad(nextval('exchange_seq')::text, 4, '0')),
    old_book_id TEXT REFERENCES orders(book_id),
    new_book_id TEXT REFERENCES orders(book_id),
    old_prod_id TEXT REFERENCES products(prod_id),
    new_prod_id TEXT REFERENCES products(prod_id),
    price_difference INTEGER,
    reason TEXT,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'COMPLETED', 'REJECTED')),
    rider_id TEXT REFERENCES riders(rider_id),
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- =====================================================
-- 8. SUPPORT TICKETS
-- =====================================================

CREATE TABLE IF NOT EXISTS support_tickets (
    ticket_id TEXT PRIMARY KEY DEFAULT ('TKT' || to_char(CURRENT_DATE, 'YYYYMMDD') || lpad(nextval('ticket_seq')::text, 4, '0')),
    user_id TEXT NOT NULL,
    user_type TEXT CHECK (user_type IN ('customer', 'seller', 'rider')),
    user_name TEXT,
    user_email TEXT,
    user_mobile TEXT,
    category TEXT NOT NULL,
    priority TEXT DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    subject TEXT,
    message TEXT NOT NULL,
    photo TEXT,
    status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
    assigned_to TEXT,
    sla_deadline TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours'),
    resolution TEXT,
    resolved_at TIMESTAMP,
    closed_at TIMESTAMP,
    rating INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 9. PAYOUTS & WALLET
-- =====================================================

-- Payouts Table
CREATE TABLE IF NOT EXISTS payouts (
    payout_id TEXT PRIMARY KEY DEFAULT ('PAY' || to_char(CURRENT_DATE, 'YYYYMMDD') || lpad(nextval('payout_seq')::text, 4, '0')),
    user_id TEXT NOT NULL,
    user_type TEXT CHECK (user_type IN ('seller', 'rider')),
    amount INTEGER NOT NULL,
    upi_id TEXT,
    utr_number TEXT,
    tds_amount INTEGER DEFAULT 0,
    gst_amount INTEGER DEFAULT 0,
    net_amount INTEGER,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    bank_reference TEXT,
    notes TEXT,
    requested_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP,
    completed_at TIMESTAMP,
    failed_reason TEXT
);

-- Wallet Transactions
CREATE TABLE IF NOT EXISTS wallet_transactions (
    trans_id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_type TEXT CHECK (user_type IN ('customer', 'seller', 'rider')),
    amount INTEGER NOT NULL,
    type TEXT CHECK (type IN ('credit', 'debit')),
    reason TEXT,
    reference_id TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Coins Transactions
CREATE TABLE IF NOT EXISTS coin_transactions (
    trans_id SERIAL PRIMARY KEY,
    cust_id TEXT REFERENCES customers(cust_id) ON DELETE CASCADE,
    coins INTEGER NOT NULL,
    type TEXT CHECK (type IN ('credit', 'debit')),
    reason TEXT,
    reference_id TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 10. REVIEWS & RATINGS
-- =====================================================

CREATE TABLE IF NOT EXISTS reviews (
    review_id SERIAL PRIMARY KEY,
    cust_id TEXT REFERENCES customers(cust_id) ON DELETE CASCADE,
    prod_id TEXT REFERENCES products(prod_id) ON DELETE CASCADE,
    order_id TEXT REFERENCES orders(book_id),
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    title TEXT,
    comment TEXT,
    photo TEXT,
    video TEXT,
    is_verified BOOLEAN DEFAULT false,
    likes INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Seller Reviews
CREATE TABLE IF NOT EXISTS seller_reviews (
    review_id SERIAL PRIMARY KEY,
    cust_id TEXT REFERENCES customers(cust_id),
    seller_id TEXT REFERENCES sellers(seller_id),
    order_id TEXT REFERENCES orders(book_id),
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Rider Reviews
CREATE TABLE IF NOT EXISTS rider_reviews (
    review_id SERIAL PRIMARY KEY,
    cust_id TEXT REFERENCES customers(cust_id),
    rider_id TEXT REFERENCES riders(rider_id),
    order_id TEXT REFERENCES orders(book_id),
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 11. COUPONS & OFFERS
-- =====================================================

CREATE TABLE IF NOT EXISTS coupons (
    coupon_id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value INTEGER NOT NULL,
    min_order INTEGER DEFAULT 0,
    max_discount INTEGER,
    applicable_categories INTEGER[],
    applicable_sellers TEXT[],
    start_date DATE,
    expiry_date DATE,
    usage_limit INTEGER,
    used_count INTEGER DEFAULT 0,
    per_user_limit INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- User Coupons (Used/Claimed)
CREATE TABLE IF NOT EXISTS user_coupons (
    id SERIAL PRIMARY KEY,
    coupon_id INTEGER REFERENCES coupons(coupon_id),
    user_id TEXT,
    used_at TIMESTAMP,
    order_id TEXT
);

-- =====================================================
-- 12. REFERRALS
-- =====================================================

CREATE TABLE IF NOT EXISTS referrals (
    referral_id SERIAL PRIMARY KEY,
    referrer_cust_id TEXT REFERENCES customers(cust_id),
    referred_cust_id TEXT REFERENCES customers(cust_id),
    referred_email TEXT,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ORDERED', 'COMPLETED')),
    reward_given BOOLEAN DEFAULT false,
    reward_amount INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- =====================================================
-- 13. NOTIFICATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS notifications (
    notif_id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_type TEXT CHECK (user_type IN ('customer', 'seller', 'rider', 'hub', 'all')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT CHECK (type IN ('order', 'payment', 'delivery', 'promotion', 'alert', 'system')),
    data JSONB,
    is_read BOOLEAN DEFAULT false,
    is_sent BOOLEAN DEFAULT false,
    sent_via TEXT[],
    created_at TIMESTAMP DEFAULT NOW(),
    read_at TIMESTAMP
);

-- =====================================================
-- 14. SYSTEM SETTINGS
-- =====================================================

CREATE TABLE IF NOT EXISTS system_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT,
    setting_type TEXT DEFAULT 'string',
    description TEXT,
    updated_by TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert Default Settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
('cod_min_amount', '200', 'number', 'Minimum COD amount'),
('cod_max_amount', '50000', 'number', 'Maximum COD amount'),
('cod_block_fine', '100', 'number', 'Fine for COD block unblock'),
('cod_block_days', '30', 'number', 'COD block duration in days'),
('delivery_charge', '40', 'number', 'Standard delivery charge'),
('free_delivery_min', '499', 'number', 'Minimum order for free delivery'),
('rider_rate_per_parcel', '18', 'number', 'Rider earning per delivery'),
('rider_pickup_rate', '10', 'number', 'Rider earning per pickup'),
('rider_service_rate', '50', 'number', 'Rider earning per service'),
('default_commission', '10', 'number', 'Default seller commission percentage'),
('gst_percentage', '18', 'number', 'GST percentage'),
('tds_percentage', '1', 'number', 'TDS percentage'),
('trust_score_order_bonus', '5', 'number', 'Trust score bonus per order'),
('trust_score_rto_penalty', '-20', 'number', 'Trust score penalty for RTO'),
('trust_score_return_penalty', '-5', 'number', 'Trust score penalty for return'),
('cancel_code_expiry_hours', '48', 'number', 'Cancel code expiry in hours'),
('max_refer_per_day', '5', 'number', 'Maximum referrals per day'),
('refer_earn_amount', '10', 'number', 'Amount earned per referral'),
('coins_per_review', '10', 'number', 'Coins earned per review'),
('coins_order_percent', '2', 'number', 'Coins percentage on orders'),
('customer_care_number', '1800-xxx-xxx', 'string', 'Customer care phone number'),
('customer_care_email', 'support@suriyawansaffari.com', 'string', 'Customer care email'),
('customer_care_whatsapp', '91xxxxxxxxxx', 'string', 'Customer care WhatsApp'),
('app_name', 'Suriyawan Saffari', 'string', 'Application name'),
('app_version', '1.0.0', 'string', 'Application version'),
('maintenance_mode', 'false', 'boolean', 'Maintenance mode status'),
('return_policy', 'Same time return only. Customer must check product in front of rider.', 'text', 'Return policy'),
('open_box_delivery', 'true', 'boolean', 'Open box delivery mandatory')
ON CONFLICT (setting_key) DO NOTHING;

-- =====================================================
-- 15. BARCODE & LABEL TABLES
-- =====================================================

-- Barcode Logs (for tracking scans)
CREATE TABLE IF NOT EXISTS barcode_scans (
    scan_id SERIAL PRIMARY KEY,
    barcode TEXT NOT NULL,
    barcode_type TEXT CHECK (barcode_type IN ('PROD', 'BOOK', 'AWB', 'CANCEL', 'INVOICE', 'RETURN', 'EXCHANGE')),
    scanned_by TEXT,
    scanned_by_type TEXT CHECK (scanned_by_type IN ('customer', 'seller', 'rider', 'hub', 'owner')),
    location TEXT,
    lat DECIMAL(10,8),
    lng DECIMAL(11,8),
    device_info JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Labels for printing
CREATE TABLE IF NOT EXISTS shipping_labels (
    label_id SERIAL PRIMARY KEY,
    book_id TEXT REFERENCES orders(book_id),
    label_data TEXT,
    label_barcode TEXT,
    printed_by TEXT,
    printed_at TIMESTAMP DEFAULT NOW(),
    print_count INTEGER DEFAULT 1
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
    invoice_id TEXT PRIMARY KEY DEFAULT ('INV' || to_char(CURRENT_DATE, 'YYYYMMDD') || lpad(nextval('order_seq')::text, 8, '0')),
    book_id TEXT REFERENCES orders(book_id) UNIQUE,
    invoice_number TEXT UNIQUE,
    invoice_barcode TEXT,
    invoice_data JSONB,
    pdf_url TEXT,
    generated_at TIMESTAMP DEFAULT NOW(),
    downloaded_at TIMESTAMP,
    emailed_to TEXT,
    email_sent BOOLEAN DEFAULT false
);

-- =====================================================
-- 16. INDEXES FOR PERFORMANCE
-- =====================================================

-- Customer indexes
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile);
CREATE INDEX IF NOT EXISTS idx_customers_cod_status ON customers(cod_status);

-- Seller indexes
CREATE INDEX IF NOT EXISTS idx_sellers_email ON sellers(email);
CREATE INDEX IF NOT EXISTS idx_sellers_kyc_status ON sellers(kyc_status);

-- Rider indexes
CREATE INDEX IF NOT EXISTS idx_riders_email ON riders(email);
CREATE INDEX IF NOT EXISTS idx_riders_assigned_area ON riders(assigned_area);

-- Product indexes
CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);

-- Order indexes
CREATE INDEX IF NOT EXISTS idx_orders_cust_id ON orders(cust_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_placed_at ON orders(placed_at);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_id ON orders(tracking_id);
CREATE INDEX IF NOT EXISTS idx_orders_cancel_code ON orders(cancel_code);

-- Cart indexes
CREATE INDEX IF NOT EXISTS idx_cart_cust_id ON cart(cust_id);

-- Wishlist indexes
CREATE INDEX IF NOT EXISTS idx_wishlist_cust_id ON wishlist(cust_id);

-- Shipment tracking indexes
CREATE INDEX IF NOT EXISTS idx_tracking_book_id ON shipment_tracking(book_id);
CREATE INDEX IF NOT EXISTS idx_tracking_status ON shipment_tracking(status);

-- Support tickets indexes
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- Barcode scans indexes
CREATE INDEX IF NOT EXISTS idx_barcode_scans_barcode ON barcode_scans(barcode);
CREATE INDEX IF NOT EXISTS idx_barcode_scans_created_at ON barcode_scans(created_at);

-- =====================================================
-- 17. AUTO-UPDATE FUNCTIONS & TRIGGERS
-- =====================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to tables
CREATE