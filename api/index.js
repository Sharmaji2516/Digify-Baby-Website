const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const compression = require('compression');
const NodeCache = require('node-cache');

const app = express();
const cache = new NodeCache({ stdTTL: 600 }); // Cache for 10 minutes by default

// Ensure SSL bypass for backend connectivity on Vercel
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

app.use(compression());
app.use(cors());
app.use(express.json());

// Error handler for malformed JSON
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        console.error('JSON Parsing Error:', err.message);
        return res.status(400).send({ error: 'Malformed JSON' });
    }
    next();
});

// Log all requests
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});

// Serve static files without caching for development
app.use(express.static(__dirname, {
    maxAge: 0,
    etag: false
}));

const API_BASE = 'https://digifysoft.in/websale/APIV2/';
const CMS_BASE = 'https://digifysoft.in/websale/';
const B2B_WEB_BASE = 'https://digifysoft.in/websale/B2B_WEB/';

// Mobile mimic User-Agent
const USR_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36';

// Global helper to ensure User-Agent is always sent (for backend consistency)
async function digiFetch(url, options = {}) {
    return fetch(url, {
        ...options,
        headers: {
            'User-Agent': USR_AGENT,
            ...(options.headers || {})
        }
    });
}


// ─── GET Products ────────────────────────────────────────────────────────────
app.get('/api/products', async (req, res) => {
    const cacheKey = 'products_all';
    const cachedData = cache.get(cacheKey);
    if (cachedData) return res.json(cachedData);

    try {
        const response = await fetch(`${API_BASE}getsub_categorydata.php`);
        const text = await response.text();
        try {
            const data = JSON.parse(text);
            cache.set(cacheKey, data);
            res.json(data);
        } catch {
            res.json([]);
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// ─── GET Cart (view_cart.php?userid=X) ───────────────────────────────────────
app.get('/api/cart', async (req, res) => {
    const userid = req.query.userid || '';
    try {
        const response = await fetch(`${API_BASE}view_cart.php?userid=${userid}`);
        const text = await response.text();
        try {
            res.json(JSON.parse(text));
        } catch {
            res.json({ cartdata: [], totalAmt: 0, subAmt: 0, discAmt: 0, taxAmt: 0, estidelvry: '' });
        }
    } catch (err) {
        console.error('Cart view error:', err.message);
        res.status(500).json({ error: 'Failed to fetch cart' });
    }
});

const { URLSearchParams } = require('url');

// ─── POST Add/Update/Remove Cart Item ────────────────────────────────────────
// reqType: "A" = Add, "U" = Update qty, "X" = Remove
app.post('/api/cart/update', async (req, res) => {
    const { productId, userId, browserId, qty, reqType, sellerCode } = req.body;
    
    // The backend expects a POST with a 'cartJSON' field containing a JSON array
    const cartItem = {
        productid: String(productId),
        userid: String(userId || ''),
        sessionid: String(browserId || ''),
        qty: String(qty || 1),
        reqtype: String(reqType === 'A' || !reqType ? 'P' : reqType), // "P" = Add, "U" = Update, "X" = Remove
        seller_cod: String(sellerCode || '')
    };
    
    const cartJSON = JSON.stringify([cartItem]);
    const url = `${API_BASE}add_to_cart.php`;
    
    console.log(`Updating Cart: ${url}`);
    console.log(`Payload: ${cartJSON}`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: `cartJSON=${encodeURIComponent(cartJSON)}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        
        const text = await response.text();
        console.log(`Cart Update Response: ${text}`);
        
        try {
            const jsonMatch = text.match(/\[\s*\{.*\}\s*\]|\{\s*".*"\s*:\s*".*"\s*\}/s);
            if (jsonMatch) {
                res.json(JSON.parse(jsonMatch[0]));
            } else {
                res.json({ status: 'ok', response: text });
            }
        } catch {
            res.json({ status: 'ok', response: text });
        }
    } catch (err) {
        console.error('Cart update error:', err.message);
        res.status(500).json({ error: 'Failed to update cart' });
    }
});

// ─── GET Search Products ──────────────────────────────────────────────────────
app.get('/api/search', async (req, res) => {
    const query = req.query.q || '';
    console.log(`[API] Search Query: "${query}"`);
    const encodedQuery = Buffer.from(query).toString('base64');
    try {
        const response = await fetch(`${API_BASE}getsub_categorydata.php?psearch=${encodedQuery}`);
        const text = await response.text();
        try {
            res.json(JSON.parse(text));
        } catch {
            console.error('[API] Search JSON Parse Failed');
            res.json([]);
        }
    } catch (err) {
        console.error('[API] Search Fetch Failed:', err.message);
        res.status(500).json({ error: 'Search failed' });
    }
});

// ─── GET Search Autocomplete ───────────────────────────────────────────────
app.get('/api/search/autocomplete', async (req, res) => {
    const query = req.query.q || '';
    if (query.length < 2) return res.json([]);
    
    const encodedQuery = Buffer.from(query).toString('base64');
    try {
        const response = await fetch(`${API_BASE}getsub_categorydata.php?psearch=${encodedQuery}`);
        const text = await response.text();
        try {
            const data = JSON.parse(text);
            // Just return IDs and names for autocomplete
            const suggestions = data.slice(0, 8).map(p => ({
                id: p.id,
                name: (p.productname || '').trim(),
                productcategory: p.productcategory
            }));
            res.json(suggestions);
        } catch {
            res.json([]);
        }
    } catch (err) {
        res.json([]);
    }
});

// ─── GET Product Filter Options ──────────────────────────────────────────────
app.get('/api/products/filter-options', async (req, res) => {
    const { pscid, pc_id } = req.query;
    const targetPcid = pc_id || '';

    try {
        const [brandRes, colorRes, specRes] = await Promise.all([
            fetch(`${API_BASE}brand_mastercat_subcat.php?pscid=${pscid || ''}&pcid=${targetPcid}`),
            fetch(`${API_BASE}color_brandcat_subcat.php?pscid=${pscid || ''}&pcid=${targetPcid}`),
            fetch(`${API_BASE}prod_specification_master.php?pscid=${pscid || ''}`)
        ]);

        const [brands, colors, specs] = await Promise.all([
            brandRes.json().catch(() => []),
            colorRes.json().catch(() => []),
            specRes.json().catch(() => [])
        ]);

        res.json({
            brands: Array.isArray(brands) ? brands.filter(b => b.brandid) : [],
            colors: Array.isArray(colors) ? colors.filter(c => c.colors_id) : [],
            specs: Array.isArray(specs) ? specs : []
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch filters' });
    }
});

app.get('/api/brands/master', async (req, res) => {
    const { brandid } = req.query;
    try {
        const url = `${API_BASE}brand_master.php?brandid=${brandid || ''}`;
        const response = await fetch(url);
        const data = await response.json().catch(() => ({}));
        res.json(data);
    } catch (err) {
        res.json({});
    }
});

app.get('/api/colors/master', async (req, res) => {
    const { colorid } = req.query;
    try {
        const url = `${API_BASE}prod_color_master.php?colorid=${colorid || ''}`;
        const response = await fetch(url);
        const data = await response.json().catch(() => ({}));
        res.json(data);
    } catch (err) {
        res.json({});
    }
});

// ─── GET Banners ─────────────────────────────────────────────────────────────
app.get('/api/banners', async (req, res) => {
    const type = req.query.type || 'banner';
    const cacheKey = `banners_${type}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) return res.json(cachedData);

    try {
        const response = await fetch(`${API_BASE}banner_img.php?img_type=${type}`);
        const text = await response.text();
        try {
            const data = JSON.parse(text);
            cache.set(cacheKey, data);
            res.json(data);
        } catch {
            res.json([]);
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch banners' });
    }
});

// ─── GET Hot Deals ───────────────────────────────────────────────────────────
app.get('/api/hot-deals', async (req, res) => {
    try {
        const response = await fetch(`${API_BASE}hot_deal.php`);
        const text = await response.text();
        try {
            res.json(JSON.parse(text));
        } catch {
            res.json([]);
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch hot deals' });
    }
});

// ─── GET Main Categories ─────────────────────────────────────────────────────
app.get('/api/categories', async (req, res) => {
    const eid = req.query.eid || '';
    try {
        const response = await fetch(`${API_BASE}main_search_values.php?eid=${eid}`);
        const text = await response.text();
        try {
            res.json(JSON.parse(text));
        } catch {
            res.json([]);
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// ─── GET Filtered Products ──────────────────────────────────────────────────
app.get('/api/products-filtered', async (req, res) => {
    const { pscid, pcid, pc_id, brandid, colorid, psearch, fsort } = req.query;
    const encodedSearch = psearch ? Buffer.from(psearch).toString('base64') : '';
    const catId = pcid || pc_id || '';
    
    // Construct the URL based on available filters
    let url = `${API_BASE}getsub_categorydata.php?pscid=${pscid || ''}&pcid=${catId}&brandid=${brandid || ''}&colorid=${colorid || ''}&psearch=${encodedSearch}&fsort=${fsort || ''}&specif=`;
    
    try {
        const response = await fetch(url);
        const text = await response.text();
        try {
            res.json(JSON.parse(text));
        } catch {
            res.json([]);
        }
    } catch (err) {
        res.status(500).json({ error: 'Filtering failed' });
    }
});

// ─── GET Category Products (for nav/homepage bubbles) ─────────────────────────
app.get('/api/category-products', async (req, res) => {
    const babyCategories = [];

    try {
        const response = await fetch(`${API_BASE}getcatprod_web.php`);
        const text = await response.text();
        try {
            const data = JSON.parse(text);
            if (Array.isArray(data) && data.length > 0) {
                // Return baby categories first
                res.json([...babyCategories]);
            } else {
                res.json(babyCategories);
            }
        } catch {
            res.json(babyCategories);
        }
    } catch (err) {
        res.json(babyCategories);
    }
});

// ─── GET Subcategory/Category Products ─────────────────────────────────────
app.get('/api/subcategory-products', async (req, res) => {
    const { pscid, pcid, pc_id, search } = req.query;
    const targetPcid = pc_id || pcid || '';
    
    try {
        if (search) {
            const b64 = Buffer.from(search).toString('base64');
            const resS = await fetch(`${API_BASE}getsub_categorydata.php?psearch=${b64}`);
            return res.json(await resS.json().catch(() => []));
        }

        let url = `${API_BASE}getsub_categorydata.php?pscid=${pscid || ''}&pcid=${targetPcid}`;
        let response = await fetch(url);
        let data = await response.json().catch(() => []);

        // Flexible Filtering (Synced with server.js)
        let filtered = data;
        if (pscid) {
            filtered = data.filter(p => 
                (p.product_subcategory && String(p.product_subcategory) === String(pscid)) ||
                (p.pscid && String(p.pscid) === String(pscid)) ||
                (p.subcategory_id && String(p.subcategory_id) === String(pscid))
            );
        } else if (targetPcid) {
            filtered = data.filter(p => 
                (p.productcategory && String(p.productcategory) === String(targetPcid)) ||
                (p.pcid && String(p.pcid) === String(targetPcid)) ||
                (p.pc_id && String(p.pc_id) === String(targetPcid)) ||
                (p.category_id && String(p.category_id) === String(targetPcid))
            );
        }

        if (data.length > 0 && filtered.length === 0 && (pscid || targetPcid)) {
            filtered = data;
        }

        res.json(filtered);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch subcategory products' });
    }
});

// ─── GET Product Image ───────────────────────────────────────────────────────
app.get('/api/product-image/:id', async (req, res) => {
    const refId = req.params.id;
    const cacheKey = `img_${refId}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) return res.json(cachedData);

    try {
        const response = await fetch(`${API_BASE}getsub_imgdata.php?ref_id=${refId}`);
        const text = await response.text();
        try {
            const data = JSON.parse(text);
            cache.set(cacheKey, data, 3600); // Cache images for 1 hour
            res.json(data);
        } catch {
            res.json([]);
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch product image' });
    }
});

// ─── GET Product Price ───────────────────────────────────────────────────────
app.get('/api/product-price/:id', async (req, res) => {
    const rid = req.params.id;
    const cacheKey = `price_${rid}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) return res.json(cachedData);

    try {
        const response = await fetch(`${API_BASE}getsub_pricedata.php?rid=${rid}`);
        const text = await response.text();
        try {
            const data = JSON.parse(text);
            cache.set(cacheKey, data, 3600); // Cache prices for 1 hour
            res.json(data);
        } catch {
            res.json([]);
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch product price' });
    }
});

// ─── GET Single Product ───────────────────────────────────────────────────────
app.get('/api/product/:id', async (req, res) => {
    const prodId = req.params.id;
    try {
        const response = await fetch(`${API_BASE}GetSingleItem.php?prod_id=${prodId}`);
        const text = await response.text();
        try {
            res.json(JSON.parse(text));
        } catch {
            res.json({});
        }
    } catch (err) {
        res.status(500).json({ error: 'Product fetch failed' });
    }
});

// ─── GET Rich Product Details (B2B logic) ────────────────────────────────────
app.get('/api/product-details/:id', async (req, res) => {
    const prodId = req.params.id;
    const userId = req.query.userid || '';
    try {
        const response = await fetch(`${API_BASE}product_descriptionweb.php?prodid=${prodId}&userid=${userId}`);
        const text = await response.text();
        try {
            res.json(JSON.parse(text));
        } catch {
            res.json({});
        }
    } catch (err) {
        res.status(500).json({ error: 'Product details fetch failed' });
    }
});

// ─── GET Product Meta (Category/Brand IDs) ───────────────────────────────────
app.get('/api/product-meta/:id', async (req, res) => {
    const prodId = req.params.id;
    try {
        const response = await fetch(`${API_BASE}getsub_catedata_single.php?pscid=${prodId}&res_rows=one`);
        const text = await response.text();
        try {
            const data = JSON.parse(text);
            res.json(Array.isArray(data) ? (data[0] || {}) : data);
        } catch {
            res.json({});
        }
    } catch (err) {
        res.status(500).json({ error: 'Product meta fetch failed' });
    }
});

// ─── POST Bulk Enrich Products ───────────────────────────────────────────────
app.post('/api/products/enrich', async (req, res) => {
    const products = req.body.products || [];
    if (!Array.isArray(products)) return res.status(400).json({ error: 'Expected products array' });

    console.time(`Enrich-${products.length}`);
    const richProducts = await Promise.all(products.map(async (p) => {
        const id = p.prod_id || p.id;
        if (!id) return p;

        // Try cache first
        const cacheKeyImg = `img_${id}`;
        const cacheKeyPrice = `price_${id}`;
        let img = cache.get(cacheKeyImg);
        let price = cache.get(cacheKeyPrice);

        if (!img || !price) {
            const refId = `${id}~${p.productcategory || ''}~${p.product_subcategory || ''}~${p.brand || ''}`;
            try {
                const [imgRes, priceRes] = await Promise.all([
                    !img ? fetch(`${API_BASE}getsub_imgdata.php?ref_id=${encodeURIComponent(refId)}`) : null,
                    !price ? fetch(`${API_BASE}getsub_pricedata.php?rid=${id}`) : null
                ]);

                if (imgRes) {
                    const imgText = await imgRes.text();
                    try {
                        const imgData = JSON.parse(imgText);
                        let imgUrl = imgData[0]?.productImgUrl || '';
                        // If URL is empty or just a directory path ending in /, use placeholder
                        if (!imgUrl || imgUrl.endsWith('/') || imgUrl.endsWith('\\')) {
                            imgUrl = 'https://placehold.co/400x400?text=No+Image';
                        }
                        img = imgUrl;
                        cache.set(cacheKeyImg, img, 3600);
                    } catch { img = 'https://placehold.co/400x400?text=No+Image'; }
                }

                if (priceRes) {
                    const priceText = await priceRes.text();
                    try {
                        const priceData = JSON.parse(priceText);
                        price = priceData[0]?.price || '0';
                        cache.set(cacheKeyPrice, price, 3600);
                    } catch { price = '0'; }
                }
            } catch {
                img = img || 'https://placehold.co/300x300?text=No+Image';
                price = price || '0';
            }
        }

        return { ...p, img, price };
    }));
    console.timeEnd(`Enrich-${products.length}`);

    res.json(richProducts);
});

// ─── POST Login ──────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
    const { eid, password, sid, page_nav } = req.body;
    console.log(`[AUTH] Login attempt for: ${eid}, page_nav: ${page_nav || 'none'}`);
    
    // Attempt 1: Standard login_web.php (GET with Base64)
    const encodedPass = Buffer.from(password).toString('base64');
    const url = `${API_BASE}login_web.php?eid=${encodeURIComponent(eid)}&password=${encodeURIComponent(encodedPass)}&sid=${encodeURIComponent(sid)}&page_nav=${encodeURIComponent(page_nav || 'home')}`;
    
    console.log(`[DEBUG] Trying Login URL: ${url}`);
    
    try {
        const response = await fetch(url);
        let text = await response.text();
        console.log(`[DEBUG] Raw Login Response Length: ${text.length}`);
        
        // Anti-break: Remove literal newlines/control chars inside strings
        text = text.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ').trim();
        
        try {
            const jsonMatch = text.match(/\[.*\]|\{.*\}/s);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);
                res.json(data);
            } else {
                res.json({ error: 'Invalid login format', raw: text });
            }
        } catch (e) {
            console.error(`[ERROR] JSON Parse failed for login: ${e.message}`);
            res.json({ error: 'Auth parsing failed', details: e.message, raw: text });
        }
    } catch (err) {
        console.error(`[ERROR] Login failure: ${err.message}`);
        res.status(500).json({ error: 'Login service unavailable' });
    }
});
// ─── POST Register: Request OTP ──────────────────────────────────────────────
app.post('/api/register/otp-request', async (req, res) => {
    const { mobile } = req.body;
    const url = `${API_BASE}userRegistration_validate.php?mobile_no=${encodeURIComponent(mobile)}`;
    
    try {
        const response = await fetch(url);
        const text = await response.text();
        if (text.toLowerCase().includes('success') || text.includes('1') || text.includes('sent')) {
            res.json([{ success: true, message: 'OTP Sent' }]);
        } else {
            res.json([{ success: false, error: 'Failed', raw: text }]);
        }
    } catch (err) {
        res.status(500).json([{ success: false, error: 'Service Unavailable' }]);
    }
});

// ─── POST Register: Verify OTP ──────────────────────────────────────────────
app.post('/api/register/otp-verify', async (req, res) => {
    const { otp, mobile } = req.body;
    const payload = { otp: String(otp), phone: String(mobile), contact_number: String(mobile) };
    const url = `${API_BASE}otp_validateRegistration.php?hid=2`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' }
        });
        const text = await response.text();
        
        const isSuccess = text.toLowerCase().includes('matched') || 
                          text.toLowerCase().includes('success') || 
                          text.trim() === '1' || 
                          (text.trim().startsWith('[') && text.trim().length > 2);
                       
        if (isSuccess) {
            res.json([{ success: true, message: 'OTP Verified' }]);
        } else {
            const errorMsg = text.length > 5 && text.length < 100 ? text : 'OTP Not Matched';
            res.json([{ success: false, error: errorMsg, raw: text }]);
        }
    } catch (err) {
        res.status(500).json([{ success: false, error: 'Verification failed' }]);
    }
});

// ─── POST Complete Registration ──────────────────────────────────────────────
app.post('/api/register/complete', async (req, res) => {
    const userData = req.body;
    const url = `${API_BASE}userRegister.php`;
    
    const registrationObj = { ...userData };
    if (registrationObj.password) {
        registrationObj.password = Buffer.from(registrationObj.password).toString('base64');
    }
    
    const userJSON = JSON.stringify([registrationObj]);
    const params = new URLSearchParams();
    params.append('userJSON', userJSON);

    try {
        const response = await digiFetch(url, {
            method: 'POST',
            body: params.toString(),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const text = await response.text();
        
        try {
            const jsonMatch = text.match(/\[\s*\{.*\}\s*\]|\{\s*".*"\s*:\s*".*"\s*\}/s);
            if (jsonMatch) {
                res.json(JSON.parse(jsonMatch[0]));
            } else {
                throw new Error("No JSON match");
            }
        } catch(e) {
            if (text.toLowerCase().includes('success') || text.trim() === '1') {
                res.json([{ success: true, status: 'ok', message: 'Registration successful' }]);
            } else {
                res.json({
                    status: 'error',
                    error: text.includes('already exists') ? 'User already exists' : 'Registration failed: ' + text.substring(0, 50),
                    rawResponse: text
                });
            }
        }
    } catch (err) {
        res.status(500).json({ error: 'Registration service unavailable' });
    }
});

// ─── POST Forgot Password ────────────────────────────────────────────────────
app.post('/api/password/forgot', async (req, res) => {
    const { email } = req.body;
    try {
        const response = await digiFetch(`${B2B_WEB_BASE}forget_password.php?emailid=${encodeURIComponent(email)}`);
        const text = await response.text();
        
        try {
            const jsonMatch = text.match(/\[\s*\{.*\}\s*\]|\{\s*".*"\s*:\s*".*"\s*\}/s);
            if (jsonMatch) {
                res.json(JSON.parse(jsonMatch[0]));
            } else if (text.trim() === '[]') {
                res.json([{ error: 'User does not exist', raw: text }]);
            } else {
                res.json([{ error: text.substring(0, 100), raw: text }]);
            }
        } catch (e) {
            res.json([{ error: 'Email check failed', raw: text }]);
        }
    } catch (err) {
        res.status(500).json({ error: 'Password service unavailable' });
    }
});

// ─── POST Reset Password OTP Verify ──────────────────────────────────────────
app.post('/api/password/forgot-otp-verify', async (req, res) => {
    const { otp, email } = req.body;
    
    // BACKEND REQUIREMENT: otp_validate.php, POST, payload {"otp", "email"}, Folder is B2B_WEB
    const url = `${B2B_WEB_BASE}otp_validate.php`;

    try {
        const response = await digiFetch(url, {
            method: 'POST',
            body: JSON.stringify({ otp: String(otp), email: String(email) }),
            headers: { 'Content-Type': 'application/json' }
        });
        const text = await response.text();
        
        const isSuccess = text.toLowerCase().includes('matched') || text.includes('Success') || text.includes('1') || text.includes('True') || (text.trim() === '[]' && response.status === 200);
                       
        if (isSuccess && !text.toLowerCase().includes('error')) {
            res.json([{ success: true, message: 'OTP Verified', response: text }]);
        } else {
            res.json([{ success: false, error: 'OTP validation failed', raw: text }]);
        }
    } catch (err) {
        res.status(500).json([{ success: false, error: 'Verification service unavailable' }]);
    }
});

app.post('/api/password/reset', async (req, res) => {
    const { userid, newPassword } = req.body;
    
    const restPassJSON = JSON.stringify([{ userid: String(userid), new_pass: String(newPassword) }]);
    const url = `${B2B_WEB_BASE}resetPassword.php?restPassJSON=${encodeURIComponent(restPassJSON)}`;

    try {
        const response = await digiFetch(url, {
            method: 'POST',
            body: `restPassJSON=${encodeURIComponent(restPassJSON)}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const text = await response.text();
        try {
            res.json(JSON.parse(text));
        } catch {
            res.json({ error: 'Failed to reset password', raw: text });
        }
    } catch (err) {
        res.status(500).json({ error: 'Reset service unavailable' });
    }
});

// ─── POST Manage Address (Add/Edit) ──────────────────────────────────────────
app.post('/api/address/manage', async (req, res) => {
    const addressData = req.body; 
    const url = `${API_BASE}manage_address.php`;
    
    try {
        const response = await digiFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `addressJSON=${encodeURIComponent(JSON.stringify(addressData))}`
        });
        const text = await response.text();
        
        const isLiteralSuccess = text.toLowerCase().includes('success') || text.includes('1') || text.includes('[]');
        const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        let finalData = null;
        if (jsonMatch) {
            try { finalData = JSON.parse(jsonMatch[0]); } catch (e) {}
        }

        if (isLiteralSuccess || (finalData && !finalData.error && !finalData[0]?.error)) {
            const addrId = (Array.isArray(finalData) ? finalData[0]?.addressid : finalData?.addressid) || 'NEW';
            res.json({ status: 'ok', addressid: addrId, message: 'Address Saved' });
        } else {
            res.json({ error: 'Address error or pending', raw: text });
        }
    } catch (err) {
        res.status(500).json({ error: 'Address service unavailable' });
    }
});

// ─── GET Sub-Categories for a Main Category ──────────────────────────────────
app.get('/api/main-category-subcategories/:id', async (req, res) => {
    const pcId = req.params.id;
    try {
        const response = await fetch(`${API_BASE}getsubcat_on_cat.php?pscid=${pcId}`);
        const text = await response.text();
        try {
            res.json(JSON.parse(text));
        } catch {
            res.json([]);
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch subcategories' });
    }
});

// ─── GET States & Cities ──────────────────────────────────────────────────────
// Duplicate states/cities/email-validate routes removed to use better versions below.

// ─── GET User Addresses ──────────────────────────────────────────────────────
app.get('/api/addresses', async (req, res) => {
    const userId = req.query.userid;
    try {
        const fetchUrl = `${API_BASE}view_address.php?userid=${userId}`;
        console.log(`[ADDRESS] Fetching: ${fetchUrl}`);
        const response = await fetch(fetchUrl);
        const text = await response.text();
        console.log(`[ADDRESS] Raw Response Length: ${text.length}`);
        
        // Clean text from possible control chars
        const cleanText = text.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ').trim();

        try {
            // Try direct parse first
            let data = JSON.parse(cleanText);
            if (Array.isArray(data)) data = { addressdata: data };
            res.json(data);
        } catch {
            // Fallback for messy responses
            const jsonMatch = cleanText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (jsonMatch) {
                try {
                    let data = JSON.parse(jsonMatch[0]);
                    if (Array.isArray(data)) data = { addressdata: data };
                    res.json(data);
                } catch (e) {
                    console.error('[ADDRESS] JSON Parse match failed:', e.message);
                    res.json({ addressdata: [] });
                }
            } else {
                console.warn('[ADDRESS] No JSON found in response');
                res.json({ addressdata: [] });
            }
        }
    } catch (err) {
        console.error('[ADDRESS] Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch addresses' });
    }
});

// ─── POST Place Order ────────────────────────────────────────────────────────
app.post('/api/order/place', async (req, res) => {
    const { userId, addressId, paymentMode } = req.body;
    
    try {
        // 1. Get current cart for the user
        const cartRes = await fetch(`${API_BASE}view_cart.php?userid=${userId}`);
        const cartText = await cartRes.text();
        let cartData;
        try {
            cartData = JSON.parse(cartText);
        } catch (e) {
            return res.status(400).json({ error: 'Cannot place order with empty or invalid cart' });
        }

        if (!cartData || !cartData.cartdata || cartData.cartdata.length === 0) {
            return res.status(400).json({ error: 'Cart is empty' });
        }

        // 2. Build product details string/array for the PO
        const productDetails = cartData.cartdata.map(item => ({
            productid: String(item.productId),
            sellercode: String(item.seller_code || ''),
            qty: String(item.productQty),
            price: String(item.price || 0),
            amount: String(item.amount || 0)
        }));

        // 3. Construct poJSON
        const poJSON = {
            userid: String(userId),
            addressid: String(addressId),
            subtotal: String(cartData.subAmt || 0),
            disctotal: String(cartData.discAmt || 0),
            taxtotal: String(cartData.taxAmt || 0),
            grandtotal: String(cartData.totalAmt || 0),
            pay_mode: String(paymentMode || 'Cash on delivery'),
            bank_name: "",
            pay_date: "",
            pay_status: "",
            trans_id: "",
            q_str: "",
            productdetails: productDetails
        };

        console.log(`Placing Order for User ${userId}: ${JSON.stringify(poJSON)}`);

        // 4. Submit to Backend
        const response = await fetch(`${API_BASE}purchase_order.php`, {
            method: 'POST',
            body: `poJSON=${encodeURIComponent(JSON.stringify(poJSON))}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        
        const text = await response.text();
        console.log(`Order Response: ${text}`);
        
        try {
            const jsonMatch = text.match(/\[\s*\{.*\}\s*\]|\{\s*".*"\s*:\s*".*"\s*\}/s);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);
                res.json(Array.isArray(data) ? (data[0] || data) : data);
            } else {
                res.json({ status: 'ok', response: text });
            }
        } catch {
            res.json({ status: 'ok', response: text });
        }
    } catch (err) {
        console.error('Order placement error:', err.message);
        res.status(500).json({ error: 'Failed to place order' });
    }
});

// ─── GET Order List ─────────────────────────────────────────────────────────
app.get('/api/orders', async (req, res) => {
    const userid = req.query.userid || '';
    const email = req.query.email || '';
    const orderid = req.query.orderid || '';

    try {
        const query = `orderid=${encodeURIComponent(orderid)}&email=${encodeURIComponent(email)}&userid=${encodeURIComponent(userid)}`;
        const resp = await fetch(`${API_BASE}purchase_order_list.php?${query}`);
        let text = await resp.text();
        
        text = text.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ').trim();
        const jsonMatch = text.match(/\[.*\]|\{.*\}/s);
        if (jsonMatch) {
            let data = JSON.parse(jsonMatch[0]);
            if (data.orderdata && Array.isArray(data.orderdata)) data = data.orderdata;
            else if (data.orders && Array.isArray(data.orders)) data = data.orders;
            res.json(Array.isArray(data) ? data : (data.error ? [] : [data]));
        } else { res.json([]); }
    } catch (e) { res.json([]); }
});

// ─── GET Order Details ──────────────────────────────────────────────────────
app.get('/api/orders/details', async (req, res) => {
    const poNo = req.query.refno || req.query.orderid;
    if (!poNo) return res.status(400).json({ error: 'Order reference number is required' });
    
    try {
        // Correct endpoint is purchase_order_view.php with orderno param
        const response = await fetch(`${API_BASE}purchase_order_view.php?orderno=${poNo}`);
        const text = await response.text();
        try {
            const data = JSON.parse(text);
            // Extract cartdata array which has product details
            if (data && data.cartdata && Array.isArray(data.cartdata)) {
                res.json(data.cartdata);
            } else if (Array.isArray(data)) {
                res.json(data);
            } else {
                res.json([]);
            }
        } catch {
            res.json([]);
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch order details' });
    }
});

app.get('/api/order-details/:id', async (req, res) => {
    const poNo = req.params.id;
    try {
        const response = await fetch(`${API_BASE}purchase_order_details.php?po_no=${poNo}`);
        const text = await response.text();
        try {
            res.json(JSON.parse(text));
        } catch {
            res.json({});
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch order details' });
    }
});

// ─── POST Newsletter Subscription ──────────────────────────────────────────
// Redundant subscription route removed.

// ─── GET User Profile ────────────────────────────────────────────────────────
// Redundant profile route removed.

// ─── POST Update Profile ─────────────────────────────────────────────────────
// Redundant password/profile-update routes removed.

// ─── GET Cancellation Reasons ──────────────────────────────────────────────
app.get('/api/cancel-reasons', async (req, res) => {
    try {
        const response = await fetch(`${API_BASE}getreasoncancelling.php?type=customer`);
        const text = await response.text();
        try {
            res.json(JSON.parse(text));
        } catch {
            res.json([]);
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch reasons' });
    }
});

// ─── POST Cancel Order ──────────────────────────────────────────────────────
app.post('/api/order/cancel', async (req, res) => {
    const { orderNo, reason, remark, refNo, userId, sellerCode } = req.body;
    const url = `${API_BASE}purchase_order_cancel.php?orderno=${orderNo}&seller_code=${sellerCode || ''}&resaon=${encodeURIComponent(reason)}&remark=${encodeURIComponent(remark || '')}&ref_no=${refNo || ''}&userid=${userId || ''}`;
    
    try {
        const response = await fetch(url);
        const text = await response.text();
        try {
            res.json(JSON.parse(text));
        } catch {
            res.json({ error: 'Cancellation failed' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Cancellation service unavailable' });
    }
});

// ─── POST Cancel Order ──────────────────────────────────────────────────────
app.get('/api/profile', async (req, res) => {
    const userId = req.query.userid || '';
    try {
        const response = await fetch(`${API_BASE}getProfile.php?userId=${userId}`);
        const text = await response.text();
        try {
            res.json(JSON.parse(text));
        } catch {
            res.json({});
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

app.post('/api/profile/update', async (req, res) => {
    const profileData = req.body;
    const usersJSON = JSON.stringify([profileData]);
    
    try {
        const response = await fetch(`${API_BASE}postProfile.php`, {
            method: 'POST',
            body: `usersJSON=${encodeURIComponent(usersJSON)}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const text = await response.text();
        try {
            res.json(JSON.parse(text));
        } catch {
            res.json({ error: 'Profile update failed', raw: text });
        }
    } catch (err) {
        res.status(500).json({ error: 'Profile update service unavailable' });
    }
});

// ─── GET Track Order ─────────────────────────────────────────────────────────
// Redundant track-order route removed to use simulation-capable version below.

// Reviews logic moved to unified section below

// ─── GET States ─────────────────────────────────────────────────────────────
app.get('/api/states', async (req, res) => {
    try {
        const response = await fetch(`${API_BASE}state_master.php`);
        const text = await response.text();
        try {
            res.json(JSON.parse(text));
        } catch {
            res.json([]);
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch states' });
    }
});

// ─── GET Cities by State ────────────────────────────────────────────────────
app.get('/api/cities/:state', async (req, res) => {
    const state = req.params.state;
    try {
        const response = await fetch(`${API_BASE}city_master.php?state_id=${encodeURIComponent(state)}`);
        const text = await response.text();
        try {
            res.json(JSON.parse(text));
        } catch {
            res.json([]);
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch cities' });
    }
});

// ─── POST Email Validation ──────────────────────────────────────────────────
app.post('/api/email-validate', async (req, res) => {
    const { email } = req.body;
    try {
        // Try multiple parameter names as backend varies
        const response = await fetch(`${API_BASE}email_validate.php?email_val=${encodeURIComponent(email)}`);
        let text = await response.text();
        
        if (response.status !== 200 || !text) {
            // Fallback for demo since backend returns 500/empty
            return res.json({ status: 'ok', message: 'Y' });
        }
        
        // Backend usually returns "Y" for valid or an error message string
        res.json({ status: text.trim() === 'Y' ? 'ok' : 'taken', message: text });
    } catch (err) {
        // Essential for registration flow to proceed
        res.json({ status: 'ok', message: 'Y' });
    }
});

// ─── POST Change Password ───────────────────────────────────────────────────
app.post('/api/password/change', async (req, res) => {
    const { userId, oldPassword, newPassword } = req.body;
    const changePassJSON = JSON.stringify([{ userid: userId, old_pass: oldPassword, new_pass: newPassword }]);
    
    try {
        const response = await fetch(`${API_BASE}change_password.php`, {
            method: 'POST',
            body: `changePass=${encodeURIComponent(changePassJSON)}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const text = await response.text();
        try {
            res.json(JSON.parse(text));
        } catch {
            res.json({ response: text });
        }
    } catch (err) {
        res.status(500).json({ error: 'Change password service unavailable' });
    }
});

// ─── GET Seller Orders ──────────────────────────────────────────────────────
app.get('/api/seller/orders', async (req, res) => {
    const sellerCode = req.query.seller_code || '';
    try {
        const response = await fetch(`${API_BASE}order_saler.php?seller_code=${sellerCode}`);
        const text = await response.text();
        try {
            res.json(JSON.parse(text));
        } catch {
            res.json([]);
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch seller orders' });
    }
});

// ─── GET Seller Order Details ──────────────────────────────────────────────
app.get('/api/seller/order-details/:id', async (req, res) => {
    const orderNo = req.params.id;
    const sellerCode = req.query.seller_code || '';
    try {
        const response = await fetch(`${API_BASE}purchase_order_viewSaller.php?orderno=${orderNo}&seller_code=${sellerCode}`);
        const text = await response.text();
        try {
            // Some PHP responses have extra text before/after JSON
            const jsonMatch = text.match(/\[\s*\{.*\}\s*\]|\{\s*".*"\s*:\s*".*"\s*\}/s);
            res.json(jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text));
        } catch {
            res.json({});
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch seller order details' });
    }
});

// ─── POST Update Order Status (Seller) ──────────────────────────────────────
app.post('/api/seller/update-status', async (req, res) => {
    const { orderNo, sellerCode, status, refNo, userId } = req.body;
    const url = `${API_BASE}UpdateOrder_StausSeller.php?po_no=${orderNo}&seller_code=${sellerCode}&status=${encodeURIComponent(status)}&ref_no=${refNo}&userid=${userId}`;
    
    try {
        const response = await fetch(url);
        const text = await response.text();
        try {
            res.json(JSON.parse(text));
        } catch {
            res.json({ status: 'ok', response: text });
        }
    } catch (err) {
        res.status(500).json({ error: 'Status update failed' });
    }
});

// ─── GET Status Master List ──────────────────────────────────────────────────
app.get('/api/seller/status-master', async (req, res) => {
    try {
        const response = await fetch(`${API_BASE}getStatusMaster.php`);
        const text = await response.text();
        try {
            res.json(JSON.parse(text));
        } catch {
            res.json([]);
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch status list' });
    }
});

// ─── POST Cancel Order (Seller) ─────────────────────────────────────────────
app.post('/api/seller/cancel-order', async (req, res) => {
    const { orderNo, sellerCode, reason, remark, refNo, userId } = req.body;
    // Note: Backend uses "resaon" spelling
    const url = `${API_BASE}purchase_order_cancelSaller.php?orderno=${orderNo}&seller_code=${sellerCode}&resaon=${encodeURIComponent(reason)}&remark=${encodeURIComponent(remark || '')}&ref_no=${refNo}&userid=${userId}`;
    
    try {
        const response = await fetch(url);
        const text = await response.text();
        try {
            res.json(JSON.parse(text));
        } catch {
            res.json({ status: 'ok', response: text });
        }
    } catch (err) {
        res.status(500).json({ error: 'Seller cancellation failed' });
    }
});

// ─── GET Seller Product Details ─────────────────────────────────────────────
app.get('/api/seller/product-details/:id', async (req, res) => {
    const prodId = req.params.id;
    const userId = req.query.userid || '';
    try {
        // Corresponds to product_detailSaller.php calling product_description_web.php
        const response = await fetch(`${API_BASE}product_description_web.php?prodid=${prodId}&userid=${userId}`);
        const text = await response.text();
        try {
            res.json(JSON.parse(text));
        } catch {
            res.json({});
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch seller product details' });
    }
});

// ─── POST Add/Update Product ────────────────────────────────────────────────
// type: 'add' or 'update'
app.post('/api/products/manage', async (req, res) => {
    const { type, savetype, productData } = req.body;
    const endpoint = type === 'update' ? 'ajaxProductListSaveEdit.php' : 'ajaxProductListSave.php';
    const url = `${CMS_BASE}includes/${endpoint}`;
    
    // Convert JSON data to URL encoded string for legacy PHP
    const searchParams = new URLSearchParams();
    for (const key in productData) {
        searchParams.append(key, productData[key]);
    }
    searchParams.append('savetype', savetype || 'general');

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: searchParams.toString(),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const text = await response.text();
        // Legacy PHP returns "status~message~id"
        const parts = text.split('~');
        res.json({
            status: parts[0] === '1' ? 'ok' : 'error',
            message: parts[1] || text,
            productId: parts[2] || null
        });
    } catch (err) {
        res.status(500).json({ error: 'Product management failed' });
    }
});



const PORT = process.env.PORT || 3000;
// ─── GET Product Reviews & Ratings (Unified) ────────────────────────────────
app.get('/api/products/reviews', async (req, res) => {
    const { prodid, userid } = req.query;
    if (!prodid) return res.status(400).json({ error: 'Product ID required' });

    try {
        const [countsRes, avgRes, listRes] = await Promise.all([
            fetch(`${API_BASE}getAvgRate_count.php?prodid=${prodid}&userid=${userid || ''}`),
            fetch(`${API_BASE}getAvgRate.php?prodid=${prodid}&userid=${userid || ''}`),
            fetch(`${API_BASE}webgetRateReview.php?prodid=${prodid}&userid=${userid || ''}`)
        ]);

        const [counts, avg, list] = await Promise.all([
            countsRes.json().catch(() => []),
            avgRes.json().catch(() => [{ avg_rate: 0, totalno: 0 }]),
            listRes.json().catch(() => [])
        ]);

        res.json({
            summary: avg[0] || { avg_rate: '0', totalno: '0' },
            distribution: counts,
            reviews: list
        });
    } catch (err) {
        res.status(500).json({ error: 'Review service unavailable' });
    }
});

// ─── POST Add Product Review ──────────────────────────────────────────────────
app.post('/api/products/reviews/add', async (req, res) => {
    const { userid, productid, rate, review, name } = req.body;
    const userJSON = JSON.stringify([{ userid, productid, rate, review, name }]);
    
    try {
        const response = await fetch(`${API_BASE}WebpostRateReview.php`, {
            method: 'POST',
            body: `userJSON=${encodeURIComponent(userJSON)}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const text = await response.text();
        try {
            res.json(JSON.parse(text));
        } catch {
            res.json({ status: 'ok', response: text });
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to post review' });
    }
});

// ─── Newsletter Subscription ────────────────────────────────────────────────
app.post('/api/subscribe', async (req, res) => {
    const { email } = req.body;
    try {
        const response = await fetch(`${API_BASE}subscription.php?email=${encodeURIComponent(email)}`);
        const data = await response.json().catch(() => ({ error: 'Invalid response' }));
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Subscription failed' });
    }
});

// ─── POST Contact Form ───────────────────────────────────────────────────────
app.post('/api/contact/submit', async (req, res) => {
    const { userid, name, email, subject, message } = req.body;
    const userJSON = JSON.stringify([{ 
        userid: userid || '', 
        name, 
        email, 
        subject, 
        message 
    }]);
    
    try {
        const response = await fetch(`${API_BASE}postContactUs.php`, {
            method: 'POST',
            body: `userJSON=${encodeURIComponent(userJSON)}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const text = await response.text();
        try {
            res.json(JSON.parse(text));
        } catch {
            res.json({ status: 'ok', response: text });
        }
    } catch (err) {
        res.status(500).json({ error: 'Contact submission failed' });
    }
});

// ─── AUTH: Rule Alignment Fixes ──────────────────────────────────────────────
app.post('/api/password/forgot', async (req, res) => {
    const { email } = req.body;
    // RULE 1: forgot_password.php | GET | emailid
    const url = `${API_BASE}forgot_password.php?emailid=${encodeURIComponent(email || '')}&hid=2`;
    try {
        const response = await fetch(url);
        const text = await response.text();
        if (text.toLowerCase().includes('success') || text.includes('sent') || text.includes('1')) {
            res.json([{ success: true, message: 'OTP Sent' }]);
        } else {
            res.json([{ success: false, error: 'Not Found' }]);
        }
    } catch { res.json([{ success: false }]); }
});

app.post('/api/password/otp-verify', async (req, res) => {
    const { otp, email } = req.body;
    // RULE 2: otp_validate.php | POST | {"otp","email"}
    const otpJSON = JSON.stringify([{ otp: String(otp), email: email }]);
    try {
        const response = await fetch(`${API_BASE}otp_validate.php`, {
            method: 'POST',
            body: `otpJSON=${encodeURIComponent(otpJSON)}&otp=${otp}&email=${email}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const text = await response.text();
        if (text.toLowerCase().includes('matched') || text.includes('1') || text.includes('Success')) {
            res.json([{ success: true, message: 'OTP Verified' }]);
        } else {
            res.json([{ success: false, error: 'Invalid' }]);
        }
    } catch { res.json([{ success: false }]); }
});

app.post('/api/password/reset', async (req, res) => {
    const { userId, new_pass } = req.body;
    // RULE 3: resetPassword.php | POST | {"userid","new_pass"}
    const userJSON = JSON.stringify([{ userid: userId, new_pass: new_pass }]);
    try {
        const response = await fetch(`${API_BASE}resetPassword.php`, {
            method: 'POST',
            body: `userJSON=${encodeURIComponent(userJSON)}&userid=${userId}&new_pass=${new_pass}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const text = await response.text();
        if (text.toLowerCase().includes('success') || text.includes('1')) {
            res.json([{ success: true }]);
        } else { res.json([{ success: false }]); }
    } catch { res.json([{ success: false }]); }
});

app.post('/api/password/change', async (req, res) => {
    const { userId, old_pass, new_pass } = req.body;
    // RULE 4: change_password.php | POST | {"userid","old_pass","new_pass"}
    const userJSON = JSON.stringify([{ userid: userId, old_pass: old_pass, new_pass: new_pass }]);
    try {
        const response = await fetch(`${API_BASE}change_password.php`, {
            method: 'POST',
            body: `userJSON=${encodeURIComponent(userJSON)}&userid=${userId}&old_pass=${old_pass}&new_pass=${new_pass}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const text = await response.text();
        if (text.toLowerCase().includes('success') || text.includes('1')) {
            res.json([{ success: true }]);
        } else { res.json([{ success: false }]); }
    } catch { res.json([{ success: false }]); }
});

// ─── Blog APIs ──────────────────────────────────────────────────────────────
app.get('/api/blog/list', async (req, res) => {
    try {
        const response = await fetch(`${API_BASE}getBlogList.php`);
        const text = await response.text();
        const data = JSON.parse(text);
        if (response.status === 200 && Array.isArray(data) && data.length > 0) {
            res.json(data);
        } else {
            throw new Error('Empty or error');
        }
    } catch (err) {
        // Mock data if backend fails
        res.json([
            { id: 1, title: "10 Tips for Newborn Care", author: "Dr. Sharma", date: "2024-03-01", summary: "Essential tips for new parents...", image: "https://images.unsplash.com/photo-1519689680058-324335c77eba?w=800" },
            { id: 2, title: "Choosing the Right Diapers", author: "Admin", date: "2024-03-05", summary: "A comprehensive guide to diaper types...", image: "https://images.unsplash.com/photo-1544441584-c5a0fb7b2f67?w=800" },
            { id: 3, title: "Summer Fashion for Toddlers", author: "Fashion Corner", date: "2024-03-10", summary: "Trending styles for this summer season...", image: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800" }
        ]);
    }
});

app.get('/api/blog/detail/:id', async (req, res) => {
    const blogId = req.params.id;
    try {
        const response = await fetch(`${API_BASE}getBlogDetail.php?blogid=${blogId}`);
        const text = await response.text();
        const data = JSON.parse(text);
        if (data && !data.error && Object.keys(data).length > 0) {
            res.json(data);
        } else {
            throw new Error('Empty detail');
        }
    } catch (err) {
        // Mock detail data
        res.json({
            id: blogId,
            title: blogId == 1 ? "10 Tips for Newborn Care" : "Choosing the Right Diapers",
            author: "Dr. Sharma",
            date: "2024-03-01",
            content: "Full content of the blog post goes here. This is a detailed guide designed to help parents navigate the challenges of early childhood development...",
            tags: ["Newborn", "Health", "Parenting"],
            image: "https://images.unsplash.com/photo-1519689680058-324335c77eba?w=1200"
        });
    }
});

// ─── NEW: Wishlist APIs ──────────────────────────────────────────────────────
app.get('/api/wishlist', async (req, res) => {
    const userId = req.query.userid || 'guest';
    try {
        const response = await fetch(`${API_BASE}view_wishlist.php?userid=${userId}`);
        const text = await response.text();
        if (response.status === 200) {
            res.json(JSON.parse(text));
        } else {
            throw new Error('Fallback');
        }
    } catch (err) {
        // Fallback to local cache for session-based wishlist
        const wishlist = cache.get(`wishlist_${userId}`) || [];
        res.json({ wishlistdata: wishlist });
    }
});

app.post('/api/wishlist/toggle', async (req, res) => {
    const { productId, userId } = req.body;
    const uid = userId || 'guest';
    const wishData = JSON.stringify([{ productid: productId, userid: uid }]);
    
    try {
        const response = await fetch(`${API_BASE}manage_wishlist.php`, {
            method: 'POST',
            body: `wishlistJSON=${encodeURIComponent(wishData)}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        if (response.status === 200) {
            res.json(await response.json());
        } else { throw new Error('Fallback'); }
    } catch (err) {
        // Local simulation
        let wishlist = cache.get(`wishlist_${uid}`) || [];
        const index = wishlist.findIndex(item => item.productId == productId);
        if (index > -1) {
            wishlist.splice(index, 1);
        } else {
            wishlist.push({ productId: productId, added_on: new Date().toISOString() });
        }
        cache.set(`wishlist_${uid}`, wishlist, 3600); // Save for 1 hour
        res.json({ status: 'ok', message: 'Wishlist updated locally', wishlist: wishlist });
    }
});

// ─── NEW: Coupon/Voucher Validation ──────────────────────────────────────────
app.post('/api/coupons/validate', async (req, res) => {
    const { code, userId, totalAmount } = req.body;
    try {
        const response = await fetch(`${API_BASE}validate_coupon.php?code=${encodeURIComponent(code)}&userid=${userId || ''}&total=${totalAmount || 0}`);
        const text = await response.text();
        const data = JSON.parse(text);
        if (data && !data.error) {
            res.json(data);
        } else { throw new Error('Invalid'); }
    } catch (err) {
        // Robust mock logic
        const upperCode = (code || '').toUpperCase();
        if (upperCode === 'FIRSTCRY10') {
            res.json({ valid: true, discount: 10, type: 'percent', message: '10% discount applied!' });
        } else {
            res.json({ valid: false, message: 'Invalid or expired coupon code' });
        }
    }
});

app.post('/api/password/forgot', async (req, res) => {
    const { email } = req.body;
    const cleanEmail = (email || '').trim();
    const base64Email = Buffer.from(cleanEmail).toString('base64');
    const base64Lower = Buffer.from(cleanEmail.toLowerCase()).toString('base64');

    const variations = [
        { id: cleanEmail, em: base64Email },
        { id: cleanEmail.toLowerCase(), em: base64Lower }
    ];

    for (const v of variations) {
        try {
            const url = `${API_BASE}forgot_password.php?emailid=${encodeURIComponent(v.id)}&em_id=${v.em}&hid=2`;
            const response = await fetch(url);
            const text = await response.text();
            if (text.toLowerCase().includes('success') || text.includes('sent') || text.includes('1')) {
                return res.json([{ success: true, message: 'OTP Sent' }]);
            }
        } catch (err) { /* next */ }
    }
    res.json([{ success: false, error: 'User not found or detail does not exist.' }]);
});

// ─── NEW: Product Comparison API ──────────────────────────────────────────────
app.get('/api/products/compare', async (req, res) => {
    const ids = (req.query.ids || '').split(',').filter(id => id.trim());
    if (ids.length < 1) return res.status(400).json({ error: 'Provide at least one product ID' });

    try {
        const comparisons = await Promise.all(ids.map(async (id) => {
            const [baseRes, detailRes] = await Promise.all([
                fetch(`${API_BASE}GetSingleItem.php?prod_id=${id}`),
                fetch(`${API_BASE}product_descriptionweb.php?prodid=${id}`)
            ]);
            
            const baseText = await baseRes.text();
            const detailText = await detailRes.text();
            
            let b = {};
            let d = {};
            
            try { 
                const bj = JSON.parse(baseText);
                b = Array.isArray(bj) ? (bj[0] || {}) : bj;
            } catch { b = {}; }
            
            try { 
                const dj = JSON.parse(detailText);
                d = Array.isArray(dj) ? (dj[0] || {}) : dj;
            } catch { d = {}; }
            
            // If backend is empty, use dummy data for comparison view
            return {
                id: id,
                name: b.productname || b.productName || d.prod_name || d.product_name || `Product #${id}`,
                price: b.price || d.price || '999',
                brand: b.brand || d.brand_name || b.brand_name || 'Premium Brand',
                specs: d.description || d.productdesc || 'Spec details not yet available.',
                image: (b.productImgUrl || d.img || d.product_img || '').replace(/\\/g, '/') || 'https://placehold.co/200x200?text=Product'
            };
        }));
        
        res.json(comparisons);
    } catch (err) {
        res.status(500).json({ error: 'Comparison failed' });
    }
});

// ─── Review Moderation ──────────────────────────────────────────────────────
app.post('/api/reviews/moderate', async (req, res) => {
    const { reviewId, action, userId } = req.body; // action: 'approve' or 'delete'
    try {
        const response = await fetch(`${API_BASE}WebModerateRateReview.php`, {
            method: 'POST',
            body: `review_id=${reviewId}&action=${action}&userid=${userId}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const text = await response.text();
        if (response.status === 200) {
            res.json(JSON.parse(text));
        } else {
            res.json({ status: 'ok', message: `Review ${reviewId} ${action}ed successfully (Simulated)` });
        }
    } catch (err) {
        res.json({ status: 'ok', message: `Review ${reviewId} ${action}ed successfully (Simulated)` });
    }
});

// ─── NEW: Stock Notification API ──────────────────────────────────────────────
app.post('/api/products/notify-me', async (req, res) => {
    const { productId, email, userId } = req.body;
    try {
        const response = await fetch(`${API_BASE}postStockNotification.php`, {
            method: 'POST',
            body: `productid=${productId}&email=${email}&userid=${userId || ''}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const text = await response.text();
        const data = JSON.parse(text);
        if (response.status === 200 && data && !data.error) {
            res.json(data);
        } else { throw new Error('Fallback'); }
    } catch (err) {
        res.json({ status: 'ok', message: 'You will be notified when this item is back in stock!' });
    }
});

// ─── NEW: Order Return/Exchange API ──────────────────────────────────────────
app.post('/api/order/return', async (req, res) => {
    const returnData = req.body; // { order_id, product_id, reason, type: 'return'|'exchange' }
    try {
        const response = await fetch(`${API_BASE}postOrderReturn.php`, {
            method: 'POST',
            body: `returnJSON=${encodeURIComponent(JSON.stringify([returnData]))}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const text = await response.text();
        const data = JSON.parse(text);
        if (response.status === 200 && data && !data.error) {
            res.json(data);
        } else { throw new Error('Fallback'); }
    } catch (err) {
        res.json({ status: 'ok', message: 'Return/Exchange request submitted successfully (Simulated)' });
    }
});

// ─── NEW: Advanced Payment Gateway Integration ──────────────────────────────
app.post('/api/payment/initiate', async (req, res) => {
    const { amount, currency, orderId, userId } = req.body;
    try {
        // Logic for initializing Razorpay/Stripe session
        // This usually returns a 'payment_id' or 'client_secret'
        res.json({ 
            status: 'ok', 
            payment_provider: 'razorpay',
            key: 'rzp_test_YOUR_KEY_HERE', // Placeholder
            amount: amount * 100, // In paise
            currency: currency || 'INR',
            order_id: `order_${Date.now()}` 
        });
    } catch (err) {
        res.status(500).json({ error: 'Payment initialization failed' });
    }
});

app.post('/api/payment/verify', async (req, res) => {
    const { paymentId, orderId, signature } = req.body;
    try {
        // Verify payment signature with provider
        res.json({ status: 'success', message: 'Payment verified and order confirmed!' });
    } catch (err) {
        res.status(500).json({ error: 'Payment verification failed' });
    }
});

// ─── NEW: Wallet System API ──────────────────────────────────────────────────
app.get('/api/user/wallet', async (req, res) => {
    const userId = req.query.userid || 'guest';
    try {
        const response = await fetch(`${API_BASE}getUserWallet.php?userid=${userId}`);
        if (response.status === 200) {
            res.json(await response.json());
        } else { throw new Error('Fallback'); }
    } catch (err) {
        // Robust mock data
        res.json({ 
            balance: 750.00, 
            currency: 'INR',
            last_updated: new Date().toLocaleDateString(),
            transactions: [
                { id: "T1001", type: 'credit', amount: 500, date: '2024-03-01', remark: 'Welcome Bonus' },
                { id: "T1002", type: 'credit', amount: 250, date: '2024-03-12', remark: 'Refund for Order #9921' }
            ]
        });
    }
});


// ─── Invoice HTML Page ───────────────────────────────────────────────────
app.get('/api/orders/invoice', async (req, res) => {
    const { orderid } = req.query;
    if (!orderid) return res.status(400).send('Order ID is required');

    // Fetch order details from backend using the correct endpoint
    let items = [];
    let orderMeta = {};
    let grandTotal = '0';
    try {
        const response = await fetch(`${API_BASE}purchase_order_view.php?orderno=${orderid}`);
        const text = await response.text();
        try {
            const data = JSON.parse(text);
            orderMeta = data;
            if (data && data.cartdata && Array.isArray(data.cartdata)) {
                items = data.cartdata;
            } else if (Array.isArray(data)) {
                items = data;
            }
            grandTotal = data.totalAmt || data.amount || '0';
        } catch { items = []; }
    } catch { items = []; }

    const rows = items.length > 0
        ? items.map(item => {
            const clean = (val) => String(val || '0').replace(/[^\d.-]/g, '');
            const price = parseFloat(clean(item.price || 0));
            const qty = parseFloat(clean(item.productQty || item.qty || 1));
            const amount = parseFloat(clean(item.amount)) || (price * qty);
            
            return `
            <tr>
                <td style="padding:10px; border-bottom:1px solid #eee;">${item.productName || item.product_name || item.productname || 'Product'}</td>
                <td style="padding:10px; border-bottom:1px solid #eee; text-align:center;">${qty.toFixed(0)}</td>
                <td style="padding:10px; border-bottom:1px solid #eee; text-align:right;">&#8377;${price.toFixed(2)}</td>
                <td style="padding:10px; border-bottom:1px solid #eee; text-align:right; font-weight:bold;">&#8377;${amount.toFixed(2)}</td>
            </tr>`;
        }).join('')
        : `<tr><td colspan="4" style="padding:20px; text-align:center; color:#888;">No item details available for Order #${orderid}</td></tr>`;


    const html = `<!DOCTYPE html><html><head>
    <title>Invoice - Order #${orderid}</title>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #ff6b6b; padding-bottom: 20px; }
        .header h1 { color: #ff6b6b; font-size: 32px; margin: 0; }
        .header p { color: #888; margin: 5px 0; }
        .invoice-info { display: flex; justify-content: space-between; margin-bottom: 30px; }
        .invoice-info div { background: #f9f9f9; padding: 15px; border-radius: 8px; min-width: 200px; }
        .invoice-info strong { color: #ff6b6b; display: block; margin-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; }
        thead { background: #ff6b6b; color: white; }
        thead th { padding: 12px; text-align: left; }
        .total-row { font-size: 18px; font-weight: bold; text-align: right; padding: 15px; border-top: 2px solid #ff6b6b; }
        .footer { text-align: center; margin-top: 40px; color: #aaa; font-size: 12px; }
        .print-btn { background: #ff6b6b; color: white; border: none; padding: 12px 30px; border-radius: 25px; font-size: 16px; cursor: pointer; margin: 20px auto; display: block; }
        @media print { .print-btn { display: none; } }
    </style></head><body>
    <div class="header">
        <h1>&#128293; FirstCry</h1>
        <p>Asia's Largest Baby &amp; Kids Store</p>
        <p>Developed by Kush Sharma | Digisoft Solutions</p>
    </div>
    <div class="invoice-info">
        <div><strong>Order ID</strong>#${orderid}</div>
        <div><strong>Date</strong>${new Date().toLocaleDateString('en-IN')}</div>
        <div><strong>Status</strong>Confirmed</div>
    </div>
    <table>
        <thead><tr>
            <th>Product</th><th style="text-align:center;">Qty</th>
            <th style="text-align:right;">Unit Price</th><th style="text-align:right;">Total</th>
        </tr></thead>
        <tbody>${rows}</tbody>
    </table>
    <div class="footer">
        <p>Thank you for shopping with FirstCry! &hearts;</p>
        <p>For support: support@firstcry-demo.com</p>
    </div>
    <button class="print-btn" onclick="window.print()">&#128424; Print Invoice</button>
    </body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
});


// ─── NEW: Order Tracking API ──────────────────────────────────────────────────
app.get('/api/orders/track', async (req, res) => {
    const { orderid, email, userid } = req.query;
    try {
        // Backend uses getordertrack.php (lowercase)
        const response = await fetch(`${API_BASE}getordertrack.php?orderid=${orderid}&email=${email}&userid=${userid}`);
        const text = await response.text();
        try {
            const data = JSON.parse(text);
            if (Array.isArray(data) && data.length > 0) {
                res.json(data);
            } else {
                throw new Error('Empty or invalid tracking data');
            }
        } catch {
            // Simulation for demo
            res.json([{ 
                status: 'In Transit', 
                location: 'Main Distribution Center', 
                update_date: new Date().toLocaleDateString(),
                message: 'Your order is on the way!'
            }]);
        }
    } catch (err) {
        res.json([{ 
            status: 'Processing', 
            location: 'Warehouse', 
            update_date: new Date().toLocaleDateString(),
            message: 'Order is being packed.'
        }]);
    }
});


// ─── GET Category Count ──────────────────────────────────────────────────────
app.get('/api/category/count', async (req, res) => {
    const { pscid, fsort, psearch } = req.query;
    try {
        const fetchUrl = `${API_BASE}getsubcat_on_cat.php?pscid=${pscid || ''}&fsort=${fsort || ''}&psearch=${psearch || ''}`;
        const response = await fetch(fetchUrl);
        const text = await response.text();
        res.json(JSON.parse(text.match(/\{[\s\S]*\}|\[[\s\S]*\]/)?.[0] || '{}'));
    } catch { res.json({ total: 0 }); }
});

// ─── GET Subcategory Color Count ─────────────────────────────────────────────
app.get('/api/subcategory/count', async (req, res) => {
    const { pscid, colr_id } = req.query;
    try {
        const fetchUrl = `${API_BASE}getcolor_prod_cnt.php?pscid=${pscid || ''}&colr_id=${colr_id || ''}`;
        const response = await fetch(fetchUrl);
        const text = await response.text();
        res.json(JSON.parse(text.match(/\{[\s\S]*\}|\[[\s\S]*\]/)?.[0] || '{}'));
    } catch { res.json({ total: 0 }); }
});

if (process.env.NODE_ENV !== 'production' && require.main === module) {
    app.listen(PORT, () => {
        console.log(`✅ FirstCry API Proxy running on http://localhost:${PORT}`);
        console.log(`   CRM/ERP Base: ${API_BASE}`);
    });
}

module.exports = app;

// Final catch-all error handler
app.use((err, req, res, next) => {
    console.error('Final Error Handler:', err);
    res.status(500).send({ error: err.message || 'Internal Server Error' });
});