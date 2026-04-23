(async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const pscid = urlParams.get('subcat');
    const pcid = urlParams.get('pcid') || urlParams.get('id');
    const psearch = urlParams.get('search');
    const catTitleFromUrl = urlParams.get('cat') || urlParams.get('nm') || 'Category';
    console.log('[DEBUG-CAT] URL Params:', { pscid, pcid, psearch, catTitleFromUrl });

    async function renderFilters(pscid, pcid) {
        const container = document.getElementById('dynamicFilters');
        if (!container) return;
        
        try {
            const [filterRes, brandsRes, colorsRes, specsMasterRes] = await Promise.all([
                fetch(`/api/products/filter-options?pscid=${pscid || ''}&pc_id=${pcid || ''}`),
                fetch('/api/brands/master'),
                fetch('/api/colors/master'),
                fetch(`/api/specifications/master?pscid=${pscid || ''}`)
            ]);
            
            const filters = await filterRes.json();
            const brandMasterRaw = await brandsRes.json();
            const colorMasterRaw = await colorsRes.json();
            const specsMasterRaw = await specsMasterRes.json();
            
            const brandMasterList = Array.isArray(brandMasterRaw) ? brandMasterRaw : (brandMasterRaw.brand || brandMasterRaw.value || []);
            const colorMasterList = Array.isArray(colorMasterRaw) ? colorMasterRaw : (colorMasterRaw.value || colorMasterRaw.color || []); 
            const specsMasterList = Array.isArray(specsMasterRaw) ? specsMasterRaw : [];

            let html = '';

            // --- BRAND MAPPING ---
            const catBrands = filters.brands || [];
            const finalBrands = (catBrands.length > 0) ? catBrands.map(cb => {
                const master = brandMasterList.find(m => String(m.brandid) === String(cb.brandid));
                const bName = master ? (master.brandname || master.brand_name || master.name || master.brand) : (cb.brandname || cb.brand_name || cb.name);
                return { brandid: cb.brandid, brandname: bName || ('Brand ' + cb.brandid) };
            }) : brandMasterList;

            if (finalBrands.length > 0) {
                html += `
                    <div class="filter-item" style="display:flex; flex-direction:column; gap:5px;">
                        <span style="font-weight:800; color:#444; font-size:10px; text-transform:uppercase;">Select Brand</span>
                        <select onchange="window.applyFilter('brand', this.value)" style="padding: 10px; border-radius: 8px; border: 1px solid #ddd; background: white; font-weight: 700; color: #333; cursor: pointer; min-width:140px;">
                            <option value="">All Brands</option>
                            ${finalBrands.slice(0, 50).map(b => `<option value="${b.brandid}">${b.brandname || ('Brand ' + b.brandid)}</option>`).join('')}
                        </select>
                    </div>`;
            }

            // --- COLOR MAPPING (Per User Specification: color_brandcat_subcat.php + prod_color_master.php) ---
            const catColors = filters.colors || [];
            const finalColors = (catColors.length > 0) ? catColors.map(cc => {
                const localName = cc.color_name || cc.colors_name || cc.name || cc.color;
                if (localName && !localName.toLowerCase().includes('color ')) {
                    return { colors_id: cc.colors_id, color_name: localName };
                }
                const master = colorMasterList.find(m => String(m.colors_id || m.color_id || m.id || m.colorid) === String(cc.colors_id));
                const cName = master ? (master.color_name || master.colors_name || master.name || master.color || master.colorname) : localName;
                return { colors_id: cc.colors_id, color_name: cName || ('Color ' + cc.colors_id) };
            }) : colorMasterList;

            if (finalColors.length > 0) {
                html += `
                    <div class="filter-item" style="display:flex; flex-direction:column; gap:5px;">
                        <span style="font-weight:800; color:#444; font-size:10px; text-transform:uppercase;">Select Color</span>
                        <select onchange="window.applyFilter('color', this.value)" style="padding: 10px; border-radius: 8px; border: 1px solid #ddd; background: white; font-weight: 700; color: #333; cursor: pointer; min-width:140px;">
                            <option value="">All Colors</option>
                            ${finalColors.slice(0, 50).map(c => `<option value="${c.colors_id}">${c.color_name}</option>`).join('')}
                        </select>
                    </div>`;
            }

            const finalSpecs = (filters.specifications && filters.specifications.length > 0) ? filters.specifications : specsMasterList;
            if (finalSpecs && finalSpecs.length > 0) {
                html += `
                    <div class="filter-item" style="display:flex; flex-direction:column; gap:5px;">
                        <span style="font-weight:800; color:#444; font-size:10px; text-transform:uppercase;">Specification</span>
                        <select onchange="window.applyFilter('specs', this.value)" style="padding: 10px; border-radius: 8px; border: 1px solid #ddd; background: white; font-weight: 700; color: #333; cursor: pointer; min-width:140px;">
                            <option value="">All Specs</option>
                            ${finalSpecs.slice(0, 50).map(s => `<option value="${s.specification}">${s.specification || 'Spec'}</option>`).join('')}
                        </select>
                    </div>`;
            }

            container.innerHTML = html || '<span style="color:#999; font-size:12px;">No filters for this category</span>';
        } catch (err) { 
            console.error('[FILTERS] Render failed:', err);
            container.innerHTML = '';
        }
    }

    window.applyFilter = (type, value) => {
        const url = new URL(window.location.href);
        if (value) url.searchParams.set(type === 'brand' ? 'brandid' : (type === 'color' ? 'colorid' : 'specif'), value);
        else url.searchParams.delete(type === 'brand' ? 'brandid' : (type === 'color' ? 'colorid' : 'specif'));
        
        url.searchParams.set('fsort', 'newest');
        const fetchUrl = `/api/products-filtered${url.search}`;
        
        fetch(fetchUrl).then(r => r.json()).then(renderProducts).catch(console.error);
        updateProductCounts(pscid, '', '');
    };

    async function fetchBySubCategory(id, title) {
        document.getElementById('catTitle').innerHTML = `<h1>${title} <span id="categoryCount" class="live-item-count"></span></h1>`;
        try {
            const res = await fetch(`/api/subcategory-products?pscid=${id}`);
            const products = await res.json();
            renderProducts(products);
        } catch (err) { console.error(err); }
    }

    async function updateProductCounts(pscid, fsort, psearch) {
        console.log('[DEBUG-CAT] updateProductCounts called for:', pscid);
        const countSpan = document.getElementById('categoryCount');
        if (!countSpan) return;
        try {
            const res = await fetch(`/api/category/count?pscid=${pscid || ''}&fsort=${fsort || ''}&psearch=${psearch || ''}`);
            const data = await res.json();
            let total = Array.isArray(data) ? data.length : (data.total_products || data.total || data.product_count || data.value || 0);
            countSpan.innerHTML = `&nbsp;&nbsp;&mdash;&nbsp;&nbsp; ${total} Premium Items Found`;
            countSpan.style.display = 'inline-flex';
            countSpan.style.visibility = 'visible';
            countSpan.style.opacity = '1';
        } catch (e) { countSpan.style.display = 'none'; }
    }

    async function fetchCategoryById(id, title) {
        console.log('[DEBUG-CAT] fetchCategoryById:', id);
        document.getElementById('catTitle').innerHTML = `<h1>${title} <span id="categoryCount" class="live-item-count" style="display:none;"></span></h1>`;
        updateProductCounts(id, '', '');
        const grid = document.getElementById('productGrid');
        grid.innerHTML = '<div class="loading"><div class="spinner"></div> Checking subcategories...</div>';
        try {
            const subRes = await fetch(`/api/category-subcategories?pc_id=${id}`);
            const subcategories = await subRes.json().catch(() => []);
            if (subcategories && subcategories.length > 0) renderSubcategories(subcategories, title);
            else {
                const res = await fetch(`/api/subcategory-products?pc_id=${id}`);
                const products = await res.json();
                renderProducts(products);
            }
        } catch (err) { grid.innerHTML = '<p style="text-align:center; padding:50px;">Failed to load category.</p>'; }
    }

    function renderSubcategories(subs, catTitle) {
        const grid = document.getElementById('productGrid');
        if (!grid) return;
        grid.innerHTML = subs.map(s => {
            const name = s.subcategory || s.name || 'Collection';
            const img = s.subcategory_img || s.img || 'https://placehold.co/300x400?text=' + encodeURIComponent(name);
            return `
                <div class="product-card subcat-card" onclick="location.href='category.html?subcat=${s.subcategory_id}&cat=${encodeURIComponent(name)}'">
                    <div class="img-container"><img src="${img}" alt="${name}"></div>
                    <div class="product-info"><h3>${name}</h3><button class="add-btn">VIEW ALL</button></div>
                </div>`;
        }).join('');
    }

    function renderProducts(products) {
        const grid = document.getElementById('productGrid');
        if (!grid) return;
        const countSpan = document.getElementById('categoryCount');
        if (countSpan) {
            const total = Array.isArray(products) ? products.length : 0;
            countSpan.innerHTML = `&nbsp;&nbsp;&mdash;&nbsp;&nbsp; ${total} Premium Items Found`;
            countSpan.style.display = 'inline-flex';
            countSpan.style.visibility = 'visible';
            countSpan.style.opacity = '1';
        }
        if (!products || products.length === 0) {
            grid.innerHTML = '<div style="padding: 50px; text-align: center; color: #888; grid-column: span 3;"><i class="fas fa-search" style="font-size: 48px; margin-bottom: 20px; color: #eee;"></i><p>No matching products found.</p></div>';
            return;
        }
        grid.innerHTML = products.map(p => `
            <div class="product-card" onclick="location.href='single-product.html?id=${p.id}'">
                <div class="img-container"><img src="${p.image}" alt="${p.name}"></div>
                <div class="product-info">
                    <h3 class="product-title">${p.name}</h3>
                    <div class="price-row"><span class="product-price">₹${p.price}</span>${p.mrp > p.price ? `<span class="old-price">₹${p.mrp}</span>` : ''}</div>
                    <button class="add-btn" onclick="event.stopPropagation(); window.addToCart('${p.id}')"><i class="fas fa-shopping-basket"></i> ADD TO CART</button>
                </div>
            </div>`).join('');
    }

    if (pscid) { fetchBySubCategory(pscid, catTitleFromUrl); renderFilters(pscid, pcid); }
    else if (pcid) { fetchCategoryById(pcid, catTitleFromUrl); renderFilters('', pcid); }
    else if (psearch || catTitleFromUrl === 'Hot Deals' || catTitleFromUrl === 'New Arrivals') { 
        const searchVal = psearch || catTitleFromUrl;
        document.getElementById('catTitle').innerHTML = `<h1>${searchVal} <span id="categoryCount" class="live-item-count"></span></h1>`;
        
        let fetchUrl = `/api/subcategory-products?search=${encodeURIComponent(searchVal)}`;
        
        // Special case for Hot Deals (from hot_deal.php API)
        if (searchVal.toLowerCase().includes('hot deals')) {
            fetch('/api/hot-deals')
                .then(r => r.json())
                .then(data => {
                    const normalized = (Array.isArray(data) ? data : (data.value || [])).map(d => ({
                        id: d.pscid || '0',
                        name: (d.text1 || 'Deal Product').trim(),
                        price: (d.text2 || '0').match(/[\d.]+/)?.[0] || '0',
                        image: d.bannerUrl && d.bannerUrl.startsWith('http') ? d.bannerUrl : ('https://digifysoft.in/websale/APIV2/' + (d.bannerUrl || '').replace(/^\//, '')),
                        mrp: ((parseFloat((d.text2 || '0').match(/[\d.]+/)?.[0] || '0') || 0) * 1.2).toFixed(0)
                    }));
                    renderProducts(normalized);
                }).catch(console.error);
        } 
        // Special case for New Arrivals (from bot_banner API)
        else if (searchVal.toLowerCase().includes('new arrivals')) {
            fetch('/api/banners?type=bot_banner')
                .then(r => r.json())
                .then(data => {
                    const normalized = (Array.isArray(data) ? data : []).map(b => ({
                        id: b.productCode || '0',
                        name: 'New Collection Item',
                        price: 'Special Price',
                        image: b.bannerUrl || 'https://placehold.co/400x400?text=New+Arrival'
                    }));
                    renderProducts(normalized);
                }).catch(console.error);
        }
        else {
            fetch(fetchUrl).then(r => r.json()).then(renderProducts).catch(console.error);
            updateProductCounts('', '', searchVal);
        }
    }
})();
