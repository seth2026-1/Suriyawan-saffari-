const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const bwipjs = require('bwip-js');
const QRCode = require('qrcode');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// =====================================================
// BARCODE GENERATION APIs
// =====================================================

// Generate Barcode for any ID
app.post('/api/barcode/generate', async (req, res) => {
    try {
        const { text, type = 'code128' } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }
        
        bwipjs.toBuffer({
            bcid: type,
            text: text,
            scale: 3,
            height: 10,
            includetext: true,
            textxalign: 'center'
        }, (err, png) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.set('Content-Type', 'image/png');
            res.send(png);
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Generate QR Code
app.post('/api/barcode/generate-qr', async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }
        
        const qrBuffer = await QRCode.toBuffer(text, {
            errorCorrectionLevel: 'H',
            margin: 1,
            width: 300
        });
        
        res.set('Content-Type', 'image/png');
        res.send(qrBuffer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Generate Label with Barcode
app.post('/api/barcode/generate-label', async (req, res) => {
    try {
        const { bookId, prodId, customerName, address, cancelCode } = req.body;
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
                    .label { width: 300px; border: 1px solid #000; padding: 10px; }
                    .barcode { text-align: center; margin: 10px 0; }
                    .title { font-size: 14px; font-weight: bold; text-align: center; }
                    .info { font-size: 10px; margin: 5px 0; }
                </style>
            </head>
            <body>
                <div class="label">
                    <div class="title">SURIYAWAN SAFFARI</div>
                    <div class="barcode">
                        <img src="/api/barcode/generate?text=${bookId}" width="250" />
                    </div>
                    <div class="info">Order ID: ${bookId}</div>
                    <div class="info">Product ID: ${prodId}</div>
                    <div class="info">Customer: ${customerName}</div>
                    <div class="info">Address: ${address}</div>
                    <div class="info">Cancel Code: ${cancelCode}</div>
                    <div class="barcode">
                        <img src="/api/barcode/generate-qr?text=${cancelCode}" width="80" />
                    </div>
                </div>
            </body>
            </html>
        `;
        
        res.send(html);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Generate Invoice
app.post('/api/barcode/generate-invoice', async (req, res) => {
    try {
        const { bookId, custId, sellerId, items, total, date } = req.body;
        
        let itemsHtml = '';
        items.forEach(item => {
            itemsHtml += `
                <tr>
                    <td>${item.name}</td>
                    <td>${item.quantity}</td>
                    <td>₹${item.price}</td>
                    <td>₹${item.total}</td>
                </tr>
            `;
        });
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .invoice { max-width: 800px; margin: auto; border: 1px solid #ddd; padding: 20px; }
                    .header { text-align: center; border-bottom: 2px solid #f59e0b; padding-bottom: 10px; }
                    .title { font-size: 24px; font-weight: bold; color: #1e3a8a; }
                    .subtitle { color: #f59e0b; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background: #f3f4f6; }
                    .total { text-align: right; font-size: 18px; font-weight: bold; margin-top: 20px; }
                    .barcode { text-align: center; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="invoice">
                    <div class="header">
                        <div class="title">SURIYAWAN SAFFARI</div>
                        <div class="subtitle">TAX INVOICE</div>
                    </div>
                    
                    <div class="barcode">
                        <img src="/api/barcode/generate?text=INV${bookId}" width="200" />
                    </div>
                    
                    <div class="barcode">
                        <img src="/api/barcode/generate-qr?text=INV${bookId}" width="100" />
                    </div>
                    
                    <table>
                        <tr><td><strong>Order ID:</strong></td><td>${bookId}</td></tr>
                        <tr><td><strong>Customer ID:</strong></td><td>${custId}</td></tr>
                        <tr><td><strong>Seller ID:</strong></td><td>${sellerId}</td></tr>
                        <tr><td><strong>Date:</strong></td><td>${date}</td></tr>
                    </table>
                    
                    <table>
                        <thead>
                            <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                    </table>
                    
                    <div class="total">
                        Total Amount: ₹${total}
                    </div>
                    
                    <div style="margin-top: 30px; text-align: center; font-size: 12px;">
                        <div>Cash on Delivery Only | No Online Payment</div>
                        <div>Cancellation Code: Use at time of delivery</div>
                        <div>Open Box Delivery Mandatory</div>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        res.send(html);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =====================================================
// CUSTOMER APIs
// =====================================================

// Get Products
app.get('/api/customer/products', async (req, res) => {
    try {
        const { category, search, sort, page = 1, limit = 20 } = req.query;
        
        let query = supabase
            .from('products')
            .select('*, sellers(shop_name, rating)', { count: 'exact' })
            .eq('is_active', true);
        
        if (category && category !== 'all') {
            query = query.eq('category_id', category);
        }
        
        if (search) {
            query = query.ilike('name', `%${search}%`);
        }
        
        if (sort === 'price_asc') {
            query = query.order('selling_price', { ascending: true });
        } else if (sort === 'price_desc') {
            query = query.order('selling_price', { ascending: false });
        } else if (sort === 'rating') {
            query = query.order('rating', { ascending: false });
        } else {
            query = query.order('created_at', { ascending: false });
        }
        
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        
        const { data, error, count } = await query.range(from, to);
        
        if (error) throw error;
        
        res.json({ success: true, products: data, total: count, page, limit });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get Single Product
app.get('/api/customer/product-detail', async (req, res) => {
    try {
        const { prod_id } = req.query;
        
        const { data, error } = await supabase
            .from('products')
            .select('*, sellers(shop_name, rating, seller_id), product_variations(*)')
            .eq('prod_id', prod_id)
            .single();
        
        if (error) throw error;
        
        res.json({ success: true, product: data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add to Cart
app.post('/api/customer/cart', async (req, res) => {
    try {
        const { cust_id, prod_id, quantity, variation_id } = req.body;
        
        const { data, error } = await supabase
            .from('cart')
            .upsert({
                cust_id,
                prod_id,
                quantity,
                variation_id,
                added_at: new Date()
            });
        
        if (error) throw error;
        
        res.json({ success: true, message: 'Added to cart' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get Cart
app.get('/api/customer/cart', async (req, res) => {
    try {
        const { cust_id } = req.query;
        
        const { data, error } = await supabase
            .from('cart')
            .select('*, products(*)')
            .eq('cust_id', cust_id);
        
        if (error) throw error;
        
        let total = 0;
        data.forEach(item => {
            total += item.products.selling_price * item.quantity;
        });
        
        res.json({ success: true, cart: data, total });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Place Order (COD Only)
app.post('/api/customer/order', async (req, res) => {
    try {
        const { cust_id, seller_id, items, address, total_amount, delivery_charge, final_amount } = req.body;
        
        // Generate BOOK ID
        const date = new Date();
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
        const { data: lastOrder } = await supabase
            .from('orders')
            .select('book_id')
            .order('created_at', { ascending: false })
            .limit(1);
        
        let serial = '0001';
        if (lastOrder && lastOrder.length > 0) {
            const lastSerial = parseInt(lastOrder[0].book_id.slice(-4));
            serial = String(lastSerial + 1).padStart(4, '0');
        }
        
        const bookId = `BOOK${dateStr}${serial}`;
        
        // Generate Cancel Code (6 digit)
        const cancelCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Generate Tracking ID (AWB)
        const { data: lastTrack } = await supabase
            .from('orders')
            .select('tracking_id')
            .order('created_at', { ascending: false })
            .limit(1);
        
        let trackSerial = '000000000001';
        if (lastTrack && lastTrack.length > 0) {
            const lastTrackSerial = parseInt(lastTrack[0].tracking_id.slice(-12));
            trackSerial = String(lastTrackSerial + 1).padStart(12, '0');
        }
        
        const trackingId = `SS${dateStr}${trackSerial}`;
        
        // Create order
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                book_id: bookId,
                cust_id,
                seller_id,
                tracking_id: trackingId,
                cancel_code: cancelCode,
                cancel_code_expiry: new Date(Date.now() + 48 * 60 * 60 * 1000),
                status: 'PENDING',
                total_amount,
                delivery_charge,
                discount_amount: 0,
                final_amount,
                payment_method: 'COD',
                address
            })
            .select()
            .single();
        
        if (orderError) throw orderError;
        
        // Create order items
        for (const item of items) {
            const { error: itemError } = await supabase
                .from('order_items')
                .insert({
                    book_id: bookId,
                    prod_id: item.prod_id,
                    quantity: item.quantity,
                    price_at_time: item.price
                });
            
            if (itemError) throw itemError;
        }
        
        // Clear cart
        await supabase
            .from('cart')
            .delete()
            .eq('cust_id', cust_id);
        
        res.json({
            success: true,
            order: order,
            cancel_code: cancelCode,
            tracking_id: trackingId,
            message: 'Order placed successfully'
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Track Order
app.get('/api/customer/order-track', async (req, res) => {
    try {
        const { book_id } = req.query;
        
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('*, order_items(*, products(*))')
            .eq('book_id', book_id)
            .single();
        
        if (orderError) throw orderError;
        
        const { data: tracking, error: trackError } = await supabase
            .from('shipment_tracking')
            .select('*')
            .eq('book_id', book_id)
            .order('created_at', { ascending: false });
        
        if (trackError) throw trackError;
        
        res.json({
            success: true,
            order,
            tracking_history: tracking,
            current_status: order.status,
            cancel_code: order.cancel_code,
            tracking_id: order.tracking_id
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Cancel Order with Code
app.post('/api/customer/cancel-order', async (req, res) => {
    try {
        const { book_id, cancel_code, rider_id, reason } = req.body;
        
        // Verify cancel code
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('*')
            .eq('book_id', book_id)
            .eq('cancel_code', cancel_code)
            .single();
        
        if (orderError || !order) {
            return res.status(400).json({ success: false, error: 'Invalid cancel code' });
        }
        
        // Check expiry
        if (new Date(order.cancel_code_expiry) < new Date()) {
            return res.status(400).json({ success: false, error: 'Cancel code expired' });
        }
        
        // Check if already delivered
        if (order.status === 'DELIVERED') {
            return res.status(400).json({ success: false, error: 'Order already delivered, cannot cancel' });
        }
        
        // Update order status
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                status: 'CANCELLED',
                cancelled_at: new Date(),
                cancel_reason: reason
            })
            .eq('book_id', book_id);
        
        if (updateError) throw updateError;
        
        // Add tracking entry
        await supabase
            .from('shipment_tracking')
            .insert({
                book_id,
                status: 'CANCELLED',
                rider_id,
                notes: `Cancelled by customer with code: ${cancel_code}. Reason: ${reason}`,
                created_at: new Date()
            });
        
        res.json({ success: true, message: 'Order cancelled successfully' });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================
// SELLER APIs
// =====================================================

// Add Product with Barcode
app.post('/api/seller/add-product', async (req, res) => {
    try {
        const { seller_id, name, description, mrp, selling_price, stock, category_id, tags, images } = req.body;
        
        // Generate PROD ID
        const date = new Date();
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
        const { data: lastProd } = await supabase
            .from('products')
            .select('prod_id')
            .order('created_at', { ascending: false })
            .limit(1);
        
        let serial = '0001';
        if (lastProd && lastProd.length > 0) {
            const lastSerial = parseInt(lastProd[0].prod_id.slice(-4));
            serial = String(lastSerial + 1).padStart(4, '0');
        }
        
        const prodId = `PROD${dateStr}${serial}`;
        
        const { data, error } = await supabase
            .from('products')
            .insert({
                prod_id: prodId,
                seller_id,
                name,
                description,
                mrp,
                selling_price,
                stock,
                category_id,
                tags,
                images,
                is_active: true
            })
            .select()
            .single();
        
        if (error) throw error;
        
        res.json({
            success: true,
            product: data,
            barcode_url: `/api/barcode/generate?text=${prodId}`,
            qr_url: `/api/barcode/generate-qr?text=${prodId}`
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get Seller Orders
app.get('/api/seller/orders', async (req, res) => {
    try {
        const { seller_id, status, page = 1, limit = 20 } = req.query;
        
        let query = supabase
            .from('orders')
            .select('*, order_items(*, products(*))', { count: 'exact' })
            .eq('seller_id', seller_id);
        
        if (status && status !== 'all') {
            query = query.eq('status', status);
        }
        
        query = query.order('placed_at', { ascending: false });
        
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        
        const { data, error, count } = await query.range(from, to);
        
        if (error) throw error;
        
        res.json({ success: true, orders: data, total: count, page, limit });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================
// LOGISTICS APIs
// =====================================================

// Scan Barcode (Hub Inbound)
app.post('/api/logistics/hub/inbound-scan', async (req, res) => {
    try {
        const { barcode, hub_id, location } = req.body;
        
        // Check if barcode is BOOK ID or AWB
        let bookId = barcode;
        if (barcode.startsWith('SS')) {
            const { data: order } = await supabase
                .from('orders')
                .select('book_id')
                .eq('tracking_id', barcode)
                .single();
            
            if (order) {
                bookId = order.book_id;
            }
        }
        
        // Update order status
        const { error: orderError } = await supabase
            .from('orders')
            .update({ status: 'SHIPPED' })
            .eq('book_id', bookId);
        
        if (orderError) throw orderError;
        
        // Add tracking entry
        const { error: trackError } = await supabase
            .from('shipment_tracking')
            .insert({
                book_id: bookId,
                status: 'INBOUND_SCAN',
                location,
                notes: `Scanned at hub: ${hub_id}`,
                created_at: new Date()
            });
        
        if (trackError) throw trackError;
        
        res.json({ success: true, message: 'Scan successful', book_id: bookId });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Scan Barcode (Delivery by Rider)
app.post('/api/logistics/rider/delivery-scan', async (req, res) => {
    try {
        const { barcode, rider_id, location, lat, lng } = req.body;
        
        let bookId = barcode;
        if (barcode.startsWith('SS')) {
            const { data: order } = await supabase
                .from('orders')
                .select('book_id')
                .eq('tracking_id', barcode)
                .single();
            
            if (order) {
                bookId = order.book_id;
            }
        }
        
        // Update order status
        const { error: orderError } = await supabase
            .from('orders')
            .update({ status: 'OUT_FOR_DELIVERY' })
            .eq('book_id', bookId);
        
        if (orderError) throw orderError;
        
        // Add tracking with GPS
        const { error: trackError } = await supabase
            .from('shipment_tracking')
            .insert({
                book_id: bookId,
                status: 'OUT_FOR_DELIVERY',
                location,
                lat,
                lng,
                rider_id,
                created_at: new Date()
            });
        
        if (trackError) throw trackError;
        
        res.json({ success: true, message: 'Delivery scan successful' });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Complete Delivery with Open Box
app.post('/api/logistics/rider/complete-delivery', async (req, res) => {
    try {
        const { book_id, rider_id, customer_sign, product_photo, cash_collected } = req.body;
        
        // Update order
        const { error: orderError } = await supabase
            .from('orders')
            .update({
                status: 'DELIVERED',
                delivered_at: new Date()
            })
            .eq('book_id', book_id);
        
        if (orderError) throw orderError;
        
        // Add to rider wallet
        const riderRate = parseInt(process.env.RIDER_RATE_PER_PARCEL) || 18;
        
        await supabase
            .from('wallet_transactions')
            .insert({
                user_id: rider_id,
                user_type: 'rider',
                amount: riderRate,
                type: 'credit',
                reason: `Delivery completed for order ${book_id}`,
                created_at: new Date()
            });
        
        // Add tracking
        await supabase
            .from('shipment_tracking')
            .insert({
                book_id,
                status: 'DELIVERED',
                rider_id,
                notes: `Open box delivery completed. Cash collected: ₹${cash_collected}`,
                created_at: new Date()
            });
        
        res.json({ success: true, message: 'Delivery completed' });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================
// OWNER APIs
// =====================================================

// Get Dashboard Stats
app.get('/api/owner/dashboard', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const [totalCustomers, totalSellers, totalRiders, todayOrders, totalOrders, totalRevenue] = await Promise.all([
            supabase.from('customers').select('*', { count: 'exact', head: true }),
            supabase.from('sellers').select('*', { count: 'exact', head: true }),
            supabase.from('riders').select('*', { count: 'exact', head: true }),
            supabase.from('orders').select('*', { count: 'exact', head: true }).gte('placed_at', today.toISOString()),
            supabase.from('orders').select('*', { count: 'exact', head: true }),
            supabase.from('orders').select('final_amount').eq('status', 'DELIVERED')
        ]);
        
        let revenue = 0;
        if (totalRevenue.data) {
            revenue = totalRevenue.data.reduce((sum, order) => sum + order.final_amount, 0);
        }
        
        res.json({
            success: true,
            stats: {
                total_customers: totalCustomers.count,
                total_sellers: totalSellers.count,
                total_riders: totalRiders.count,
                today_orders: todayOrders.count,
                total_orders: totalOrders.count,
                total_revenue: revenue
            }
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create Seller ID (Manual)
app.post('/api/owner/users/create-seller', async (req, res) => {
    try {
        const { email, mobile, shop_name, owner_name, upi_id, gst_number } = req.body;
        
        const date = new Date();
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
        const { data: lastSeller } = await supabase
            .from('sellers')
            .select('seller_id')
            .order('created_at', { ascending: false })
            .limit(1);
        
        let serial = '0001';
        if (lastSeller && lastSeller.length > 0) {
            const lastSerial = parseInt(lastSeller[0].seller_id.slice(-4));
            serial = String(lastSerial + 1).padStart(4, '0');
        }
        
        const sellerId = `SELL${dateStr}${serial}`;
        
        const { data, error } = await supabase
            .from('sellers')
            .insert({
                seller_id: sellerId,
                email,
                mobile,
                shop_name,
                owner_name,
                upi_id,
                gst_number,
                kyc_status: 'PENDING',
                is_active: true
            })
            .select()
            .single();
        
        if (error) throw error;
        
        res.json({
            success: true,
            seller: data,
            barcode_url: `/api/barcode/generate?text=${sellerId}`,
            message: 'Seller created successfully'
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================
// Start Server
// =====================================================

app.listen(PORT, () => {
    console.log(`🚀 Suriyawan Saffari Server running on port ${PORT}`);
    console.log(`📱 Customer Portal: http://localhost:${PORT}/customer/index.html`);
    console.log(`🏪 Seller Portal: http://localhost:${PORT}/seller/index.html`);
    console.log(`🚚 Logistics Portal: http://localhost:${PORT}/logistics/hub/index.html`);
    console.log(`👑 Owner Portal: http://localhost:${PORT}/owner/index.html`);
});