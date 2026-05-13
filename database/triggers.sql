-- =====================================================
-- SURIYAWAN SAFFARI - DATABASE TRIGGERS
-- =====================================================
-- Automatic Triggers for:
-- ID Generation, Stock Management, Wallet Updates
-- Trust Score, Notifications, Audit Logs
-- Timestamp Updates, Cancel Code Validation
-- =====================================================

-- =====================================================
-- 1. AUTO TIMESTAMP UPDATE TRIGGERS
-- =====================================================

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sellers_updated_at
    BEFORE UPDATE ON sellers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_riders_updated_at
    BEFORE UPDATE ON riders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. AUTO ID GENERATION TRIGGERS
-- =====================================================

-- Customer ID Generation Trigger
CREATE OR REPLACE FUNCTION auto_generate_cust_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.cust_id IS NULL THEN
        NEW.cust_id := generate_cust_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_cust_id
    BEFORE INSERT ON customers
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_cust_id();

-- Seller ID Generation Trigger
CREATE OR REPLACE FUNCTION auto_generate_seller_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.seller_id IS NULL THEN
        NEW.seller_id := generate_seller_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_seller_id
    BEFORE INSERT ON sellers
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_seller_id();

-- Rider ID Generation Trigger
CREATE OR REPLACE FUNCTION auto_generate_rider_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.rider_id IS NULL THEN
        NEW.rider_id := generate_rider_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_rider_id
    BEFORE INSERT ON riders
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_rider_id();

-- Product ID Generation Trigger
CREATE OR REPLACE FUNCTION auto_generate_prod_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.prod_id IS NULL THEN
        NEW.prod_id := generate_prod_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_prod_id
    BEFORE INSERT ON products
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_prod_id();

-- Order ID Generation Trigger
CREATE OR REPLACE FUNCTION auto_generate_book_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.book_id IS NULL THEN
        NEW.book_id := generate_book_id();
    END IF;
    IF NEW.tracking_id IS NULL THEN
        NEW.tracking_id := generate_tracking_id();
    END IF;
    IF NEW.cancel_code IS NULL THEN
        NEW.cancel_code := generate_cancel_code();
        NEW.cancel_code_expiry := NOW() + INTERVAL '48 hours';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_book_id
    BEFORE INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_book_id();

-- Service ID Generation Trigger
CREATE OR REPLACE FUNCTION auto_generate_serv_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.serv_id IS NULL THEN
        NEW.serv_id := generate_serv_id();
    END IF;
    IF NEW.cancel_code IS NULL THEN
        NEW.cancel_code := generate_cancel_code();
        NEW.cancel_code_expiry := NOW() + INTERVAL '48 hours';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_serv_id
    BEFORE INSERT ON services
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_serv_id();

-- Ticket ID Generation Trigger
CREATE OR REPLACE FUNCTION auto_generate_ticket_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ticket_id IS NULL THEN
        NEW.ticket_id := generate_ticket_id();
    END IF;
    IF NEW.sla_deadline IS NULL THEN
        NEW.sla_deadline := NOW() + INTERVAL '24 hours';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_ticket_id
    BEFORE INSERT ON support_tickets
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_ticket_id();

-- Runsheet ID Generation Trigger
CREATE OR REPLACE FUNCTION auto_generate_run_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.run_id IS NULL THEN
        NEW.run_id := generate_run_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_run_id
    BEFORE INSERT ON runsheets
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_run_id();

-- Return ID Generation Trigger
CREATE OR REPLACE FUNCTION auto_generate_return_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.return_id IS NULL THEN
        NEW.return_id := generate_return_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_return_id
    BEFORE INSERT ON returns
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_return_id();

-- Exchange ID Generation Trigger
CREATE OR REPLACE FUNCTION auto_generate_exchange_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.exchange_id IS NULL THEN
        NEW.exchange_id := generate_exchange_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_exchange_id
    BEFORE INSERT ON exchanges
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_exchange_id();

-- Payout ID Generation Trigger
CREATE OR REPLACE FUNCTION auto_generate_payout_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.payout_id IS NULL THEN
        NEW.payout_id := generate_payout_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_payout_id
    BEFORE INSERT ON payouts
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_payout_id();

-- =====================================================
-- 3. STOCK MANAGEMENT TRIGGERS
-- =====================================================

-- Reduce stock when order placed
CREATE OR REPLACE FUNCTION reduce_stock_on_order()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE products 
    SET stock = stock - NEW.quantity,
        total_sold = total_sold + NEW.quantity,
        updated_at = NOW()
    WHERE prod_id = NEW.prod_id;
    
    -- Check low stock alert
    IF (SELECT stock FROM products WHERE prod_id = NEW.prod_id) <= 5 THEN
        INSERT INTO notifications (user_id, user_type, title, message, type)
        VALUES (
            (SELECT seller_id FROM products WHERE prod_id = NEW.prod_id),
            'seller',
            '⚠️ Low Stock Alert',
            'Your product ' || (SELECT name FROM products WHERE prod_id = NEW.prod_id) || ' has only ' || (SELECT stock FROM products WHERE prod_id = NEW.prod_id) || ' items left!',
            'alert'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_reduce_stock_on_order
    AFTER INSERT ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION reduce_stock_on_order();

-- Restore stock when order cancelled
CREATE OR REPLACE FUNCTION restore_stock_on_cancel()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'CANCELLED' AND OLD.status != 'CANCELLED' THEN
        UPDATE products p
        SET stock = stock + oi.quantity,
            updated_at = NOW()
        FROM order_items oi
        WHERE oi.book_id = NEW.book_id AND p.prod_id = oi.prod_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_restore_stock_on_cancel
    AFTER UPDATE OF status ON orders
    FOR EACH ROW
    EXECUTE FUNCTION restore_stock_on_cancel();

-- =====================================================
-- 4. ORDER STATUS TRANSITION TRIGGERS
-- =====================================================

-- Track status changes
CREATE OR REPLACE FUNCTION track_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status != OLD.status THEN
        -- Record in shipment tracking
        INSERT INTO shipment_tracking (book_id, status, notes, created_at)
        VALUES (NEW.book_id, NEW.status, 'Status changed from ' || OLD.status || ' to ' || NEW.status, NOW());
        
        -- Send notification based on status
        IF NEW.status = 'ACCEPTED' THEN
            INSERT INTO notifications (user_id, user_type, title, message, type)
            VALUES (NEW.cust_id, 'customer', 'Order Accepted', 'Your order #' || NEW.book_id || ' has been accepted by seller.', 'order');
        
        ELSIF NEW.status = 'SHIPPED' THEN
            INSERT INTO notifications (user_id, user_type, title, message, type)
            VALUES (NEW.cust_id, 'customer', 'Order Shipped', 'Your order #' || NEW.book_id || ' has been shipped. Tracking ID: ' || NEW.tracking_id, 'order');
        
        ELSIF NEW.status = 'OUT_FOR_DELIVERY' THEN
            INSERT INTO notifications (user_id, user_type, title, message, type)
            VALUES (NEW.cust_id, 'customer', 'Out for Delivery', 'Your order #' || NEW.book_id || ' is out for delivery. Rider will arrive soon.', 'delivery');
        
        ELSIF NEW.status = 'DELIVERED' THEN
            INSERT INTO notifications (user_id, user_type, title, message, type)
            VALUES (NEW.cust_id, 'customer', 'Order Delivered', 'Your order #' || NEW.book_id || ' has been delivered. Thank you for shopping with us!', 'delivery');
        
        ELSIF NEW.status = 'CANCELLED' THEN
            INSERT INTO notifications (user_id, user_type, title, message, type)
            VALUES (NEW.cust_id, 'customer', 'Order Cancelled', 'Your order #' || NEW.book_id || ' has been cancelled.', 'order');
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_track_order_status
    AFTER UPDATE OF status ON orders
    FOR EACH ROW
    EXECUTE FUNCTION track_order_status_change();

-- =====================================================
-- 5. WALLET AND TRUST SCORE TRIGGERS
-- =====================================================

-- Update trust score on order completion
CREATE OR REPLACE FUNCTION update_trust_score()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'DELIVERED' AND OLD.status != 'DELIVERED' THEN
        UPDATE customers 
        SET trust_score = trust_score + 5,
            updated_at = NOW()
        WHERE cust_id = NEW.cust_id;
    
    ELSIF NEW.status = 'RTO' AND OLD.status != 'RTO' THEN
        UPDATE customers 
        SET trust_score = GREATEST(trust_score - 20, 0),
            updated_at = NOW()
        WHERE cust_id = NEW.cust_id;
        
        -- Check for COD block
        IF (SELECT trust_score FROM customers WHERE cust_id = NEW.cust_id) < 50 THEN
            UPDATE customers 
            SET cod_status = 'BLOCKED',
                cod_block_reason = 'Low trust score - Multiple RTOs',
                cod_block_until = NOW() + INTERVAL '30 days'
            WHERE cust_id = NEW.cust_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_trust_score
    AFTER UPDATE OF status ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_trust_score();

-- Add rider earning on delivery
CREATE OR REPLACE FUNCTION add_rider_earning()
RETURNS TRIGGER AS $$
DECLARE
    rider_rate INTEGER;
BEGIN
    IF NEW.status = 'DELIVERED' AND OLD.status != 'DELIVERED' AND NEW.rider_id IS NOT NULL THEN
        SELECT setting_value::INTEGER INTO rider_rate 
        FROM system_settings WHERE setting_key = 'rider_rate_per_parcel';
        
        IF rider_rate IS NULL THEN rider_rate := 18; END IF;
        
        INSERT INTO wallet_transactions (user_id, user_type, amount, type, reason, reference_id)
        VALUES (NEW.rider_id, 'rider', rider_rate, 'credit', 'Delivery completed for order: ' || NEW.book_id, NEW.book_id);
        
        UPDATE riders 
        SET wallet_balance = wallet_balance + rider_rate,
            total_deliveries = total_deliveries + 1,
            updated_at = NOW()
        WHERE rider_id = NEW.rider_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_add_rider_earning
    AFTER UPDATE OF status ON orders
    FOR EACH ROW
    EXECUTE FUNCTION add_rider_earning();

-- =====================================================
-- 6. VALIDATION TRIGGERS
-- =====================================================

-- Validate product stock before order
CREATE OR REPLACE FUNCTION validate_order_stock()
RETURNS TRIGGER AS $$
DECLARE
    current_stock INTEGER;
BEGIN
    SELECT stock INTO current_stock FROM products WHERE prod_id = NEW.prod_id;
    
    IF current_stock < NEW.quantity THEN
        RAISE EXCEPTION 'Insufficient stock for product %. Available: %, Requested: %', 
            NEW.prod_id, current_stock, NEW.quantity;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_order_stock
    BEFORE INSERT ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION validate_order_stock();

-- Validate cancel code before use
CREATE OR REPLACE FUNCTION validate_cancel_code_usage()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'CANCELLED' AND OLD.status != 'CANCELLED' THEN
        IF NEW.cancel_code_used_by IS NULL THEN
            RAISE EXCEPTION 'Cancel code must be provided to cancel order';
        END IF;
        
        IF NEW.cancel_code_used_at IS NULL THEN
            NEW.cancel_code_used_at := NOW();
        END IF;
        
        -- Log cancel code usage
        INSERT INTO barcode_scans (barcode, barcode_type, scanned_by, scanned_by_type)
        VALUES (OLD.cancel_code, 'CANCEL', NEW.cancel_code_used_by, 'rider');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_cancel_code
    BEFORE UPDATE OF status ON orders
    FOR EACH ROW
    EXECUTE FUNCTION validate_cancel_code_usage();

-- =====================================================
-- 7. REFERRAL TRIGGERS
-- =====================================================

-- Generate referral code for new customer
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
    NEW.referral_code := 'REF' || UPPER(SUBSTRING(MD5(NEW.cust_id::text), 1, 8));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_referral_code
    BEFORE INSERT ON customers
    FOR EACH ROW
    EXECUTE FUNCTION generate_referral_code();

-- Process referral on signup
CREATE OR REPLACE FUNCTION process_referral_on_signup()
RETURNS TRIGGER AS $$
DECLARE
    referrer_id TEXT;
    refer_amount INTEGER;
BEGIN
    IF NEW.referred_by IS NOT NULL THEN
        -- Find referrer by referral code
        SELECT cust_id INTO referrer_id FROM customers WHERE referral_code = NEW.referred_by;
        
        IF referrer_id IS NOT NULL THEN
            -- Create referral record
            INSERT INTO referrals (referrer_cust_id, referred_cust_id, referred_email, status)
            VALUES (referrer_id, NEW.cust_id, NEW.email, 'PENDING');
            
            -- Add coins to referrer (immediate)
            SELECT setting_value::INTEGER INTO refer_amount 
            FROM system_settings WHERE setting_key = 'refer_earn_amount';
            
            IF refer_amount IS NULL THEN refer_amount := 10; END IF;
            
            INSERT INTO coin_transactions (cust_id, coins, type, reason)
            VALUES (referrer_id, refer_amount, 'credit', 'Referral signup bonus');
            
            UPDATE customers SET coins = coins + refer_amount WHERE cust_id = referrer_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_process_referral_on_signup
    AFTER INSERT ON customers
    FOR EACH ROW
    EXECUTE FUNCTION process_referral_on_signup();

-- =====================================================
-- 8. COINS TRIGGERS
-- =====================================================

-- Add coins on product review
CREATE OR REPLACE FUNCTION add_coins_on_review()
RETURNS TRIGGER AS $$
DECLARE
    coins_per_review INTEGER;
BEGIN
    SELECT setting_value::INTEGER INTO coins_per_review 
    FROM system_settings WHERE setting_key = 'coins_per_review';
    
    IF coins_per_review IS NULL THEN coins_per_review := 10; END IF;
    
    INSERT INTO coin_transactions (cust_id, coins, type, reason, reference_id)
    VALUES (NEW.cust_id, coins_per_review, 'credit', 'Product review', NEW.review_id::text);
    
    UPDATE customers SET coins = coins + coins_per_review WHERE cust_id = NEW.cust_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_add_coins_on_review
    AFTER INSERT ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION add_coins_on_review();

-- =====================================================
-- 9. AUDIT LOG TRIGGERS
-- =====================================================

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id SERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_by TEXT,
    changed_at TIMESTAMP DEFAULT NOW()
);

-- Function to log changes
CREATE OR REPLACE FUNCTION log_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (table_name, record_id, action, new_data, changed_by)
        VALUES (TG_TABLE_NAME, NEW.cust_id, 'INSERT', row_to_json(NEW), current_user);
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
        VALUES (TG_TABLE_NAME, NEW.cust_id, 'UPDATE', row_to_json(OLD), row_to_json(NEW), current_user);
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_data, changed_by)
        VALUES (TG_TABLE_NAME, OLD.cust_id, 'DELETE', row_to_json(OLD), current_user);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply audit log to important tables
CREATE TRIGGER audit_customers
    AFTER INSERT OR UPDATE OR DELETE ON customers
    FOR EACH ROW EXECUTE FUNCTION log_changes();

CREATE TRIGGER audit_sellers
    AFTER INSERT OR UPDATE OR DELETE ON sellers
    FOR EACH ROW EXECUTE FUNCTION log_changes();

CREATE TRIGGER audit_orders
    AFTER INSERT OR UPDATE OR DELETE ON orders
    FOR EACH ROW EXECUTE FUNCTION log_changes();

-- =====================================================
-- 10. AUTO DELETE EXPIRED TOKENS
-- =====================================================

-- Delete expired cancel codes (mark as null)
CREATE OR REPLACE FUNCTION cleanup_expired_cancel_codes()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE orders 
    SET cancel_code = NULL 
    WHERE cancel_code_expiry < NOW() - INTERVAL '7 days';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 11. PREVENT SELF REFERRAL
-- =====================================================

CREATE OR REPLACE FUNCTION prevent_self_referral()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.referred_by IS NOT NULL THEN
        IF NEW.referred_by = (SELECT referral_code FROM customers WHERE cust_id = NEW.cust_id) THEN
            RAISE EXCEPTION 'Cannot refer yourself';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_self_referral
    BEFORE UPDATE OF referred_by ON customers
    FOR EACH ROW
    EXECUTE FUNCTION prevent_self_referral();

-- =====================================================
-- 12. UPDATE PRODUCT RATING ON NEW REVIEW
-- =====================================================

CREATE OR REPLACE FUNCTION update_product_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE products 
    SET rating = (
        SELECT AVG(rating)::DECIMAL(3,2) 
        FROM reviews 
        WHERE prod_id = NEW.prod_id
    ),
    total_reviews = (
        SELECT COUNT(*) 
        FROM reviews 
        WHERE prod_id = NEW.prod_id
    )
    WHERE prod_id = NEW.prod_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_product_rating
    AFTER INSERT OR UPDATE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_product_rating();

-- =====================================================
-- END OF TRIGGERS
-- =====================================================