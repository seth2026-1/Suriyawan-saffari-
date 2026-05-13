-- =====================================================
-- SURIYAWAN SAFFARI - DATABASE FUNCTIONS
-- =====================================================
-- Edge Functions and Stored Procedures
-- Includes: ID Generation, Barcode Functions, Order Processing
-- Cancel Code Logic, Wallet Management, Trust Score Calculation
-- =====================================================

-- =====================================================
-- 1. ID GENERATION FUNCTIONS
-- =====================================================

-- Generate CUST ID
CREATE OR REPLACE FUNCTION generate_cust_id()
RETURNS TEXT AS $$
DECLARE
    new_id TEXT;
    serial_num TEXT;
BEGIN
    SELECT lpad(nextval('cust_seq')::text, 4, '0') INTO serial_num;
    new_id := 'CUST' || to_char(CURRENT_DATE, 'YYYYMMDD') || serial_num;
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Generate SELLER ID
CREATE OR REPLACE FUNCTION generate_seller_id()
RETURNS TEXT AS $$
DECLARE
    new_id TEXT;
    serial_num TEXT;
BEGIN
    SELECT lpad(nextval('seller_seq')::text, 4, '0') INTO serial_num;
    new_id := 'SELL' || to_char(CURRENT_DATE, 'YYYYMMDD') || serial_num;
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Generate RIDER ID
CREATE OR REPLACE FUNCTION generate_rider_id()
RETURNS TEXT AS $$
DECLARE
    new_id TEXT;
    serial_num TEXT;
BEGIN
    SELECT lpad(nextval('rider_seq')::text, 4, '0') INTO serial_num;
    new_id := 'RIDE' || to_char(CURRENT_DATE, 'YYYYMMDD') || serial_num;
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Generate HUB ID
CREATE OR REPLACE FUNCTION generate_hub_id()
RETURNS TEXT AS $$
DECLARE
    new_id TEXT;
    serial_num TEXT;
BEGIN
    SELECT lpad(nextval('hub_seq')::text, 4, '0') INTO serial_num;
    new_id := 'HUB' || to_char(CURRENT_DATE, 'YYYYMMDD') || serial_num;
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Generate PROD ID
CREATE OR REPLACE FUNCTION generate_prod_id()
RETURNS TEXT AS $$
DECLARE
    new_id TEXT;
    serial_num TEXT;
BEGIN
    SELECT lpad(nextval('prod_seq')::text, 4, '0') INTO serial_num;
    new_id := 'PROD' || to_char(CURRENT_DATE, 'YYYYMMDD') || serial_num;
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Generate BOOK ID
CREATE OR REPLACE FUNCTION generate_book_id()
RETURNS TEXT AS $$
DECLARE
    new_id TEXT;
    serial_num TEXT;
BEGIN
    SELECT lpad(nextval('order_seq')::text, 4, '0') INTO serial_num;
    new_id := 'BOOK' || to_char(CURRENT_DATE, 'YYYYMMDD') || serial_num;
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Generate Tracking ID (AWB)
CREATE OR REPLACE FUNCTION generate_tracking_id()
RETURNS TEXT AS $$
DECLARE
    new_id TEXT;
    serial_num TEXT;
BEGIN
    SELECT lpad(nextval('tracking_seq')::text, 12, '0') INTO serial_num;
    new_id := 'SS' || to_char(CURRENT_DATE, 'YYYYMMDD') || serial_num;
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Generate Cancel Code (6 Digit)
CREATE OR REPLACE FUNCTION generate_cancel_code()
RETURNS TEXT AS $$
DECLARE
    code TEXT;
BEGIN
    code := lpad(floor(random() * 900000 + 100000)::text, 6, '0');
    RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Generate SERV ID
CREATE OR REPLACE FUNCTION generate_serv_id()
RETURNS TEXT AS $$
DECLARE
    new_id TEXT;
    serial_num TEXT;
BEGIN
    SELECT lpad(nextval('serv_seq')::text, 4, '0') INTO serial_num;
    new_id := 'SERV' || to_char(CURRENT_DATE, 'YYYYMMDD') || serial_num;
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Generate RUN ID
CREATE OR REPLACE FUNCTION generate_run_id()
RETURNS TEXT AS $$
DECLARE
    new_id TEXT;
    serial_num TEXT;
BEGIN
    SELECT lpad(nextval('run_seq')::text, 4, '0') INTO serial_num;
    new_id := 'RUN' || to_char(CURRENT_DATE, 'YYYYMMDD') || serial_num;
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Generate TICKET ID
CREATE OR REPLACE FUNCTION generate_ticket_id()
RETURNS TEXT AS $$
DECLARE
    new_id TEXT;
    serial_num TEXT;
BEGIN
    SELECT lpad(nextval('ticket_seq')::text, 4, '0') INTO serial_num;
    new_id := 'TKT' || to_char(CURRENT_DATE, 'YYYYMMDD') || serial_num;
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Generate RETURN ID
CREATE OR REPLACE FUNCTION generate_return_id()
RETURNS TEXT AS $$
DECLARE
    new_id TEXT;
    serial_num TEXT;
BEGIN
    SELECT lpad(nextval('return_seq')::text, 4, '0') INTO serial_num;
    new_id := 'RET' || to_char(CURRENT_DATE, 'YYYYMMDD') || serial_num;
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Generate EXCHANGE ID
CREATE OR REPLACE FUNCTION generate_exchange_id()
RETURNS TEXT AS $$
DECLARE
    new_id TEXT;
    serial_num TEXT;
BEGIN
    SELECT lpad(nextval('exchange_seq')::text, 4, '0') INTO serial_num;
    new_id := 'EXCH' || to_char(CURRENT_DATE, 'YYYYMMDD') || serial_num;
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Generate PAYOUT ID
CREATE OR REPLACE FUNCTION generate_payout_id()
RETURNS TEXT AS $$
DECLARE
    new_id TEXT;
    serial_num TEXT;
BEGIN
    SELECT lpad(nextval('payout_seq')::text, 4, '0') INTO serial_num;
    new_id := 'PAY' || to_char(CURRENT_DATE, 'YYYYMMDD') || serial_num;
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2. TRUST SCORE CALCULATION
-- =====================================================

-- Update Trust Score for Customer
CREATE OR REPLACE FUNCTION update_customer_trust_score()
RETURNS TRIGGER AS $$
BEGIN
    -- Order completed successfully: +5 points
    IF NEW.status = 'DELIVERED' AND OLD.status != 'DELIVERED' THEN
        UPDATE customers 
        SET trust_score = trust_score + 5,
            updated_at = NOW()
        WHERE cust_id = NEW.cust_id;
    
    -- Order cancelled/RTO: -20 points
    ELSIF NEW.status IN ('CANCELLED', 'RTO') AND OLD.status NOT IN ('CANCELLED', 'RTO') THEN
        UPDATE customers 
        SET trust_score = GREATEST(trust_score - 20, 0),
            updated_at = NOW()
        WHERE cust_id = NEW.cust_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for trust score
CREATE TRIGGER update_trust_score_on_order
    AFTER UPDATE OF status ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_trust_score();

-- =====================================================
-- 3. WALLET FUNCTIONS
-- =====================================================

-- Add to Wallet
CREATE OR REPLACE FUNCTION add_to_wallet(
    p_user_id TEXT,
    p_user_type TEXT,
    p_amount INTEGER,
    p_reason TEXT,
    p_reference_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Insert transaction record
    INSERT INTO wallet_transactions (user_id, user_type, amount, type, reason, reference_id)
    VALUES (p_user_id, p_user_type, p_amount, 'credit', p_reason, p_reference_id);
    
    -- Update user's wallet balance based on type
    IF p_user_type = 'customer' THEN
        UPDATE customers SET wallet_balance = wallet_balance + p_amount, updated_at = NOW()
        WHERE cust_id = p_user_id;
    ELSIF p_user_type = 'seller' THEN
        UPDATE sellers SET wallet_balance = wallet_balance + p_amount, updated_at = NOW()
        WHERE seller_id = p_user_id;
    ELSIF p_user_type = 'rider' THEN
        UPDATE riders SET wallet_balance = wallet_balance + p_amount, updated_at = NOW()
        WHERE rider_id = p_user_id;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Deduct from Wallet
CREATE OR REPLACE FUNCTION deduct_from_wallet(
    p_user_id TEXT,
    p_user_type TEXT,
    p_amount INTEGER,
    p_reason TEXT,
    p_reference_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Insert transaction record
    INSERT INTO wallet_transactions (user_id, user_type, amount, type, reason, reference_id)
    VALUES (p_user_id, p_user_type, p_amount, 'debit', p_reason, p_reference_id);
    
    -- Update user's wallet balance
    IF p_user_type = 'customer' THEN
        UPDATE customers SET wallet_balance = wallet_balance - p_amount, updated_at = NOW()
        WHERE cust_id = p_user_id AND wallet_balance >= p_amount;
        IF NOT FOUND THEN RETURN FALSE; END IF;
    ELSIF p_user_type = 'seller' THEN
        UPDATE sellers SET wallet_balance = wallet_balance - p_amount, updated_at = NOW()
        WHERE seller_id = p_user_id AND wallet_balance >= p_amount;
        IF NOT FOUND THEN RETURN FALSE; END IF;
    ELSIF p_user_type = 'rider' THEN
        UPDATE riders SET wallet_balance = wallet_balance - p_amount, updated_at = NOW()
        WHERE rider_id = p_user_id AND wallet_balance >= p_amount;
        IF NOT FOUND THEN RETURN FALSE; END IF;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. COINS FUNCTIONS
-- =====================================================

-- Add Coins to Customer
CREATE OR REPLACE FUNCTION add_coins(
    p_cust_id TEXT,
    p_coins INTEGER,
    p_reason TEXT,
    p_reference_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Insert coin transaction
    INSERT INTO coin_transactions (cust_id, coins, type, reason, reference_id)
    VALUES (p_cust_id, p_coins, 'credit', p_reason, p_reference_id);
    
    -- Update customer coins
    UPDATE customers 
    SET coins = coins + p_coins, updated_at = NOW()
    WHERE cust_id = p_cust_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add coins on order completion (2% of order amount)
CREATE OR REPLACE FUNCTION add_coins_on_order_delivery()
RETURNS TRIGGER AS $$
DECLARE
    coins_to_add INTEGER;
    coin_percent INTEGER;
BEGIN
    IF NEW.status = 'DELIVERED' AND OLD.status != 'DELIVERED' THEN
        -- Get coin percentage from settings
        SELECT setting_value::INTEGER INTO coin_percent 
        FROM system_settings WHERE setting_key = 'coins_order_percent';
        
        IF coin_percent IS NULL THEN coin_percent := 2; END IF;
        
        coins_to_add := (NEW.final_amount * coin_percent) / 100;
        
        IF coins_to_add > 0 THEN
            PERFORM add_coins(NEW.cust_id, coins_to_add, 'Order completed', NEW.book_id);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for coins on delivery
CREATE TRIGGER add_coins_on_order_delivery_trigger
    AFTER UPDATE OF status ON orders
    FOR EACH ROW
    EXECUTE FUNCTION add_coins_on_order_delivery();

-- =====================================================
-- 5. RIDER EARNING FUNCTIONS
-- =====================================================

-- Add rider earning on delivery
CREATE OR REPLACE FUNCTION add_rider_earning_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
    rider_rate INTEGER;
BEGIN
    IF NEW.status = 'DELIVERED' AND OLD.status != 'DELIVERED' AND NEW.rider_id IS NOT NULL THEN
        -- Get rider rate from settings
        SELECT setting_value::INTEGER INTO rider_rate 
        FROM system_settings WHERE setting_key = 'rider_rate_per_parcel';
        
        IF rider_rate IS NULL THEN rider_rate := 18; END IF;
        
        PERFORM add_to_wallet(
            NEW.rider_id,
            'rider',
            rider_rate,
            'Delivery completed for order: ' || NEW.book_id,
            NEW.book_id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for rider earning
CREATE TRIGGER add_rider_earning_on_delivery_trigger
    AFTER UPDATE OF status ON orders
    FOR EACH ROW
    EXECUTE FUNCTION add_rider_earning_on_delivery();

-- =====================================================
-- 6. STOCK MANAGEMENT
-- =====================================================

-- Reduce stock when order is placed
CREATE OR REPLACE FUNCTION reduce_product_stock()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE products 
    SET stock = stock - NEW.quantity,
        total_sold = total_sold + NEW.quantity,
        updated_at = NOW()
    WHERE prod_id = NEW.prod_id;
    
    -- Check for low stock alert
    IF (SELECT stock FROM products WHERE prod_id = NEW.prod_id) <= 5 THEN
        -- Insert notification for seller
        INSERT INTO notifications (user_id, user_type, title, message, type)
        VALUES (
            (SELECT seller_id FROM products WHERE prod_id = NEW.prod_id),
            'seller',
            'Low Stock Alert',
            'Your product is running low on stock. Only ' || (SELECT stock FROM products WHERE prod_id = NEW.prod_id) || ' left.',
            'alert'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for stock reduction
CREATE TRIGGER reduce_stock_on_order
    AFTER INSERT ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION reduce_product_stock();

-- =====================================================
-- 7. CANCEL CODE VALIDATION
-- =====================================================

-- Validate Cancel Code
CREATE OR REPLACE FUNCTION validate_cancel_code(
    p_book_id TEXT,
    p_cancel_code TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_expiry TIMESTAMP;
    v_status TEXT;
BEGIN
    -- Get order details
    SELECT cancel_code_expiry, status INTO v_expiry, v_status
    FROM orders WHERE book_id = p_book_id;
    
    -- Check if order exists
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Check if already delivered
    IF v_status = 'DELIVERED' THEN
        RETURN FALSE;
    END IF;
    
    -- Check if code is expired
    IF v_expiry < NOW() THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Cancel Order using Cancel Code
CREATE OR REPLACE FUNCTION cancel_order_with_code(
    p_book_id TEXT,
    p_cancel_code TEXT,
    p_rider_id TEXT,
    p_reason TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_order_valid BOOLEAN;
BEGIN
    -- Validate cancel code
    SELECT validate_cancel_code(p_book_id, p_cancel_code) INTO v_order_valid;
    
    IF NOT v_order_valid THEN
        RETURN FALSE;
    END IF;
    
    -- Update order status
    UPDATE orders 
    SET status = 'CANCELLED',
        cancelled_at = NOW(),
        cancel_reason = p_reason,
        cancel_code_used_by = p_rider_id,
        cancel_code_used_at = NOW()
    WHERE book_id = p_book_id AND cancel_code = p_cancel_code;
    
    -- Add tracking entry
    INSERT INTO shipment_tracking (book_id, status, rider_id, notes)
    VALUES (p_book_id, 'CANCELLED', p_rider_id, 'Cancelled using cancel code. Reason: ' || p_reason);
    
    -- Restore stock
    UPDATE products p
    SET stock = stock + oi.quantity
    FROM order_items oi
    WHERE oi.book_id = p_book_id AND p.prod_id = oi.prod_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. RUNSHEET FUNCTIONS
-- =====================================================

-- Auto Assign Rider to Order
CREATE OR REPLACE FUNCTION auto_assign_rider(
    p_order_id TEXT,
    p_pincode TEXT
)
RETURNS TEXT AS $$
DECLARE
    v_rider_id TEXT;
BEGIN
    -- Find nearest available rider for the pincode
    SELECT rider_id INTO v_rider_id
    FROM riders
    WHERE is_active = true 
        AND is_online = true
        AND p_pincode = ANY(assigned_pincodes)
    ORDER BY rating DESC
    LIMIT 1;
    
    -- Update order with assigned rider
    IF v_rider_id IS NOT NULL THEN
        UPDATE orders SET rider_id = v_rider_id WHERE book_id = p_order_id;
    END IF;
    
    RETURN v_rider_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 9. REFERRAL FUNCTIONS
-- =====================================================

-- Process Referral Reward
CREATE OR REPLACE FUNCTION process_referral_reward(
    p_referred_cust_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_referrer_id TEXT;
    v_refer_amount INTEGER;
BEGIN
    -- Get referrer from referral record
    SELECT referrer_cust_id INTO v_referrer_id
    FROM referrals 
    WHERE referred_cust_id = p_referred_cust_id AND status = 'PENDING';
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Get refer amount from settings
    SELECT setting_value::INTEGER INTO v_refer_amount 
    FROM system_settings WHERE setting_key = 'refer_earn_amount';
    
    IF v_refer_amount IS NULL THEN v_refer_amount := 10; END IF;
    
    -- Add coins to referrer
    PERFORM add_coins(v_referrer_id, v_refer_amount, 'Referral reward', p_referred_cust_id);
    
    -- Update referral status
    UPDATE referrals 
    SET status = 'COMPLETED', reward_given = true, reward_amount = v_refer_amount, completed_at = NOW()
    WHERE referred_cust_id = p_referred_cust_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Trigger for referral on first order
CREATE OR REPLACE FUNCTION check_referral_first_order()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'DELIVERED' THEN
        PERFORM process_referral_reward(NEW.cust_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for referral
CREATE TRIGGER referral_on_first_order_trigger
    AFTER UPDATE OF status ON orders
    FOR EACH ROW
    WHEN (NEW.status = 'DELIVERED')
    EXECUTE FUNCTION check_referral_first_order();

-- =====================================================
-- 10. COD BLOCK MANAGEMENT
-- =====================================================

-- Auto block COD for high RTO customers
CREATE OR REPLACE FUNCTION auto_block_cod_customer()
RETURNS TRIGGER AS $$
DECLARE
    v_rto_count INTEGER;
    v_block_days INTEGER;
BEGIN
    -- Count RTO in last 30 days
    SELECT COUNT(*) INTO v_rto_count
    FROM orders
    WHERE cust_id = NEW.cust_id 
        AND status = 'RTO'
        AND placed_at > NOW() - INTERVAL '30 days';
    
    -- If more than 3 RTOs, block COD
    IF v_rto_count >= 3 THEN
        SELECT setting_value::INTEGER INTO v_block_days 
        FROM system_settings WHERE setting_key = 'cod_block_days';
        
        IF v_block_days IS NULL THEN v_block_days := 30; END IF;
        
        UPDATE customers 
        SET cod_status = 'BLOCKED',
            cod_block_reason = 'High RTO rate - ' || v_rto_count || ' RTOs in 30 days',
            cod_block_until = NOW() + (v_block_days || ' days')::INTERVAL,
            updated_at = NOW()
        WHERE cust_id = NEW.cust_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for COD block
CREATE TRIGGER auto_block_cod_on_rto_trigger
    AFTER UPDATE OF status ON orders
    FOR EACH ROW
    WHEN (NEW.status = 'RTO')
    EXECUTE FUNCTION auto_block_cod_customer();

-- =====================================================
-- 11. BARCODE VALIDATION FUNCTIONS
-- =====================================================

-- Validate Barcode
CREATE OR REPLACE FUNCTION validate_barcode(
    p_barcode TEXT
)
RETURNS JSONB AS $$
DECLARE
    barcode_type TEXT;
    result JSONB;
BEGIN
    -- Determine barcode type based on prefix
    IF p_barcode LIKE 'PROD%' THEN
        barcode_type := 'PROD';
        SELECT jsonb_build_object(
            'type', 'PROD',
            'valid', EXISTS(SELECT 1 FROM products WHERE prod_id = p_barcode AND is_active = true),
            'data', row_to_json(p)
        ) INTO result
        FROM products p WHERE prod_id = p_barcode;
        
    ELSIF p_barcode LIKE 'BOOK%' THEN
        barcode_type := 'BOOK';
        SELECT jsonb_build_object(
            'type', 'BOOK',
            'valid', EXISTS(SELECT 1 FROM orders WHERE book_id = p_barcode),
            'data', row_to_json(o)
        ) INTO result
        FROM orders o WHERE book_id = p_barcode;
        
    ELSIF p_barcode LIKE 'SS%' THEN
        barcode_type := 'AWB';
        SELECT jsonb_build_object(
            'type', 'AWB',
            'valid', EXISTS(SELECT 1 FROM orders WHERE tracking_id = p_barcode),
            'data', row_to_json(o)
        ) INTO result
        FROM orders o WHERE tracking_id = p_barcode;
        
    ELSIF p_barcode ~ '^[0-9]{6}$' THEN
        barcode_type := 'CANCEL';
        SELECT jsonb_build_object(
            'type', 'CANCEL',
            'valid', EXISTS(SELECT 1 FROM orders WHERE cancel_code = p_barcode AND cancel_code_expiry > NOW()),
            'data', row_to_json(o)
        ) INTO result
        FROM orders o WHERE cancel_code = p_barcode;
        
    ELSIF p_barcode LIKE 'RET%' THEN
        barcode_type := 'RETURN';
        SELECT jsonb_build_object(
            'type', 'RETURN',
            'valid', EXISTS(SELECT 1 FROM returns WHERE return_id = p_barcode),
            'data', row_to_json(r)
        ) INTO result
        FROM returns r WHERE return_id = p_barcode;
        
    ELSIF p_barcode LIKE 'EXCH%' THEN
        barcode_type := 'EXCHANGE';
        SELECT jsonb_build_object(
            'type', 'EXCHANGE',
            'valid', EXISTS(SELECT 1 FROM exchanges WHERE exchange_id = p_barcode),
            'data', row_to_json(e)
        ) INTO result
        FROM exchanges e WHERE exchange_id = p_barcode;
        
    ELSIF p_barcode LIKE 'INV%' THEN
        barcode_type := 'INVOICE';
        SELECT jsonb_build_object(
            'type', 'INVOICE',
            'valid', EXISTS(SELECT 1 FROM invoices WHERE invoice_id = p_barcode OR invoice_number = p_barcode),
            'data', row_to_json(i)
        ) INTO result
        FROM invoices i WHERE invoice_id = p_barcode OR invoice_number = p_barcode;
        
    ELSE
        result := jsonb_build_object('type', 'UNKNOWN', 'valid', false);
    END IF;
    
    -- Log the scan
    IF result->>'valid' = 'true' THEN
        INSERT INTO barcode_scans (barcode, barcode_type, created_at)
        VALUES (p_barcode, barcode_type, NOW());
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 12. ORDER STATISTICS FUNCTIONS
-- =====================================================

-- Get Seller Statistics
CREATE OR REPLACE FUNCTION get_seller_stats(p_seller_id TEXT)
RETURNS TABLE (
    total_orders BIGINT,
    total_revenue BIGINT,
    total_rto BIGINT,
    avg_rating NUMERIC,
    total_products BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT o.book_id)::BIGINT as total_orders,
        COALESCE(SUM(o.final_amount)::BIGINT, 0) as total_revenue,
        COUNT(DISTINCT CASE WHEN o.status = 'RTO' THEN o.book_id END)::BIGINT as total_rto,
        COALESCE(AVG(p.rating), 0) as avg_rating,
        COUNT(DISTINCT p.prod_id)::BIGINT as total_products
    FROM sellers s
    LEFT JOIN products p ON s.seller_id = p.seller_id
    LEFT JOIN orders o ON s.seller_id = o.seller_id
    WHERE s.seller_id = p_seller_id
    GROUP BY s.seller_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 13. NOTIFICATION FUNCTIONS
-- =====================================================

-- Create Order Notification
CREATE OR REPLACE FUNCTION create_order_notification()
RETURNS TRIGGER AS $$
BEGIN
    -- Notify seller for new order
    INSERT INTO notifications (user_id, user_type, title, message, type, data)
    VALUES (
        NEW.seller_id,
        'seller',
        'New Order Received',
        'You have received a new order #' || NEW.book_id || ' worth ₹' || NEW.final_amount,
        'order',
        jsonb_build_object('order_id', NEW.book_id, 'amount', NEW.final_amount)
    );
    
    -- Notify customer for order confirmation
    INSERT INTO notifications (user_id, user_type, title, message, type, data)
    VALUES (
        NEW.cust_id,
        'customer',
        'Order Confirmed',
        'Your order #' || NEW.book_id || ' has been confirmed. Cancel Code: ' || NEW.cancel_code,
        'order',
        jsonb_build_object('order_id', NEW.book_id, 'cancel_code', NEW.cancel_code)
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for order notification
CREATE TRIGGER create_order_notification_trigger
    AFTER INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION create_order_notification();

-- =====================================================
-- 14. CLEANUP FUNCTIONS
-- =====================================================

-- Delete expired sessions and old data
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS VOID AS $$
BEGIN
    -- Delete expired cancel codes (mark as expired instead of delete)
    UPDATE orders 
    SET cancel_code = NULL 
    WHERE cancel_code_expiry < NOW() - INTERVAL '7 days';
    
    -- Delete old notifications (older than 30 days)
    DELETE FROM notifications 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Delete unverified users older than 7 days
    -- (Implement based on your user verification logic)
    
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup using pg_cron (if enabled)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('cleanup-job', '0 2 * * *', 'SELECT cleanup_expired_data();');

-- =====================================================
-- 15. HELPER FUNCTIONS
-- =====================================================

-- Get Setting Value
CREATE OR REPLACE FUNCTION get_setting(p_key TEXT)
RETURNS TEXT AS $$
DECLARE
    v_value TEXT;
BEGIN
    SELECT setting_value INTO v_value 
    FROM system_settings 
    WHERE setting_key = p_key;
    
    RETURN v_value;
END;
$$ LANGUAGE plpgsql;

-- Update Setting
CREATE OR REPLACE FUNCTION update_setting(
    p_key TEXT,
    p_value TEXT,
    p_updated_by TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE system_settings 
    SET setting_value = p_value,
        updated_by = p_updated_by,
        updated_at = NOW()
    WHERE setting_key = p_key;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- END OF DATABASE FUNCTIONS
-- =====================================================