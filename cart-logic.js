document.addEventListener('DOMContentLoaded', () => {
    // ─── User Management ──────────────────────────────────────────────────────
    // Get or create a unique ID for the user to track their cart
    let userId = localStorage.getItem('fc_user_id');
    if (!userId) {
        userId = 'GUEST_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('fc_user_id', userId);
    }

    const browserId = userId; // For the API's browserId parameter
    const API_URL = '/api';

    const cartItemsList = document.getElementById('cartItemsList');
    const cartSummarySection = document.getElementById('cartSummarySection');
    const summaryDetails = document.getElementById('summaryDetails');
    const grandTotalText = document.getElementById('grandTotalText');
    const cartCountSpan = document.getElementById('cartCount');

    // ─── Fetch and Render Cart ───────────────────────────────────────────────
    async function loadCart() {
        try {
            const response = await fetch(`${API_URL}/cart?userid=${userId}`);
            const data = await response.json();

            renderCart(data);
        } catch (err) {
            console.error('Error loading cart:', err);
            cartItemsList.innerHTML = `<div class="empty-cart"><p>Failed to load cart. Make sure the API server is running!</p></div>`;
        }
    }

    function renderCart(data) {
        const cartData = data.cartdata || [];
        const realItems = cartData.filter(item => !item.error && (item.productId || item.productName));
        
        // Update global cart count in header
        if (window.updateCartDisplay) window.updateCartDisplay(realItems.length);

        if (cartData.length === 0 || (cartData[0] && !cartData[0].productName)) {
            cartItemsList.innerHTML = `
                <div class="empty-cart">
                    <i class="fas fa-shopping-basket"></i>
                    <h2>Oops! Your cart is empty</h2>
                    <p>Looks like you haven't added anything to your cart yet.</p>
                    <a href="index.html" class="continue-btn">Start Shopping</a>
                </div>`;
            cartSummarySection.style.display = 'none';
            return;
        }

        cartSummarySection.style.display = 'block';

        // Render Items
        cartItemsList.innerHTML = cartData.map((item, index) => `
            <div class="cart-item">
                <img src="${item.productImgUrl}" alt="${item.productName}" class="item-img" onclick="location.href='single-product.html?id=${item.productId}'" style="cursor:pointer;" onerror="this.src='https://via.placeholder.com/150?text=Product'">
                <div class="item-details">
                    <div class="item-name" onclick="location.href='single-product.html?id=${item.productId}'" style="cursor:pointer;">${item.prodcutdesc || item.productName}</div>
                    <div class="item-seller">Seller: ${item.seller_name || 'Official Store'}</div>
                    <div class="item-price">₹${parseFloat(item.price?.toString().replace(/&#\d+;/g, '').match(/[\d.]+/)?.[0] || 0).toLocaleString('en-IN')}</div>
                    
                    <div class="item-actions">
                        <div class="qty-control">
                            <i class="fas fa-minus qty-btn" onclick="updateQty('${item.productId}', ${parseInt(item.productQty) - 1})"></i>
                            <span class="qty-val">${item.productQty}</span>
                            <i class="fas fa-plus qty-btn" onclick="updateQty('${item.productId}', ${parseInt(item.productQty) + 1})"></i>
                        </div>
                        <i class="fas fa-trash-alt remove-btn" onclick="removeItem('${item.productId}')" title="Remove Item"></i>
                    </div>
                </div>
                <div style="font-size: 18px; font-weight: 900; color: var(--text-dark);">
                    ₹${parseFloat(item.amount?.toString().replace(/&#\d+;/g, '').match(/[\d.]+/)?.[0] || 0).toLocaleString('en-IN')}
                </div>
            </div>
        `).join('');

        // Render Summary
        summaryDetails.innerHTML = `
            <div class="summary-row">
                <span>Sub Total:</span>
                <span>₹${parseFloat(data.subAmt?.toString().replace(/&#\d+;/g, '').match(/[\d.]+/)?.[0] || 0).toLocaleString('en-IN')}</span>
            </div>
            <div class="summary-row">
                <span>Discount:</span>
                <span style="color: #2ecc71;">- ₹${parseFloat(data.discAmt?.toString().replace(/&#\d+;/g, '').match(/[\d.]+/)?.[0] || 0).toLocaleString('en-IN')}</span>
            </div>
            <div class="summary-row">
                <span>Tax:</span>
                <span>₹${parseFloat(data.taxAmt?.toString().replace(/&#\d+;/g, '').match(/[\d.]+/)?.[0] || 0).toLocaleString('en-IN')}</span>
            </div>
            <div class="summary-row">
                <span>Est. Delivery:</span>
                <span>${data.estidelvry || 'Free'}</span>
            </div>
        `;
        grandTotalText.textContent = `₹${parseFloat(data.totalAmt?.toString().replace(/&#\d+;/g, '').match(/[\d.]+/)?.[0] || 0).toLocaleString('en-IN')}`;
    }

    // ─── API Interaction Actions ──────────────────────────────────────────────
    window.updateQty = async (productId, newQty) => {
        if (newQty < 1) return removeItem(productId);
        
        try {
            await fetch(`${API_URL}/cart/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId: productId,
                    userId: userId,
                    browserId: browserId,
                    qty: newQty,
                    reqType: 'U' // Update
                })
            });
            loadCart(); // Refresh view
        } catch (err) {
            alert('Update failed');
        }
    };

    window.removeItem = async (productId) => {
        if (!confirm('Remove this item from your cart?')) return;

        try {
            await fetch(`${API_URL}/cart/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId: productId,
                    userId: userId,
                    browserId: browserId,
                    qty: 0,
                    reqType: 'X' // Remove/Delete
                })
            });
            loadCart();
        } catch (err) {
            alert('Removal failed');
        }
    };

    // Initial Load
    loadCart();
});
