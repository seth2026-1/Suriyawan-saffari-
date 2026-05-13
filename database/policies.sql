-- =====================================================
-- SURIYAWAN SAFFARI - RLS POLICIES
-- =====================================================
-- Row Level Security Policies for all tables
-- Customers can see only their own data
-- Sellers can see only their own data
-- Riders can see only assigned runsheets
-- Hub Managers can see their zone data
-- Owner can see everything
-- =====================================================

-- =====================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================

-- User Tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE hub_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner ENABLE ROW LEVEL SECURITY;

-- Product Tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_tags ENABLE ROW LEVEL SECURITY;

-- Order Tables
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Cart & Wishlist
ALTER TABLE cart ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;

-- Services
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Logistics
ALTER TABLE runsheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bags ENABLE ROW LEVEL SECURITY;
ALTER TABLE lr_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_tracking ENABLE ROW LEVEL SECURITY;

-- Returns & Exchange
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchanges ENABLE ROW LEVEL SECURITY;

-- Support
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Finance
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;

-- Reviews
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE rider_reviews ENABLE ROW LEVEL SECURITY;

-- Coupons
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_coupons ENABLE ROW LEVEL SECURITY;

-- Referrals
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- System
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Barcode
ALTER TABLE barcode_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- HELPER FUNCTION TO CHECK IF USER IS OWNER
-- =====================================================

CREATE OR REPLACE FUNCTION is_owner()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (SELECT email = current_user FROM owner LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- CUSTOMER POLICIES
-- =====================================================

-- Customers can see their own data only
CREATE POLICY customer_select_own ON customers
    FOR SELECT USING (auth.uid()::text = cust_id);

CREATE POLICY customer_update_own ON customers
    FOR UPDATE USING (auth.uid()::text = cust_id);

-- Customers can insert their own data
CREATE POLICY customer_insert_own ON customers
    FOR INSERT WITH CHECK (true);

-- =====================================================
-- SELLER POLICIES
-- =====================================================

-- Sellers can see their own data only
CREATE POLICY seller_select_own ON sellers
    FOR SELECT USING (auth.uid()::text = seller_id);

CREATE POLICY seller_update_own ON sellers
    FOR UPDATE USING (auth.uid()::text = seller_id);

-- =====================================================
-- RIDER POLICIES
-- =====================================================

-- Riders can see their own data only
CREATE POLICY rider_select_own ON riders
    FOR SELECT USING (auth.uid()::text = rider_id);

CREATE POLICY rider_update_own ON riders
    FOR UPDATE USING (auth.uid()::text = rider_id);

-- =====================================================
-- HUB MANAGER POLICIES
-- =====================================================

-- Hub managers can see their own data
CREATE POLICY hub_select_own ON hub_managers
    FOR SELECT USING (auth.uid()::text = hub_id);

-- =====================================================
-- OWNER POLICY - CAN SEE EVERYTHING
-- =====================================================

-- Owner can see all customers
CREATE POLICY owner_all_customers ON customers
    FOR ALL USING (is_owner());

-- Owner can see all sellers
CREATE POLICY owner_all_sellers ON sellers
    FOR ALL USING (is_owner());

-- Owner can see all riders
CREATE POLICY owner_all_riders ON riders
    FOR ALL USING (is_owner());

-- Owner can see all hub managers
CREATE POLICY owner_all_hubs ON hub_managers
    FOR ALL USING (is_owner());

-- =====================================================
-- PRODUCT POLICIES
-- =====================================================

-- Anyone can view active products
CREATE POLICY public_view_products ON products
    FOR SELECT USING (is_active = true AND is_approved = true);

-- Sellers can view their own products
CREATE POLICY seller_view_own_products ON products
    FOR SELECT USING (seller_id = auth.uid()::text);

-- Sellers can insert their own products
CREATE POLICY seller_insert_products ON products
    FOR INSERT WITH CHECK (seller_id = auth.uid()::text);

-- Sellers can update their own products
CREATE POLICY seller_update_own_products ON products
    FOR UPDATE USING (seller_id = auth.uid()::text);

-- Sellers can delete their own products
CREATE POLICY seller_delete_own_products ON products
    FOR DELETE USING (seller_id = auth.uid()::text);

-- Owner can see all products
CREATE POLICY owner_all_products ON products
    FOR ALL USING (is_owner());

-- =====================================================
-- CATEGORY POLICIES
-- =====================================================

-- Anyone can view active categories
CREATE POLICY public_view_categories ON categories
    FOR SELECT USING (is_active = true);

-- Owner can manage categories
CREATE POLICY owner_all_categories ON categories
    FOR ALL USING (is_owner());

-- =====================================================
-- ORDER POLICIES
-- =====================================================

-- Customers can see their own orders
CREATE POLICY customer_view_own_orders ON orders
    FOR SELECT USING (cust_id = auth.uid()::text);

-- Customers can insert their own orders
CREATE POLICY customer_insert_orders ON orders
    FOR INSERT WITH CHECK (cust_id = auth.uid()::text);

-- Sellers can see orders for their products
CREATE POLICY seller_view_orders ON orders
    FOR SELECT USING (seller_id = auth.uid()::text);

-- Riders can see assigned orders
CREATE POLICY rider_view_assigned_orders ON orders
    FOR SELECT USING (rider_id = auth.uid()::text);

-- Hub managers can see orders in their zone
CREATE POLICY hub_view_zone_orders ON orders
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM hub_managers 
            WHERE hub_id = auth.uid()::text 
            AND address->>'pincode' = ANY(assigned_pincodes)
        )
    );

-- Owner can see all orders
CREATE POLICY owner_all_orders ON orders
    FOR ALL USING (is_owner());

-- =====================================================
-- ORDER ITEMS POLICIES
-- =====================================================

-- Customers can see their order items
CREATE POLICY customer_view_own_order_items ON order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.book_id = order_items.book_id 
            AND orders.cust_id = auth.uid()::text
        )
    );

-- Sellers can see their order items
CREATE POLICY seller_view_order_items ON order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.book_id = order_items.book_id 
            AND orders.seller_id = auth.uid()::text
        )
    );

-- Owner can see all order items
CREATE POLICY owner_all_order_items ON order_items
    FOR ALL USING (is_owner());

-- =====================================================
-- CART POLICIES
-- =====================================================

-- Customers can see their own cart
CREATE POLICY customer_view_own_cart ON cart
    FOR SELECT USING (cust_id = auth.uid()::text);

-- Customers can insert into their own cart
CREATE POLICY customer_insert_cart ON cart
    FOR INSERT WITH CHECK (cust_id = auth.uid()::text);

-- Customers can update their own cart
CREATE POLICY customer_update_cart ON cart
    FOR UPDATE USING (cust_id = auth.uid()::text);

-- Customers can delete from their own cart
CREATE POLICY customer_delete_cart ON cart
    FOR DELETE USING (cust_id = auth.uid()::text);

-- =====================================================
-- WISHLIST POLICIES
-- =====================================================

-- Customers can see their own wishlist
CREATE POLICY customer_view_own_wishlist ON wishlist
    FOR SELECT USING (cust_id = auth.uid()::text);

-- Customers can insert into their own wishlist
CREATE POLICY customer_insert_wishlist ON wishlist
    FOR INSERT WITH CHECK (cust_id = auth.uid()::text);

-- Customers can delete from their own wishlist
CREATE POLICY customer_delete_wishlist ON wishlist
    FOR DELETE USING (cust_id = auth.uid()::text);

-- =====================================================
-- SERVICES POLICIES
-- =====================================================

-- Customers can see their own service bookings
CREATE POLICY customer_view_own_services ON services
    FOR SELECT USING (cust_id = auth.uid()::text);

-- Customers can insert service bookings
CREATE POLICY customer_insert_services ON services
    FOR INSERT WITH CHECK (cust_id = auth.uid()::text);

-- Sellers can see services assigned to them
CREATE POLICY seller_view_services ON services
    FOR SELECT USING (seller_id = auth.uid()::text);

-- Owner can see all services
CREATE POLICY owner_all_services ON services
    FOR ALL USING (is_owner());

-- =====================================================
-- RUNSHEET POLICIES
-- =====================================================

-- Riders can see their assigned runsheets
CREATE POLICY rider_view_own_runsheets ON runsheets
    FOR SELECT USING (rider_id = auth.uid()::text);

-- Riders can update their runsheet status
CREATE POLICY rider_update_own_runsheets ON runsheets
    FOR UPDATE USING (rider_id = auth.uid()::text);

-- Hub managers can see runsheets in their zone
CREATE POLICY hub_view_zone_runsheets ON runsheets
    FOR SELECT USING (hub_id = auth.uid()::text);

-- Hub managers can create runsheets
CREATE POLICY hub_insert_runsheets ON runsheets
    FOR INSERT WITH CHECK (hub_id = auth.uid()::text);

-- Hub managers can update runsheets
CREATE POLICY hub_update_runsheets ON runsheets
    FOR UPDATE USING (hub_id = auth.uid()::text);

-- Owner can see all runsheets
CREATE POLICY owner_all_runsheets ON runsheets
    FOR ALL USING (is_owner());

-- =====================================================
-- SHIPMENT TRACKING POLICIES
-- =====================================================

-- Customers can track their orders
CREATE POLICY customer_view_tracking ON shipment_tracking
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.book_id = shipment_tracking.book_id 
            AND orders.cust_id = auth.uid()::text
        )
    );

-- Riders can update tracking for their orders
CREATE POLICY rider_update_tracking ON shipment_tracking
    FOR INSERT WITH CHECK (rider_id = auth.uid()::text);

-- Hub managers can update tracking
CREATE POLICY hub_update_tracking ON shipment_tracking
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM hub_managers 
            WHERE hub_id = auth.uid()::text
        )
    );

-- Owner can see all tracking
CREATE POLICY owner_all_tracking ON shipment_tracking
    FOR ALL USING (is_owner());

-- =====================================================
-- RETURNS POLICIES
-- =====================================================

-- Customers can see their returns
CREATE POLICY customer_view_own_returns ON returns
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.book_id = returns.book_id 
            AND orders.cust_id = auth.uid()::text
        )
    );

-- Customers can create returns
CREATE POLICY customer_insert_returns ON returns
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.book_id = returns.book_id 
            AND orders.cust_id = auth.uid()::text
        )
    );

-- Sellers can see returns for their products
CREATE POLICY seller_view_returns ON returns
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.book_id = returns.book_id 
            AND orders.seller_id = auth.uid()::text
        )
    );

-- Owner can see all returns
CREATE POLICY owner_all_returns ON returns
    FOR ALL USING (is_owner());

-- =====================================================
-- SUPPORT TICKETS POLICIES
-- =====================================================

-- Users can see their own tickets
CREATE POLICY user_view_own_tickets ON support_tickets
    FOR SELECT USING (user_id = auth.uid()::text);

-- Users can create tickets
CREATE POLICY user_insert_tickets ON support_tickets
    FOR INSERT WITH CHECK (user_id = auth.uid()::text);

-- Admins can see all tickets
CREATE POLICY admin_all_tickets ON support_tickets
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE admin_id = auth.uid()::text
        )
    );

-- Owner can see all tickets
CREATE POLICY owner_all_tickets ON support_tickets
    FOR ALL USING (is_owner());

-- =====================================================
-- WALLET TRANSACTIONS POLICIES
-- =====================================================

-- Users can see their own wallet transactions
CREATE POLICY user_view_own_wallet ON wallet_transactions
    FOR SELECT USING (user_id = auth.uid()::text);

-- Owner can see all wallet transactions
CREATE POLICY owner_all_wallet ON wallet_transactions
    FOR ALL USING (is_owner());

-- =====================================================
-- REVIEWS POLICIES
-- =====================================================

-- Anyone can view reviews
CREATE POLICY public_view_reviews ON reviews
    FOR SELECT USING (true);

-- Customers can create reviews for their orders
CREATE POLICY customer_insert_reviews ON reviews
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.book_id = reviews.order_id 
            AND orders.cust_id = auth.uid()::text
        ) AND NOT EXISTS (
            SELECT 1 FROM reviews r2 
            WHERE r2.order_id = reviews.order_id 
            AND r2.cust_id = auth.uid()::text
        )
    );

-- Customers can update their own reviews
CREATE POLICY customer_update_own_reviews ON reviews
    FOR UPDATE USING (cust_id = auth.uid()::text);

-- =====================================================
-- NOTIFICATIONS POLICIES
-- =====================================================

-- Users can see their own notifications
CREATE POLICY user_view_own_notifications ON notifications
    FOR SELECT USING (user_id = auth.uid()::text OR user_type = 'all');

-- Users can update read status
CREATE POLICY user_update_notifications ON notifications
    FOR UPDATE USING (user_id = auth.uid()::text);

-- System can insert notifications
CREATE POLICY system_insert_notifications ON notifications
    FOR INSERT WITH CHECK (true);

-- =====================================================
-- SYSTEM SETTINGS POLICIES
-- =====================================================

-- Anyone can view system settings
CREATE POLICY public_view_settings ON system_settings
    FOR SELECT USING (true);

-- Only owner can modify settings
CREATE POLICY owner_modify_settings ON system_settings
    FOR UPDATE USING (is_owner());

-- =====================================================
-- BARCODE SCANS POLICIES
-- =====================================================

-- Users can see their own scans
CREATE POLICY user_view_own_scans ON barcode_scans
    FOR SELECT USING (scanned_by = auth.uid()::text);

-- Users can insert scans
CREATE POLICY user_insert_scans ON barcode_scans
    FOR INSERT WITH CHECK (scanned_by = auth.uid()::text);

-- Owner can see all scans
CREATE POLICY owner_all_scans ON barcode_scans
    FOR ALL USING (is_owner());

-- =====================================================
-- INVOICE POLICIES
-- =====================================================

-- Customers can see their invoices
CREATE POLICY customer_view_own_invoices ON invoices
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.book_id = invoices.book_id 
            AND orders.cust_id = auth.uid()::text
        )
    );

-- Sellers can see invoice for their orders
CREATE POLICY seller_view_invoices ON invoices
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.book_id = invoices.book_id 
            AND orders.seller_id = auth.uid()::text
        )
    );

-- Owner can see all invoices
CREATE POLICY owner_all_invoices ON invoices
    FOR ALL USING (is_owner());

-- =====================================================
-- DROP POLICIES IF NEEDED (For Reset)
-- =====================================================

-- To drop all policies for a table:
-- DROP POLICY IF EXISTS policy_name ON table_name;

-- =====================================================
-- FUNCTION TO CHECK USER ROLE
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_role(user_id TEXT)
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM customers WHERE cust_id = user_id) THEN
        user_role := 'customer';
    ELSIF EXISTS (SELECT 1 FROM sellers WHERE seller_id = user_id) THEN
        user_role := 'seller';
    ELSIF EXISTS (SELECT 1 FROM riders WHERE rider_id = user_id) THEN
        user_role := 'rider';
    ELSIF EXISTS (SELECT 1 FROM hub_managers WHERE hub_id = user_id) THEN
        user_role := 'hub';
    ELSIF EXISTS (SELECT 1 FROM admin_users WHERE admin_id = user_id) THEN
        user_role := 'admin';
    ELSE
        user_role := 'unknown';
    END IF;
    
    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION TO CHECK IF USER CAN ACCESS DATA
-- =====================================================

CREATE OR REPLACE FUNCTION can_access_order(order_id TEXT, user_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    order_cust_id TEXT;
    order_seller_id TEXT;
    order_rider_id TEXT;
BEGIN
    -- Get order details
    SELECT cust_id, seller_id, rider_id INTO order_cust_id, order_seller_id, order_rider_id
    FROM orders WHERE book_id = order_id;
    
    -- Get user role
    user_role := get_user_role(user_id);
    
    -- Owner can access everything
    IF is_owner() THEN
        RETURN TRUE;
    END IF;
    
    -- Customer can access their orders
    IF user_role = 'customer' AND order_cust_id = user_id THEN
        RETURN TRUE;
    END IF;
    
    -- Seller can access their orders
    IF user_role = 'seller' AND order_seller_id = user_id THEN
        RETURN TRUE;
    END IF;
    
    -- Rider can access assigned orders
    IF user_role = 'rider' AND order_rider_id = user_id THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- END OF RLS POLICIES
-- =====================================================