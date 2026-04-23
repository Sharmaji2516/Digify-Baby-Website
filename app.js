// Home page logic
window.allSectionsData = [];
window.newArrivalsData = [];

document.addEventListener('DOMContentLoaded', () => {
    const featuredContainer = document.getElementById('featuredSections');
    const bannerContainer = document.getElementById('bannerCarousel');
    const dotsContainer = document.getElementById('carouselDots');
    const categoryBubbles = document.getElementById('categoryBubbles');
    
    // ─── User Management for Cart ──────────────────────────────────────────
    let userId = localStorage.getItem('fc_user_id');
    if (!userId) {
        userId = 'GUEST_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('fc_user_id', userId);
    }

    // Initial Sync handled by nav.js

    // ─── Render Banners ──────────────────────────────────────────────────
    async function loadBanners() {
        try {
            const res = await fetch('/api/banners?type=banner');
            const banners = await res.json();
            
            if (Array.isArray(banners) && banners.length > 0) {
                bannerContainer.innerHTML = banners.map((b, i) => `
                    <div class="banner-slide ${i === 0 ? 'active' : ''}">
                        <img src="${b.bannerUrl}" alt="Banner ${i+1}">
                    </div>
                `).join('');
                
                dotsContainer.innerHTML = banners.map((_, i) => `
                    <span class="dot ${i === 0 ? 'active' : ''}" data-index="${i}"></span>
                `).join('');
                
                initializeCarousel('bannerCarousel', 'carouselDots');
            }
        } catch (err) {
            console.error('Banners Error:', err);
        }
    }

    function initializeCarousel(containerId, dotsId, autoPlayTime = 5000) {
        const container = document.getElementById(containerId);
        const dotsContainer = document.getElementById(dotsId);
        if (!container || !dotsContainer) return;

        let slides = container.querySelectorAll('.banner-slide, .secondary-banner-item');
        let dots = dotsContainer.querySelectorAll('.dot');
        let current = 0;

        function showSlide(index) {
            slides.forEach(s => {
                s.classList.remove('active');
                s.style.opacity = '0';
                s.style.position = 'absolute';
            });
            dots.forEach(d => d.classList.remove('active'));
            
            if (slides[index]) {
                slides[index].classList.add('active');
                slides[index].style.opacity = '1';
                slides[index].style.position = 'relative';
            }
            if (dots[index]) dots[index].classList.add('active');
        }

        // Initial show
        showSlide(0);

        const interval = setInterval(() => {
            slides = container.querySelectorAll('.banner-slide, .secondary-banner-item');
            dots = dotsContainer.querySelectorAll('.dot');
            if (slides.length > 0) {
                current = (current + 1) % slides.length;
                showSlide(current);
            }
        }, autoPlayTime);

        dotsContainer.onclick = (e) => {
            if (e.target.classList.contains('dot')) {
                current = parseInt(e.target.dataset.index);
                showSlide(current);
            }
        };
    }

    loadBanners();

    async function loadSecondaryBanners() {
        const container = document.getElementById('secondaryBanners');
        const dotsContainer = document.getElementById('secondaryDots');
        if (!container) return;
        try {
            const res = await fetch('/api/banners?type=offer_banner');
            const banners = await res.json();
            if (Array.isArray(banners) && banners.length > 0) {
                container.innerHTML = banners.map((b, i) => `
                    <div class="secondary-banner-item" style="opacity: ${i === 0 ? '1' : '0'}; position: ${i === 0 ? 'relative' : 'absolute'}; width: 100%; transition: opacity 0.5s ease-in-out;">
                        <img src="${b.bannerUrl}" alt="Offer">
                    </div>
                `).join('');

                if (dotsContainer) {
                    dotsContainer.innerHTML = banners.map((_, i) => `
                        <span class="dot ${i === 0 ? 'active' : ''}" data-index="${i}"></span>
                    `).join('');
                }

                initializeCarousel('secondaryBanners', 'secondaryDots', 6000);
            }
        } catch (err) {
            console.error('Secondary Banners Error:', err);
        }
    }
    loadSecondaryBanners();

    // ─── Render Categories ────────────────────────────────────────────────
    async function loadCategories() {
        try {
            const res = await fetch('/api/category-products');
            const cats = await res.json();
            
            if (Array.isArray(cats)) {
                window.allCategoriesData = cats;
                // Show all in the horizontal scroller (overflow is hidden/scrollable)
                const displayCats = cats; 

                categoryBubbles.innerHTML = displayCats.map(c => {
                    let url = `./category.html?cat=${encodeURIComponent(c.category)}`;
                    if (c.subcat_id) url += `&subcat=${c.subcat_id}`;
                    else if (c.search) url += `&search=${encodeURIComponent(c.search)}`;
                    else if (c.category_id) url += `&id=${c.category_id}`;

                    return `
                        <a href="${url}" class="bubble">
                            <div class="img-wrap">
                                <img src="${c.category_img || 'https://placehold.co/150x150?text=Cat'}" alt="${c.category}">
                            </div>
                            <span>${c.category}</span>
                        </a>
                    `;
                }).join('');

                // Update Shop by Category View All
                const section = document.querySelector('.shop-by-category');
                const viewAll = section?.querySelector('.view-all');
                if (viewAll) {
                    viewAll.href = `category.html`;
                    viewAll.innerHTML = `View All (${cats.length}) <i class="fas fa-arrow-right"></i>`;
                    viewAll.onclick = null; // Let default link work
                }
            }
        } catch (err) {
            console.error('Categories Error:', err);
        }
    }

    loadCategories();

    // ─── Render Hot Deals ──────────────────────────────────────────────────
    async function loadHotDeals() {
        const row = document.getElementById('hotDealsRow');
        const section = document.getElementById('hotDealsSection');
        if (!row) return;

        try {
            const res = await fetch('/api/hot-deals');
            let dealsData = await res.json();
            let deals = Array.isArray(dealsData) ? dealsData : (dealsData.value || []);
            
            if (deals.length > 0) {
                window.hotDealsData = deals;
                section.style.display = 'block';
                const displayDeals = deals; 

                row.innerHTML = displayDeals.map((d, index) => {
                    let name = (d.text1 || 'Deal Product').trim();
                    let priceStr = (d.text2 || '0').trim();
                    
                    let imgUrl = d.bannerUrl || '';
                    if (imgUrl && !imgUrl.startsWith('http')) {
                        imgUrl = 'https://digifysoft.in/websale/APIV2/' + imgUrl.replace(/^\//, '');
                    }
                    if (!imgUrl) imgUrl = 'https://placehold.co/400x300?text=' + encodeURIComponent(name);

                    const extractNum = (s) => (String(s).match(/[\d.]+/)||['0'])[0];
                    const finalPrice = parseFloat(extractNum(priceStr));
                    const oldPrice = finalPrice > 0 ? (finalPrice * 1.2).toFixed(0) : 0;

                    return `
                        <div class="deal-card" onclick="location.href='category.html?subcat=${d.pscid || ''}&nm=${encodeURIComponent(name)}'">
                            <div class="badge-offer">20% OFF</div>
                            <div class="img-container">
                                <img src="${imgUrl}" alt="${name}" onerror="this.src='https://placehold.co/300x300?text=${encodeURIComponent(name)}'">
                            </div>
                            <h3>${name}</h3>
                            <div class="price-row">
                                <span class="product-price">₹${finalPrice.toLocaleString('en-IN')}</span>
                                ${oldPrice > 0 ? `<span class="old-price">₹${parseFloat(oldPrice).toLocaleString('en-IN')}</span>` : ''}
                            </div>
                            <button class="add-btn" style="margin-top:auto; background: linear-gradient(90deg, #FF4D00, #FF8000); border:none; padding:12px; border-radius:15px; font-weight:900;">GRAB DEAL</button>
                        </div>
                    `;
                }).join('');

                const viewAll = section.querySelector('.view-all');
                if (viewAll) {
                    viewAll.href = `category.html?search=hot deals&nm=Hot Deals`;
                    viewAll.innerHTML = `View All (${deals.length}) <i class="fas fa-arrow-right"></i>`;
                    viewAll.onclick = null;
                }

                if (typeof startTimer === 'function') startTimer();
            }
        } catch (err) {
            console.error('Hot Deals Error:', err);
        }
    }

    function startTimer() {
        const timerEl = document.getElementById('dealTimer');
        if (!timerEl) return;

        let totalSeconds = 4 * 3600 + 23 * 60 + 11; // 4h 23m 11s static start for demo

        setInterval(() => {
            totalSeconds--;
            if (totalSeconds < 0) totalSeconds = 24 * 3600;
            
            const h = Math.floor(totalSeconds / 3600);
            const m = Math.floor((totalSeconds % 3600) / 60);
            const s = totalSeconds % 60;
            
            timerEl.textContent = `Ends in: ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }, 1000);
    }

    loadHotDeals();

    // ─── Render New Arrivals ─────────────────────────────────────────────
    async function loadNewArrivals() {
        const row = document.getElementById('newArrivalsRow');
        const section = document.getElementById('newArrivalsSection');
        if (!row) return;

        try {
            // Updated Endpoint: banner_img.php?img_type=bot_banner
            const res = await fetch('/api/banners?type=bot_banner');
            const banners = await res.json();
            
            if (Array.isArray(banners) && banners.length > 0) {
                window.newArrivalsData = banners; // Store globally
                section.style.display = 'block';
                
                // Show 4 by default on home page
                const displayBanners = banners.slice(0, 4);
                
                // Render banners as product cards
                row.innerHTML = displayBanners.map(b => {
                    const id = b.productCode || '0';
                    const imgUrl = b.bannerUrl || 'https://placehold.co/400x400?text=New+Arrival';
                    return `
                    <div class="product-card" data-id="${id}" onclick="location.href='category.html?search=new arrivals&nm=New Arrivals'">
                        <div class="badge-offer">NEW</div>
                        <div class="img-container">
                            <img src="${imgUrl}" alt="New Arrival" onerror="this.src='https://placehold.co/400x400?text=FirstCry'">
                        </div>
                        <div class="product-info">
                            <h3 class="product-title">Premium Selection</h3>
                            <div class="price-row">
                                <span class="product-price">Special Price</span>
                            </div>
                            <button class="add-btn" onclick="event.stopPropagation(); location.href='category.html?search=new arrivals'">
                                <i class="fas fa-eye"></i> VIEW ALL
                            </button>
                        </div>
                    </div>`;
                }).join('');

                // Update View All button
                const viewAllLink = section.querySelector('.view-all-link');
                if (viewAllLink) {
                    viewAllLink.innerHTML = `View All (${banners.length}) <i class="fas fa-arrow-right"></i>`;
                    viewAllLink.href = `category.html?search=new arrivals&nm=New Arrivals`;
                    viewAllLink.onclick = null;
                }
            }
        } catch (err) {
            console.error('New Arrivals Error:', err);
        }
    }

    loadNewArrivals();

    // ─── Render Featured Sections Dynamically ──────────────────────────────
    async function loadFeaturedSections() {
        if (!featuredContainer) return;

        try {
            const res = await fetch('/api/category-products');
            const sections = await res.json();
            
            if (Array.isArray(sections)) {
                window.allSectionsData = sections; // Store globally
                
                featuredContainer.innerHTML = sections.slice(0, 5).map(sec => {
                    const products = sec.items || [];
                    if (products.length === 0) return '';

                    const displayItems = products.slice(0, 4); // Show 4 on home page

                    return `
                    <section class="cat-section" id="sec-${sec.category_id}">
                        <div class="cat-section-header" style="border-left:5px solid var(--primary);">
                            <h2>${sec.category}</h2>
                            <a href="category.html?id=${sec.category_id}&nm=${encodeURIComponent(sec.category)}" 
                               class="view-all-link">
                                View All (${products.length}) <i class="fas fa-arrow-right"></i>
                            </a>
                        </div>
                        <div class="cat-product-row">
                            ${displayItems.map(p => {
                                const id = p.prod_id || p.id;
                                const name = p.prod_name || p.productname || p.name || 'Product';
                                return `
                                <div class="product-card" id="feat-${id}" data-id="${id}" onclick="location.href='single-product.html?id=${id}'">
                                    <div class="badge-offer">HOT</div>
                                    <div class="wishlist-btn" onclick="event.stopPropagation(); window.toggleWishlist('${id}')">
                                        <i class="far fa-heart"></i>
                                    </div>
                                    <div class="img-container">
                                        <div class="skeleton" style="width:100%; height:100%; position:absolute; top:0; left:0; background:#eee;"></div>
                                        <img src="" alt="${name}" style="opacity:0; transition:opacity 0.3s;" onerror="this.src='https://placehold.co/400x400?text=Product'">
                                    </div>
                                    <div class="product-info">
                                        <div class="rating">
                                            <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>
                                            <i class="fas fa-star"></i><i class="fas fa-star-half-alt"></i>
                                            <span>(85)</span>
                                        </div>
                                        <h3 class="product-title">${name}</h3>
                                        <div class="price-row">
                                            <div class="product-price">₹...</div>
                                        </div>
                                        <button class="add-btn" onclick="event.stopPropagation(); window.addToCart('${id}')">
                                            <i class="fas fa-shopping-cart"></i> ADD TO CART
                                        </button>
                                    </div>
                                </div>`;
                            }).join('')}
                        </div>
                    </section>`;
                }).join('');

                // 2. Collect ALL display products for bulk enrichment
                const allVisibleProducts = sections.slice(0, 5).flatMap(sec => {
                    return (sec.items || []).slice(0, 4);
                });
                
                if (allVisibleProducts.length > 0) {
                    const enrichRes = await fetch('/api/products/enrich', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ products: allVisibleProducts })
                    });
                    const enrichedList = await enrichRes.json();

                    // 3. Update the UI from the enriched list
                    const extractNumeric = (s) => {
                        if (!s) return 0;
                        const clean = s.toString().replace(/&#\d+;/g, '').replace(/,/g, '');
                        const match = clean.match(/[\d.]+/);
                        if (!match) return 0;
                        const val = parseFloat(match[0]);
                        return isNaN(val) ? 0 : val;
                    };

                    enrichedList.forEach(p => {
                        const id = p.prod_id || p.id;
                        const cards = document.querySelectorAll(`[data-id="${id}"]`);
                        cards.forEach(card => {
                            if (!card.id.startsWith('feat-')) return;
                            const img = card.querySelector('img');
                            const skeleton = card.querySelector('.skeleton');
                            const priceEl = card.querySelector('.product-price');

                            if (img && !img.src.includes('http')) {
                                let imgUrl = p.img || 'https://via.placeholder.com/300';
                                if (imgUrl.endsWith('/') || imgUrl.endsWith('\\')) {
                                    imgUrl = 'https://via.placeholder.com/400?text=No+Image+Available';
                                }
                                img.src = imgUrl;
                                img.onload = () => {
                                    img.style.opacity = '1';
                                    if (skeleton) skeleton.style.display = 'none';
                                };
                                img.onerror = () => {
                                    img.src = 'https://via.placeholder.com/400?text=Image+Load+Failed';
                                    if (skeleton) skeleton.style.display = 'none';
                                };
                            }
                            if (priceEl && priceEl.textContent === '₹...') {
                                const price = extractNumeric(p.price);
                                priceEl.textContent = `₹${price.toLocaleString('en-IN')}`;
                            }
                        });
                    });
                }
            }
        } catch (err) {
            console.error('Featured Sections Error:', err);
        }
    }

    // Function removed - navigating to new page instead of expanding
    window.toggleExpand = (id) => {
        location.href = `category.html?search=${encodeURIComponent(id)}&nm=${encodeURIComponent(id)}`;
    };

    loadFeaturedSections();

});
