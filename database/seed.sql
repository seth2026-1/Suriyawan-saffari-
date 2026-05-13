-- =====================================================
-- SURIYAWAN SAFFARI - SEED DATA
-- =====================================================
-- Initial data for:
-- Categories, Tags, System Settings
-- Sample Products, Sample Customers, Sample Sellers
-- Sample Riders, Sample Orders
-- =====================================================

-- =====================================================
-- 1. INSERT OWNER (FIXED - SINGLE)
-- =====================================================

INSERT INTO owner (owner_id, email, name, mobile, upi_id) 
VALUES ('OWN001', 'owner@suriyawansaffari.com', 'Suriyawan Saffari Admin', '9876543210', 'owner@ybl')
ON CONFLICT (owner_id) DO NOTHING;

-- =====================================================
-- 2. INSERT SAMPLE ADMIN USERS
-- =====================================================

INSERT INTO admin_users (admin_id, email, name, mobile, role, permissions) 
VALUES 
    ('ADM202605080001', 'support@suriyawansaffari.com', 'Support Team', '9876543211', 'SUPPORT', '{"support": true, "tickets": true}'),
    ('ADM202605080002', 'accounts@suriyawansaffari.com', 'Accounts Team', '9876543212', 'ACCOUNTANT', '{"finance": true, "payouts": true}')
ON CONFLICT (admin_id) DO NOTHING;

-- =====================================================
-- 3. INSERT SAMPLE CUSTOMERS
-- =====================================================

INSERT INTO customers (cust_id, email, mobile, name, trust_score, wallet_balance, coins) 
VALUES 
    ('CUST202605080001', 'rahul@example.com', '9876543210', 'Rahul Kumar', 120, 500, 50),
    ('CUST202605080002', 'priya@example.com', '9876543211', 'Priya Sharma', 95, 200, 25),
    ('CUST202605080003', 'amit@example.com', '9876543212', 'Amit Verma', 80, 100, 10)
ON CONFLICT (cust_id) DO NOTHING;

-- =====================================================
-- 4. INSERT SAMPLE SELLERS
-- =====================================================

INSERT INTO sellers (seller_id, email, mobile, shop_name, owner_name, upi_id, gst_number, kyc_status, commission_rate, rating) 
VALUES 
    ('SELL202605080001', 'electronics@example.com', '9876543213', 'ElectroHub', 'Rajesh Singh', 'electro@ybl', 'GST123456789', 'APPROVED', 10, 4.5),
    ('SELL202605080002', 'fashion@example.com', '9876543214', 'Fashion Street', 'Meena Gupta', 'fashion@ybl', 'GST987654321', 'APPROVED', 12, 4.8),
    ('SELL202605080003', 'home@example.com', '9876543215', 'Home Decor Co.', 'Suresh Patel', 'home@ybl', NULL, 'PENDING', 10, 0)
ON CONFLICT (seller_id) DO NOTHING;

-- =====================================================
-- 5. INSERT SAMPLE RIDERS
-- =====================================================

INSERT INTO riders (rider_id, email, mobile, name, upi_id, dl_number, assigned_area, assigned_pincodes, rate_per_parcel, is_active, is_online, rating) 
VALUES 
    ('RIDE202605080001', 'rider1@example.com', '9876543216', 'Rohan Singh', 'rider1@ybl', 'DL123456', 'Bhadohi', ARRAY['221404', '221405'], 18, true, true, 4.7),
    ('RIDE202605080002', 'rider2@example.com', '9876543217', 'Vikram Yadav', 'rider2@ybl', 'DL123457', 'Suriyawan', ARRAY['221406', '221407'], 18, true, false, 4.5)
ON CONFLICT (rider_id) DO NOTHING;

-- =====================================================
-- 6. INSERT SAMPLE HUB MANAGERS
-- =====================================================

INSERT INTO hub_managers (hub_id, email, mobile, name, assigned_zone, assigned_pincodes) 
VALUES 
    ('HUB202605080001', 'hub1@example.com', '9876543218', 'Amit K', 'Bhadohi Zone', ARRAY['221404', '221405', '221406']),
    ('HUB202605080002', 'hub2@example.com', '9876543219', 'Sunil R', 'Suriyawan Zone', ARRAY['221407', '221408', '221409'])
ON CONFLICT (hub_id) DO NOTHING;

-- =====================================================
-- 7. INSERT SAMPLE CATEGORIES (Already inserted in schema.sql)
-- =====================================================

-- Insert any missing categories
INSERT INTO categories (name, slug, icon, sort_order, is_active) 
SELECT name, slug, icon, sort_order, true FROM (VALUES
    ('Electronics & Gadgets', 'electronics', 'fa-solid fa-laptop', 1),
    ('Fashion & Apparel', 'fashion', 'fa-solid fa-shirt', 2),
    ('Home & Kitchen', 'home-kitchen', 'fa-solid fa-house', 3),
    ('Beauty & Personal Care', 'beauty', 'fa-solid fa-spa', 4),
    ('Groceries & Essentials', 'groceries', 'fa-solid fa-basket-shopping', 5),
    ('Others', 'others', 'fa-solid fa-ellipsis', 6)
) AS v(name, slug, icon, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = v.slug);

-- =====================================================
-- 8. INSERT SAMPLE PRODUCTS
-- =====================================================

INSERT INTO products (prod_id, seller_id, name, description, mrp, selling_price, stock, category_id, tags, images, is_active, is_approved, rating)
VALUES 
    ('PROD202605080001', 'SELL202605080001', 'Premium Wireless Headphones', 'Noise cancellation, 30hr battery life', 3999, 2999, 50, 1, ARRAY['Hot', 'Premium'], ARRAY['headphone1.jpg', 'headphone2.jpg'], true, true, 4.7),
    ('PROD202605080002', 'SELL202605080001', 'Smart Watch Pro', 'Fitness tracker, heart rate monitor', 5999, 4499, 30, 1, ARRAY['Trending', 'Viral'], ARRAY['watch1.jpg'], true, true, 4.5),
    ('PROD202605080003', 'SELL202605080002', 'Banarasi Silk Saree', 'Pure silk with golden zari work', 8999, 6499, 20, 2, ARRAY['Royal', 'Fabulous'], ARRAY['saree1.jpg', 'saree2.jpg'], true, true, 4.9),
    ('PROD202605080004', 'SELL202605080002', 'Men\'s Cotton Kurta', 'Handloom cotton, festival special', 1999, 1299, 100, 2, ARRAY['Trending', 'Awesome'], ARRAY['kurta1.jpg'], true, true, 4.6),
    ('PROD202605080005', 'SELL202605080003', 'Terracotta Diya Set', 'Handmade, set of 10', 999, 649, 200, 3, ARRAY['Hot', 'Gorgeous'], ARRAY['diya1.jpg'], true, false, 0)
ON CONFLICT (prod_id) DO NOTHING;

-- =====================================================
-- 9. INSERT SAMPLE ORDERS
-- =====================================================

INSERT INTO orders (book_id, cust_id, seller_id, tracking_id, cancel_code, status, total_amount, delivery_charge, final_amount, address, placed_at)
VALUES 
    ('BOOK202605080001', 'CUST202605080001', 'SELL202605080001', 'SS20260508000000000001', '123456', 'DELIVERED', 2999, 40, 3039, '{"name": "Rahul Kumar", "address": "123, Main Road", "city": "Bhadohi", "pincode": "221404"}', NOW() - INTERVAL '5 days'),
    ('BOOK202605080002', 'CUST202605080002', 'SELL202605080002', 'SS20260508000000000002', '234567', 'SHIPPED', 6499, 0, 6499, '{"name": "Priya Sharma", "address": "456, Gandhi Nagar", "city": "Suriyawan", "pincode": "221406"}', NOW() - INTERVAL '2 days'),
    ('BOOK202605080003', 'CUST202605080003', 'SELL202605080002', 'SS20260508000000000003', '345678', 'PENDING', 1299, 40, 1339, '{"name": "Amit Verma", "address": "789, Patel Nagar", "city": "Bhadohi", "pincode": "221404"}', NOW() - INTERVAL '1 day')
ON CONFLICT (book_id) DO NOTHING;

-- =====================================================
-- 10. INSERT ORDER ITEMS
-- =====================================================

INSERT INTO order_items (book_id, prod_id, quantity, price_at_time)
VALUES 
    ('BOOK202605080001', 'PROD202605080001', 1, 2999),
    ('BOOK202605080002', 'PROD202605080003', 1, 6499),
    ('BOOK202605080003', 'PROD202605080004', 1, 1299)
ON CONFLICT (item_id) DO NOTHING;

-- =====================================================
-- 11. INSERT SAMPLE REVIEWS
-- =====================================================

INSERT INTO reviews (cust_id, prod_id, order_id, rating, title, comment)
VALUES 
    ('CUST202605080001', 'PROD202605080001', 'BOOK202605080001', 5, 'Excellent product!', 'Great sound quality and battery life. Worth every penny.'),
    ('CUST202605080002', 'PROD202605080003', 'BOOK202605080002', 5, 'Beautiful saree', 'The quality is amazing. Exactly as shown in pictures.')
ON CONFLICT (review_id) DO NOTHING;

-- =====================================================
-- 12. INSERT SAMPLE WALLET TRANSACTIONS
-- =====================================================

INSERT INTO wallet_transactions (user_id, user_type, amount, type, reason)
VALUES 
    ('RIDE202605080001', 'rider', 18, 'credit', 'Delivery completed for order BOOK202605080001'),
    ('RIDE202605080001', 'rider', 18, 'credit', 'Delivery completed for order BOOK202605080002')
ON CONFLICT (trans_id) DO NOTHING;

-- =====================================================
-- 13. INSERT SAMPLE COUPONS
-- =====================================================

INSERT INTO coupons (code, discount_type, discount_value, min_order, max_discount, expiry_date, is_active)
VALUES 
    ('WELCOME50', 'percentage', 10, 500, 50, CURRENT_DATE + INTERVAL '30 days', true),
    ('SAVE100', 'fixed', 100, 1000, 100, CURRENT_DATE + INTERVAL '15 days', true),
    ('FREESHIP', 'percentage', 0, 499, 0, CURRENT_DATE + INTERVAL '60 days', true)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- 14. INSERT SAMPLE SUPPORT TICKETS
-- =====================================================

INSERT INTO support_tickets (ticket_id, user_id, user_type, user_name, user_email, category, subject, message, status)
VALUES 
    ('TKT202605080001', 'CUST202605080001', 'customer', 'Rahul Kumar', 'rahul@example.com', 'order', 'Late Delivery', 'My order is delayed. Please check.', 'RESOLVED'),
    ('TKT202605080002', 'SELL202605080001', 'seller', 'Rajesh Singh', 'electronics@example.com', 'payout', 'Payout pending', 'My payout is pending for 3 days.', 'OPEN')
ON CONFLICT (ticket_id) DO NOTHING;

-- =====================================================
-- 15. INSERT SAMPLE NOTIFICATIONS
-- =====================================================

INSERT INTO notifications (user_id, user_type, title, message, type, is_read)
VALUES 
    ('CUST202605080001', 'customer', 'Order Delivered', 'Your order BOOK202605080001 has been delivered', 'delivery', true),
    ('CUST202605080001', 'customer', 'Welcome Offer', 'Use code WELCOME50 for 10% off on your next order', 'promotion', false),
    ('SELL202605080001', 'seller', 'New Order', 'You have received a new order BOOK202605080003', 'order', false)
ON CONFLICT (notif_id) DO NOTHING;

-- =====================================================
-- 16. INSERT SAMPLE SHIPMENT TRACKING
-- =====================================================

INSERT INTO shipment_tracking (book_id, status, location, notes)
VALUES 
    ('BOOK202605080001', 'DELIVERED', 'Bhadohi', 'Delivered to customer at front door'),
    ('BOOK202605080002', 'SHIPPED', 'Suriyawan Hub', 'Package dispatched from hub'),
    ('BOOK202605080002', 'OUT_FOR_DELIVERY', 'Suriyawan', 'Rider assigned: Rohan Singh'),
    ('BOOK202605080003', 'PENDING', 'Seller Hub', 'Awaiting seller confirmation')
ON CONFLICT (track_id) DO NOTHING;

-- =====================================================
-- 17. INSERT SAMPLE RUNSHEETS
-- =====================================================

INSERT INTO runsheets (run_id, hub_id, rider_id, shift, date, pickup_orders, delivery_orders, total_pickups, total_deliveries, status)
VALUES 
    ('RUN202605080001', 'HUB202605080001', 'RIDE202605080001', 'MORNING', CURRENT_DATE, ARRAY['BOOK202605080001'], ARRAY['BOOK202605080002'], 1, 1, 'COMPLETED'),
    ('RUN202605080002', 'HUB202605080001', 'RIDE202605080001', 'EVENING', CURRENT_DATE, ARRAY['BOOK202605080003'], ARRAY[], 1, 0, 'ASSIGNED')
ON CONFLICT (run_id) DO NOTHING;

-- =====================================================
-- 18. UPDATE PRODUCT RATINGS (Based on reviews)
-- =====================================================

UPDATE products SET rating = 5.0, total_reviews = 1 WHERE prod_id = 'PROD202605080001';
UPDATE products SET rating = 5.0, total_reviews = 1 WHERE prod_id = 'PROD202605080003';

-- =====================================================
-- 19. UPDATE SELLER RATINGS
-- =====================================================

UPDATE sellers SET rating = 4.7 WHERE seller_id = 'SELL202605080001';
UPDATE sellers SET rating = 4.9 WHERE seller_id = 'SELL202605080002';

-- =====================================================
-- 20. INSERT SAMPLE SERVICE BOOKINGS
-- =====================================================

INSERT INTO services (serv_id, cust_id, service_type, token_amount, scheduled_date, status)
VALUES 
    ('SERV202605080001', 'CUST202605080001', 'ac_repair', 100, CURRENT_DATE + INTERVAL '2 days', 'PENDING'),
    ('SERV202605080002', 'CUST202605080002', 'electrician', 100, CURRENT_DATE + INTERVAL '1 day', 'ACCEPTED')
ON CONFLICT (serv_id) DO NOTHING;

-- =====================================================
-- 21. INSERT SAMPLE BARCODE SCANS
-- =====================================================

INSERT INTO barcode_scans (barcode, barcode_type, scanned_by, scanned_by_type)
VALUES 
    ('BOOK202605080001', 'BOOK', 'RIDE202605080001', 'rider'),
    ('PROD202605080001', 'PROD', 'SELL202605080001', 'seller')

ON CONFLICT (scan_id) DO NOTHING;

-- =====================================================
-- 22. INSERT SAMPLE INVOICES
-- =====================================================

INSERT INTO invoices (invoice_id, book_id, invoice_number, generated_at)
VALUES 
    ('INV202605080001', 'BOOK202605080001', 'INV-0001', NOW() - INTERVAL '2 days'),
    ('INV202605080002', 'BOOK202605080002', 'INV-0002', NOW() - INTERVAL '1 day')
ON CONFLICT (invoice_id) DO NOTHING;

-- =====================================================
-- 23. INSERT SAMPLE WISHLIST
-- =====================================================

INSERT INTO wishlist (cust_id, prod_id)
VALUES 
    ('CUST202605080001', 'PROD202605080003'),
    ('CUST202605080002', 'PROD202605080001')
ON CONFLICT (cust_id, prod_id) DO NOTHING;

-- =====================================================
-- 24. INSERT SAMPLE CART
-- =====================================================

INSERT INTO cart (cust_id, prod_id, quantity)
VALUES 
    ('CUST202605080003', 'PROD202605080001', 1)
ON CONFLICT (cart_id) DO NOTHING;

-- =====================================================
-- END OF SEED DATA
-- =====================================================

-- Verify data inserted
SELECT 'Customers' as table_name, COUNT(*) as count FROM customers
UNION ALL
SELECT 'Sellers', COUNT(*) FROM sellers
UNION ALL
SELECT 'Riders', COUNT(*) FROM riders
UNION ALL
SELECT 'Products', COUNT(*) FROM products
UNION ALL
SELECT 'Orders', COUNT(*) FROM orders
UNION ALL
SELECT 'Categories', COUNT(*) FROM categories;