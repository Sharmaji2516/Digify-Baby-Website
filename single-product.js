document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');
    const userId = localStorage.getItem('fc_user_id') || 'GUEST_' + Math.random().toString(36).substr(2, 9);
    
    // UI Elements
    const mainImgBox = document.getElementById('mainImgBox');
    const thumbRow = document.getElementById('thumbRow');
    const brandName = document.getElementById('brandName');
    const productName = document.getElementById('productName');
    const currPrice = document.getElementById('currPrice');
    const mrpPrice = document.getElementById('mrpPrice');
    const discBadge = document.getElementById('discBadge');
    const productDesc = document.getElementById('productDesc');
    const prodCode = document.getElementById('prodCode');
    const availability = document.getElementById('availability');
    const sellerName = document.getElementById('sellerName');
    const addToCartBtn = document.getElementById('addToCartBtn');
    const qtyVal = document.getElementById('qtyVal');
    
    let currentQty = 1;
    let sellerCode = '';

    // ─── Fetch Product Details ───────────────────────────────────────────────
    async function loadProduct() {
        try {
            // 1. Fetch Rich Details AND Basic Meta in parallel
            const [detailRes, metaRes] = await Promise.all([
                fetch(`/api/product-details/${productId}?userid=${userId}`),
                fetch(`/api/product-meta/${productId}`)
            ]);
            
            const detailData = await detailRes.json();
            const metaData = await metaRes.json();

            // Merge data (Meta IDs are critical for images)
            const combinedData = { ...metaData, ...detailData };

            if (!combinedData.productName && !combinedData.productname) {
                // If still empty, try one more fallback endpoint
                const fbRes = await fetch(`/api/product/${productId}`);
                const fbData = await fbRes.json();
                Object.assign(combinedData, fbData[0] || fbData);
            }

            // 2. Fetch Images (using the correct meta IDs: cat, subcat, brand)
            const prodmid = combinedData.id || productId;
            const prod_cid = combinedData.productcategory || '';
            const sub_prod_cid = combinedData.product_subcategory || '';
            const brnd = combinedData.brand || '';
            const refId = `${prodmid}~${prod_cid}~${sub_prod_cid}~${brnd}`;

            const imgRes = await fetch(`/api/product-image/${encodeURIComponent(refId)}`);
            const imgData = await imgRes.json();

            renderProduct(combinedData, imgData);
        } catch (err) {
            console.error('Loader error:', err);
        }
    }

    function renderProduct(data, imgData) {
        // Text details - handle casing and nulls
        const name = data.productName || data.productname || 'Product Details';
        const desc = data.description || data.productdesc || 'Premium quality product curated for your needs.';
        
        brandName.textContent = data.brand_name || data.brand || 'Original FirstCry';
        productName.textContent = name;
        productDesc.innerHTML = desc;
        prodCode.textContent = data.productcode || `#FC-${productId}`;
        sellerName.textContent = (data.seller_name && data.seller_name !== 'null') ? data.seller_name : 'Authorized Seller';
        sellerCode = data.seller_code || '';

        // Price logic - handle symbols like ₹ and \u20b9
        const parsePrice = (s) => {
            const m = s?.toString().replace(/&#\d+;/g, '').match(/[\d.]+/);
            if (!m) return 0;
            const v = parseFloat(m[0]);
            return isNaN(v) ? 0 : v;
        };

        const pPrice = parsePrice(data.price);
        const pMrp = parsePrice(data.mrp);
        
        currPrice.textContent = `₹${pPrice.toLocaleString('en-IN')}`;
        
        if (pMrp > pPrice) {
            mrpPrice.textContent = `₹${pMrp.toLocaleString('en-IN')}`;
            mrpPrice.style.display = 'inline';
            const discount = Math.round(((pMrp - pPrice) / pMrp) * 100);
            discBadge.textContent = `${discount}% OFF`;
            discBadge.style.display = 'inline-block';
        } else {
            mrpPrice.style.display = 'none';
            discBadge.style.display = 'none';
        }

        // Availability - always show In Stock (backend isStock field is unreliable)
        availability.textContent = 'In Stock';
        availability.style.color = '#2ecc71';

        // ─── Image Gallery Intelligence ──────────────────────────────────────
        let images = [];

        // 1. High-quality details images from B2B logic (usually full URLs)
        if (data.detail && data.detail[0] && Array.isArray(data.detail[0].value)) {
            images = [...data.detail[0].value];
        }

        // 2. Main product image from imgData (if valid)
        if (Array.isArray(imgData) && imgData.length > 0) {
            imgData.forEach(i => {
                if (i.productImgUrl && !i.productImgUrl.includes('psc_')) {
                    if (!images.includes(i.productImgUrl)) images.push(i.productImgUrl);
                }
            });
        }

        // 3. Fallback to data.productImgUrl
        if (data.productImgUrl && !images.includes(data.productImgUrl) && !data.productImgUrl.includes('psc_')) {
            images.push(data.productImgUrl);
        }

        // 4. Absolute Fallback
        if (images.length === 0) {
            images = ['https://via.placeholder.com/600?text=Product+Image'];
        }

        // Render main image
        mainImgBox.classList.remove('skeleton');
        mainImgBox.innerHTML = `<img src="${images[0]}" id="mainImg" alt="Product" onerror="this.src='https://via.placeholder.com/600?text=Product+Image'">`;

        // Render thumbnails
        if (images.length > 1) {
            thumbRow.innerHTML = images.map((img, i) => `
                <img src="${img}" class="thumb-img ${i === 0 ? 'active' : ''}" data-index="${i}" alt="Thumb ${i+1}" onerror="this.style.display='none'">
            `).join('');
        } else {
            thumbRow.innerHTML = '';
        }

        // Thumbnail Click Event
        thumbRow.addEventListener('click', (e) => {
            if (e.target.classList.contains('thumb-img')) {
                document.querySelectorAll('.thumb-img').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById('mainImg').src = e.target.src;
            }
        });
    }

    // ─── Qty and Add to Cart ────────────────────────────────────────────────
    document.getElementById('qtyPlus').addEventListener('click', () => {
        currentQty++;
        qtyVal.textContent = currentQty;
    });

    document.getElementById('qtyMinus').addEventListener('click', () => {
        if (currentQty > 1) {
            currentQty--;
            qtyVal.textContent = currentQty;
        }
    });

    addToCartBtn.addEventListener('click', async () => {
        if (window.checkLogin && !window.checkLogin('add items to cart')) return;
        addToCartBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
        addToCartBtn.disabled = true;

        try {
            const res = await fetch('/api/cart/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId: productId,
                    userId: userId,
                    browserId: userId,
                    qty: currentQty,
                    reqType: 'A',
                    sellerCode: sellerCode
                })
            });
            const result = await res.json();
            
            const isSuccess = (Array.isArray(result) && result[0] && result[0].response && result[0].response.toLowerCase().includes('succes')) || 
                              (result.status === 'ok') || 
                              (result.cartdata);

            if (isSuccess) {
                addToCartBtn.innerHTML = '<i class="fas fa-check"></i> Added!';
                addToCartBtn.style.background = '#2ecc71';
                if (window.syncCartCount) window.syncCartCount();
                
                setTimeout(() => {
                    addToCartBtn.innerHTML = '<i class="fas fa-shopping-bag"></i> Add to Cart';
                    addToCartBtn.style.background = '';
                    addToCartBtn.disabled = false;
                }, 2000);
            } else {
                throw new Error('Failed');
            }
        } catch (err) {
            addToCartBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error';
            addToCartBtn.style.background = '#e74c3c';
            setTimeout(() => {
                addToCartBtn.innerHTML = '<i class="fas fa-shopping-bag"></i> Add to Cart';
                addToCartBtn.style.background = '';
                addToCartBtn.disabled = false;
            }, 2000);
        }
    });

    // ─── Reviews Logic ──────────────────────────────────────────────────────
    let selectedRating = 0;
    const starInput = document.getElementById('starInput');
    const addReviewSection = document.getElementById('addReviewSection');
    const loginToReview = document.getElementById('loginToReview');

    if (starInput) {
        starInput.addEventListener('click', (e) => {
            if (e.target.tagName === 'I') {
                selectedRating = parseInt(e.target.dataset.val);
                Array.from(starInput.children).forEach((star, i) => {
                    star.classList.toggle('active', i < selectedRating);
                });
            }
        });
    }

    // Show review form even if guests (will prompt for login on submit)
    if (addReviewSection) {
        addReviewSection.style.display = 'block';
    }
    if (loginToReview) {
        loginToReview.style.display = localStorage.getItem('fc_user_name') ? 'none' : 'block';
        loginToReview.innerHTML = localStorage.getItem('fc_user_name') ? '' : 
            `<div class="login-prompt">
                <i class="fas fa-info-circle"></i> Have something to say? <a href="login.html">Login</a> to share your experience.
            </div>`;
    }

    async function loadReviews() {
        const statsEl = document.getElementById('reviewStats');
        const listEl = document.getElementById('reviewsList');

        try {
            const res = await fetch(`/api/products/reviews?prodid=${productId}`);
            if (!res.ok) throw new Error('API Error');
            const data = await res.json();
            
            // 1. Render Summary Stats
            const avg = parseFloat(data.summary?.avg_rate || 0);
            const total = parseInt(data.summary?.totalno || 0);
            statsEl.innerHTML = `
                <div class="rating-v2">
                    <span class="avg-score">${avg.toFixed(1)}</span>
                    <div class="stars-wrap">
                        ${'★'.repeat(Math.round(avg))}${'☆'.repeat(5 - Math.round(avg))}
                    </div>
                    <span class="total-text">${total} Reviews</span>
                </div>
            `;

            // 2. Render Review List
            if (!Array.isArray(data.reviews) || data.reviews.length === 0) {
                listEl.innerHTML = '<div class="no-reviews">Be the first to share your experience with this product!</div>';
            } else {
                listEl.innerHTML = data.reviews.map(r => {
                    const stars = Math.max(0, Math.min(5, parseInt(r.rate || 0)));
                    return `
                        <div class="review-item-v2">
                            <div class="review-meta">
                                <div class="reviewer-avatar">${(r.name || 'U').charAt(0)}</div>
                                <div class="reviewer-info">
                                    <h4>${r.name || 'Verified Buyer'}</h4>
                                    <div class="review-stars-v2">${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</div>
                                </div>
                                <span class="review-date">${r.date || 'Recently'}</span>
                            </div>
                            <p class="review-content-v2">${r.review}</p>
                        </div>
                    `;
                }).join('');
            }
        } catch (err) { 
            console.error('Reviews fail:', err); 
            listEl.innerHTML = '<div class="error-msg">Could not load reviews.</div>';
        }
    }

    window.submitReview = async () => {
        const text = document.getElementById('reviewText').value;
        const name = localStorage.getItem('fc_user_name');
        
        if (!localStorage.getItem('fc_user_id')) {
            alert('Please login to leave a review.');
            window.location.href = 'login.html';
            return;
        }

        if (!selectedRating) return alert('Please choose a star rating');
        if (!text || text.length < 5) return alert('Please enter a constructive review');

        const btn = document.querySelector('.add-review-box .main-add-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
        btn.disabled = true;

        try {
            const res = await fetch('/api/products/reviews/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userid: userId,
                    productid: productId,
                    rate: selectedRating.toString(),
                    review: text,
                    name: name || 'Valued Customer'
                })
            });
            const result = await res.json();
            if (result.status === 'ok' || result.success || (Array.isArray(result) && (result[0]?.status === 'ok' || result[0]?.success))) {
                alert('Success! Your review has been submitted for moderation.');
                document.getElementById('reviewText').value = '';
                // Reset stars
                selectedRating = 0;
                Array.from(starInput.children).forEach(s => s.classList.remove('active'));
                loadReviews();
            } else {
                throw new Error('Failed');
            }
        } catch (err) { 
            alert('Could not submit review. Please try again later.'); 
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    loadProduct();
    loadReviews();

    // ─── NEW: Wishlist & Compare Large ──────────────────────────────────────
    window.toggleWishlistLarge = async () => {
        if (window.checkLogin && !window.checkLogin('save items')) return;
        const btn = document.querySelector('#wishlistBtn i');
        try {
            const res = await fetch('/api/wishlist/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId, userId })
            });
            
            if (btn) {
                if (btn.classList.contains('far')) {
                    btn.classList.replace('far', 'fas');
                } else {
                    btn.classList.replace('fas', 'far');
                }
            }
        } catch (err) { console.error(err); }
    };

    window.notifyMe = async (pid) => {
        const email = localStorage.getItem('fc_user_email') || prompt('Enter your email to get notified:');
        if (!email) return;

        try {
            const btn = document.getElementById('notifyBtn');
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subscribing...';
            btn.disabled = true;

            const res = await fetch('/api/products/notify-me', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId: pid, email, userId })
            });
            const data = await res.json();
            alert(data.message || 'We will notify you once this item is back!');
            btn.innerHTML = '<i class="fas fa-check"></i> Subscribed';
            btn.style.background = '#2ecc71';
            btn.style.color = 'white';
        } catch (err) {
            alert('Failed to register for notification.');
            document.getElementById('notifyBtn').innerHTML = '<i class="fas fa-bell"></i> Notify Me';
            document.getElementById('notifyBtn').disabled = false;
        }
    };

    window.addToCompareLarge = () => {
        let compareList = JSON.parse(localStorage.getItem('fc_compare_list') || '[]');
        if (compareList.includes(productId)) {
            alert('Already in comparison list.');
            return;
        }
        if (compareList.length >= 4) {
            alert('You can compare max 4 items.');
            return;
        }
        compareList.push(productId);
        localStorage.setItem('fc_compare_list', JSON.stringify(compareList));
        if (window.updateCompareDisplay) window.updateCompareDisplay();
        if (confirm('Added to comparison! View now?')) {
            window.location.href = 'compare.html';
        }
    };
});
