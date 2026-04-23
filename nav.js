console.log('[DEBUG-NAV] LOADED');
// Shared Navigation & Menu Logic

document.addEventListener('DOMContentLoaded', () => {
    console.log('[NAV] DOMContentLoaded');
    const menuToggle = document.getElementById('menuToggle');
    const closeMenu = document.getElementById('closeMenu');
    const mobileMenu = document.getElementById('mobileMenu');
    const menuOverlay = document.getElementById('menuOverlay');

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            mobileMenu.classList.add('active');
            menuOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    }

    const hideMenu = () => {
        mobileMenu.classList.remove('active');
        menuOverlay.classList.remove('active');
        document.body.style.overflow = 'auto';
    };

    if (closeMenu) closeMenu.addEventListener('click', hideMenu);
    if (menuOverlay) menuOverlay.addEventListener('click', hideMenu);

    // Navbar Scroll Effect - Hardened with null-check
    const navbar = document.getElementById('mainNavbar');
    window.addEventListener('scroll', () => {
        if (navbar) {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        }
    });

    // Search Bar Logic
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    const searchContainer = document.querySelector('.search-container');
    
    if (searchBtn && searchInput && searchContainer) {
        console.log('[NAV] Search Init Success');
        
        const suggestBox = document.createElement('div');
        suggestBox.className = 'search-suggestions';
        suggestBox.style.cssText = 'position: absolute; top: 100%; left: 0; right: 0; background: white; z-index: 9999; display: none; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border-radius: 12px; margin-top: 10px; overflow: hidden; border: 1px solid #eee;';
        searchContainer.appendChild(suggestBox);

        const handleSearch = () => {
            const query = searchInput.value.trim();
            if (query) window.location.href = `category.html?search=${encodeURIComponent(query)}`;
        };

        searchBtn.addEventListener('click', handleSearch);
        searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSearch(); });

        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            clearTimeout(debounceTimer);
            if (query.length < 2) { suggestBox.style.display = 'none'; return; }

            debounceTimer = setTimeout(async () => {
                try {
                    const res = await fetch(`/api/search/autocomplete?q=${encodeURIComponent(query)}`);
                    const data = await res.json();
                    if (Array.isArray(data) && data.length > 0) {
                        suggestBox.innerHTML = data.map(s => `
                            <div class="suggestion-item" onclick="window.location.href='single-product.html?id=${s.id}'" style="padding: 12px 20px; border-bottom: 1px solid #f9f9f9; cursor: pointer; display: flex; align-items: center; gap: 15px; transition: background 0.2s;">
                                <i class="fas fa-search" style="color: #999;"></i>
                                <div>
                                    <div style="font-weight: 700; font-size: 14px; color: #333;">${s.name}</div>
                                    <div style="font-size: 11px; color: #999;">in Products</div>
                                </div>
                            </div>
                        `).join('');
                        suggestBox.style.display = 'block';
                    } else { suggestBox.style.display = 'none'; }
                } catch (err) { console.error('[NAV] Autocomplete Error:', err); }
            }, 300);
        });

        document.addEventListener('click', (e) => { if (!searchContainer.contains(e.target)) suggestBox.style.display = 'none'; });
    }

    // ─── Auth & Header ───────────────────────────────────────────────────────
    function updateAuthHeader() {
        const userName = localStorage.getItem('fc_user_name');
        const authWrapper = document.getElementById('authWrapper');
        const mobileAuthLink = document.getElementById('mobileAuthLink');

        if (userName) {
            const first = userName.split(' ')[0];
            
            // Update Desktop Header
            if (authWrapper) {
                authWrapper.innerHTML = `
                    <div class="user-nav-container" style="position:relative; display:inline-block;">
                        <a href="profile.html" class="user-trigger" style="display:flex; align-items:center; gap:8px;">
                            <i class="fas fa-user-circle" style="font-size:20px;"></i> Hi, ${first} <i class="fas fa-chevron-down" style="font-size:10px;"></i>
                        </a>
                        <div class="user-dropdown" style="position:absolute; top:100%; right:0; background:white; min-width:180px; box-shadow:0 10px 30px rgba(0,0,0,0.1); border-radius:12px; display:none; flex-direction:column; padding:10px 0; z-index:10000; border:1px solid #eee; margin-top:10px;">
                            <a href="profile.html" style="padding:10px 20px; color:#333; font-weight:700; font-size:14px; display:flex; align-items:center; gap:10px;"><i class="fas fa-edit"></i> My Profile</a>
                            <a href="profile.html?section=wallet" style="padding:10px 20px; color:#333; font-weight:700; font-size:14px; display:flex; align-items:center; gap:10px;"><i class="fas fa-wallet"></i> My Wallet</a>
                            <a href="orders.html" style="padding:10px 20px; color:#333; font-weight:700; font-size:14px; display:flex; align-items:center; gap:10px;"><i class="fas fa-shopping-bag"></i> My Orders</a>
                            <hr style="border:0; border-top:1px solid #eee; margin:5px 0;">
                            <a href="#" onclick="localStorage.clear(); window.location.href='index.html';" style="padding:10px 20px; color:#ff6b6b; font-weight:700; font-size:14px; display:flex; align-items:center; gap:10px;"><i class="fas fa-sign-out-alt"></i> Logout</a>
                        </div>
                    </div>
                `;

                // Simplified Hover/Toggle
                const container = authWrapper.querySelector('.user-nav-container');
                const dropdown = authWrapper.querySelector('.user-dropdown');
                if (container && dropdown) {
                    container.onmouseenter = () => dropdown.style.display = 'flex';
                    container.onmouseleave = () => dropdown.style.display = 'none';
                    container.onclick = () => {
                         const isShown = dropdown.style.display === 'flex';
                         dropdown.style.display = isShown ? 'none' : 'flex';
                    };
                }
            }

            // Update Mobile Sidebar
            if (mobileAuthLink) {
                mobileAuthLink.innerHTML = `<i class="fas fa-user-check"></i> Hi, ${first}`;
                mobileAuthLink.href = 'profile.html';
            }
        }
    }
    updateAuthHeader();


    // Auto-populate desktop and mobile nav bars immediately
    async function loadNavBars() {
        const desktopCats = document.getElementById('desktopDynamicCats');
        const mobileCats = document.getElementById('mobileDynamicCats');
        if (!desktopCats && !mobileCats) return;

        try {
            const res = await fetch('/api/category-products');
            const cats = await res.json();
            if (Array.isArray(cats) && cats.length > 0) {
                const uniqueCats = [];
                const seen = new Set();
                cats.forEach(c => {
                    const catName = c.category || c.catproductName;
                    const catId = c.category_id || c.categoryid || c.id;
                    if (catName && !seen.has(catName)) {
                        seen.add(catName);
                        uniqueCats.push({ name: catName, id: catId });
                    }
                });

                const iconMap = {
                    'AC': 'fa-fan', 'Car Accessories': 'fa-car', 'Clothes': 'fa-tshirt',
                    'Fitness': 'fa-dumbbell', 'Home Appliances': 'fa-plug', 'Kitchen Appliances': 'fa-blender',
                    'Laptop': 'fa-laptop', 'Lights': 'fa-lightbulb', 'Mobile Accessories': 'fa-mobile-alt',
                    'Personal Care': 'fa-spa', 'Shoes': 'fa-shoe-prints', 'Speakers': 'fa-volume-up',
                    'TV': 'fa-tv', 'Watches': 'fa-clock'
                };
                
                if (desktopCats) {
                    desktopCats.innerHTML = uniqueCats.map(c => `
                        <li><a href="category.html?cat=${encodeURIComponent(c.name)}&pcid=${c.id}" class="cat-${c.name.toLowerCase().replace(/\s+/g, '-')}"><i class="fas ${iconMap[c.name] || 'fa-tag'}"></i> ${c.name}</a></li>
                    `).join('');
                }
                if (mobileCats) {
                    mobileCats.innerHTML = uniqueCats.map(c => `
                        <li><a href="category.html?cat=${encodeURIComponent(c.name)}&pcid=${c.id}"><i class="fas ${iconMap[c.name] || 'fa-tag'}"></i> ${c.name}</a></li>
                    `).join('');
                }
            }
        } catch (err) {
            console.error('Failed to auto pop navbar', err);
        }
    }
    loadNavBars();

    // ─── Auth Helpers ────────────────────────────────────────────────────────
    window.isLoggedIn = () => {
        const userId = localStorage.getItem('fc_user_id');
        return !!(userId && !userId.startsWith('GUEST_') && userId.trim() !== '');
    };

    window.checkLogin = (action = 'continue') => {
        if (!window.isLoggedIn()) {
            window.showToast(`Login Required to ${action}! Redirecting...`);
            setTimeout(() => {
                window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}&msg=Please%20login%20to%20${action}`;
            }, 1500);
            return false;
        }
        return true;
    };

    window.updateCartDisplay = (count) => {
        const desktop = document.getElementById('cartCountDesktop');
        const mobile = document.getElementById('cartCount');
        const bottomDot = document.getElementById('cartCountMobileBottom');

        [desktop, mobile].forEach(el => {
            if (el) { el.textContent = count; el.style.display = count > 0 ? 'flex' : 'none'; }
        });
        if (bottomDot) {
            bottomDot.style.display = count > 0 ? 'block' : 'none';
        }
    };

    window.syncCartCount = async () => {
        const userId = localStorage.getItem('fc_user_id') || 'GUEST_' + Math.random().toString(36).substr(2, 9);
        if (!localStorage.getItem('fc_user_id')) localStorage.setItem('fc_user_id', userId);
        
        try {
            const res = await fetch(`/api/cart?userid=${userId}`);
            const data = await res.json();
            const cartList = data.cartdata || [];
            // Filter out error objects
            const realItems = cartList.filter(item => !item.error && (item.productId || item.productid || item.id || item.prod_id));
            window.updateCartDisplay(realItems.length);
        } catch (err) {
            console.error('[NAV] Sync Cart Error:', err);
        }
    };
    window.syncCartCount();

    // ─── Shared UI Utils ────────────────────────────────────────────────────
    window.showToast = (message) => {
        let toast = document.querySelector('.toast-global');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast-global';
            toast.style.cssText = 'position:fixed; bottom:30px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.85); color:white; padding:12px 25px; border-radius:30px; font-weight:700; font-size:14px; z-index:99999; display:flex; align-items:center; gap:10px; transition:0.3s; opacity:0; pointer-events:none;';
            document.body.appendChild(toast);
        }
        toast.innerHTML = `<i class="fas fa-check-circle" style="color:#4ecdc4;"></i> ${message}`;
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(-10px)';
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        }, 3000);
    };

    window.toggleWishlist = async (productId) => {
        if (!window.checkLogin('save items')) return;
        const userId = localStorage.getItem('fc_user_id');
        const btns = document.querySelectorAll(`[data-id="${productId}"] .wishlist-btn i`);
        
        try {
            const res = await fetch('/api/wishlist/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId, userId })
            });
            const result = await res.json();
            
            btns.forEach(btn => {
                if (btn.classList.contains('far')) {
                    btn.classList.replace('far', 'fas');
                    btn.style.color = '#ff6b6b';
                    window.showToast('Saved to Wishlist! ❤️');
                } else {
                    btn.classList.replace('fas', 'far');
                    btn.style.color = '#aaa';
                    window.showToast('Removed from Wishlist.');
                }
            });
        } catch (err) { console.error(err); }
    };

    // ─── Shared Add to Cart Logic ──────────────────────────────────────────
    window.addToCart = async (productId) => {
        if (window.checkLogin && !window.checkLogin('add to cart')) return;
        const userId = localStorage.getItem('fc_user_id') || 'GUEST_' + Math.random().toString(36).substr(2, 9);
        const btn = document.querySelector(`.product-card[data-id="${productId}"] .add-btn`) || 
                    document.querySelector(`[onclick*="addToCart('${productId}')"]`);
        
        let originalIcon = '';
        if (btn) {
            originalIcon = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            btn.disabled = true;
        }

        try {
            const response = await fetch('/api/cart/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId: productId,
                    userId: userId,
                    browserId: userId,
                    qty: 1,
                    reqType: 'A'
                })
            });
            const result = await response.json();
            const isSuccess = (Array.isArray(result) && result[0] && result[0].response && result[0].response.toLowerCase().includes('succes')) || 
                              (result.status === 'ok') || 
                              (result.cartdata);

            if (isSuccess) {
                if (window.showToast) window.showToast(`Product added to cart!`);
                if (btn) {
                    btn.innerHTML = '<i class="fas fa-check"></i>';
                    btn.style.background = '#ff6b6b';
                    setTimeout(() => { 
                        btn.innerHTML = originalIcon; 
                        btn.style.background = ''; // reset to default css
                        btn.disabled = false;
                    }, 1000);
                }
                if (window.syncCartCount) await window.syncCartCount();
                return true;
            }
            throw new Error('Failed');
        } catch (err) {
            console.error('Cart add error:', err);
            return false;
        }
    };

    // ─── Compare Logic ─────────────────────────────────────────────────────
    window.addToCompare = (productId) => {
        let compareList = JSON.parse(localStorage.getItem('fc_compare_list') || '[]');
        if (compareList.includes(productId)) {
            if (window.showToast) window.showToast('Already in comparison list.');
            return;
        }
        if (compareList.length >= 4) {
            if (window.showToast) window.showToast('You can compare max 4 items.');
            return;
        }
        compareList.push(productId);
        localStorage.setItem('fc_compare_list', JSON.stringify(compareList));
        if (window.updateCompareDisplay) window.updateCompareDisplay();
        if (window.showToast) window.showToast('Added to comparison! <a href="compare.html" style="color:white; text-decoration:underline;">View Now</a>');
    };
});
