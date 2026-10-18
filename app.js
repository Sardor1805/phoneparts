const categories = [
  {id:'screens',name:'Ekranlar',icon:'▣',hint:'Displey va sensorlar'},
  {id:'batteries',name:'Batareyalar',icon:'▰',hint:'Quvvat manbalari'},
  {id:'back-covers',name:'Orqa korpuslar',icon:'▱',hint:'Orqa qopqoqlar'},
  {id:'glass',name:'Ekran oynalari',icon:'◇',hint:'Himoya va oynalar'},
  {id:'other',name:'Boshqa ehtiyot qismlar',icon:'⚙',hint:'Mayda qismlar'}
];
// Demo ma'lumotlar. Haqiqiy saytda mahsulotlar server/bazadan keladi.
// Ekranlar bo'limida internalCode bitta mahsulotni anglatadi; compatible ro'yxatidagi
// turli modellar uchun mijozga mos variantlar ko'rsatilishi mumkin.

let products = [];

// Supabase ma'lumotlarini shu yerga kiriting
const supabaseClient = window.supabase.createClient(
  'YOUR_SUPABASE_PROJECT_URL',
  'YOUR_SUPABASE_PUBLISHABLE_KEY'
);

async function loadProducts() {
  const { data, error } = await supabaseClient
    .from('products')
    .select(`
      *,
      product_compatibility (
        phone_models (
          name,
          brands (name)
        )
      )
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Mahsulotlarni yuklash xatosi:', error);
    toast('Mahsulotlarni yuklab bo‘lmadi. Ulanishni tekshiring.');
    renderAll();
    updateCart();
    return;
  }

  products = (data || []).map(p => {
    const models = (p.product_compatibility || [])
      .map(item => item.phone_models)
      .filter(Boolean);

    const modelNames = [...new Set(models.map(m => m.name))];
    const brandNames = [...new Set(
      models.map(m => m.brands?.name).filter(Boolean)
    )];

    const categorySymbols = {
      screens: '▣',
      batteries: '▰',
      'back-covers': '▱',
      glass: '◇',
      other: '⚙'
    };

    return {
      id: p.id,
      internalCode: p.internal_code,
      category: p.category,
      name: p.name,
      brand: brandNames.join(', ') || 'Boshqa',
      models: modelNames.length ? modelNames : ['Model kiritilmagan'],
      compatible: models.map(m =>
        [m.brands?.name, m.name].filter(Boolean).join(' ')
      ),
      price: Number(p.price),
      cost: Number(p.cost_price),
      stock: Number(p.stock),
      status: Number(p.stock) > 0 ? 'stock' : 'wait',
      created: Date.parse(p.created_at) || 0,
      description: p.description || '',
      symbol: categorySymbols[p.category] || '⚙'
    };
  });

  renderAll();
  updateCart();
}

const state={category:null,brand:null,model:null,search:'',sort:'newest',cart:[],authMode:'login',user:null,banner:0};
const $=id=>document.getElementById(id); const money=n=>new Intl.NumberFormat('uz-UZ').format(n)+' so‘m';
function toast(message){const el=$('toast');el.textContent=message;el.classList.remove('hidden');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.add('hidden'),2600)}
function categoryName(id){return categories.find(c=>c.id===id)?.name||'Kategoriya'}
function renderCategories(){$('categoryButtons').innerHTML=categories.map(c=>`<button class="category-button ${state.category===c.id?'selected':''}" data-category="${c.id}"><span class="category-icon">${c.icon}</span><strong>${c.name}</strong><small>${c.hint}</small></button>`).join('')}
function getBrands(){return [...new Set(products.filter(p=>!state.category||p.category===state.category).map(p=>p.brand))]}
function renderBrands(){const brands=getBrands();$('brandButtons').innerHTML=brands.map(b=>`<button class="brand-pill ${state.brand===b?'selected':''}" data-brand="${b}">${b}</button>`).join('');const models=[...new Set(products.filter(p=>(!state.category||p.category===state.category)&&(!state.brand||p.brand===state.brand)).flatMap(p=>p.models))];$('modelButtons').innerHTML=models.map(m=>`<button class="model-pill ${state.model===m?'selected':''}" data-model="${m}">${m}</button>`).join('')}
function filteredProducts(){let list=products.filter(p=>(!state.category||p.category===state.category)&&(!state.brand||p.brand===state.brand)&&(!state.model||p.models.includes(state.model)));if(state.search){const q=state.search.toLowerCase();list=list.filter(p=>[p.name,p.brand,p.category,p.internalCode,...p.models,...p.compatible].join(' ').toLowerCase().includes(q)||categoryName(p.category).toLowerCase().includes(q))}if(state.sort==='priceAsc')list.sort((a,b)=>a.price-b.price);else if(state.sort==='priceDesc')list.sort((a,b)=>b.price-a.price);else list.sort((a,b)=>b.created-a.created);return list}
function renderProducts(){const list=filteredProducts();$('catalogTitle').textContent=state.category?categoryName(state.category):state.brand||state.model||'Yangi mahsulotlar';$('resultCount').textContent=`${list.length} ta mahsulot`;$('productGrid').innerHTML=list.map(p=>`<article class="product-card"><div class="product-image" data-detail="${p.id}"><span class="stock-tag ${p.status==='wait'?'wait':''}">${p.status==='wait'?'1 kunda do‘konga keladi':'Omborda mavjud'}</span><div class="image-placeholder">${p.symbol}</div></div><div class="product-info"><div class="product-model">${p.brand} · ${p.models[0]}</div><div class="product-name" data-detail="${p.id}">${p.name}</div><div class="compatibility">Mosligi: ${p.compatible.join(', ')}</div><div class="product-bottom"><div class="price">${money(p.price)}</div><button class="add-button" data-add="${p.id}" aria-label="Savatga qo‘shish">+</button></div></div></article>`).join('');$('emptyState').classList.toggle('hidden',list.length!==0)}
function renderAll(){renderCategories();renderBrands();renderProducts()}
function addToCart(id,qty=1){const p=products.find(x=>x.id===Number(id));if(!p)return;const existing=state.cart.find(x=>x.id===p.id);if(existing)existing.qty+=qty;else state.cart.push({id:p.id,qty});updateCart();toast('Mahsulot savatga qo‘shildi')}
function updateCart(){const count=state.cart.reduce((s,x)=>s+x.qty,0);$('cartCount').textContent=count;$('cartItems').innerHTML=state.cart.length?state.cart.map(item=>{const p=products.find(x=>x.id===item.id);return `<div class="cart-row"><div class="cart-thumb">${p.symbol}</div><div><strong>${p.name}</strong><small>${p.brand} · ${p.models.join(', ')}</small><div class="cart-qty"><button data-qty="-" data-id="${p.id}">−</button><span>${item.qty}</span><button data-qty="+" data-id="${p.id}">+</button><button class="remove-line" data-remove="${p.id}">O‘chirish</button></div></div><div class="line-price">${money(p.price*item.qty)}</div></div>`}).join(''):'<p class="muted">Savatingiz hozircha bo‘sh.</p>';$('cartTotal').textContent=money(state.cart.reduce((s,x)=>s+products.find(p=>p.id===x.id).price*x.qty,0));}
function openProduct(id){const p=products.find(x=>x.id===Number(id));if(!p)return;$('productDetail').innerHTML=`<div class="detail-layout"><div class="detail-image"><div class="image-placeholder">${p.symbol}</div></div><div><span class="eyebrow">${categoryName(p.category)}</span><h2>${p.name}</h2><div class="product-model">${p.brand} · ${p.models.join(', ')}</div><div class="price">${money(p.price)}</div><p>${p.description||'Mahsulot haqida qo‘shimcha ma’lumot yo‘q.'}</p><div class="detail-list"><div>✓ Mosligi: ${p.compatible.join(', ')}</div><div>${p.status==='wait'?'◷ 1 kunda do‘konga keladi':'✓ Omborda mavjud: '+p.stock+' dona'}</div></div><div class="quantity-control"><button id="detailMinus">−</button><span id="detailQty">1</span><button id="detailPlus">+</button></div><button class="primary-button full" id="detailAdd">Savatga qo‘shish →</button></div></div>`;let qty=1;$('detailMinus').onclick=()=>{qty=Math.max(1,qty-1);$('detailQty').textContent=qty};$('detailPlus').onclick=()=>{qty++;$('detailQty').textContent=qty};$('detailAdd').onclick=()=>{addToCart(p.id,qty);$('productOverlay').classList.add('hidden')};$('productOverlay').classList.remove('hidden')}
function openAuth(){if(state.user){toast('Profil funksiyasi backend ulangandan keyin ishlaydi');return}$('loginOverlay').classList.remove('hidden')}
function setAuthMode(mode){state.authMode=mode;const reg=mode==='register';$('authTitle').textContent=reg?'Ro‘yxatdan o‘tish':'Kirish';$('nameField').classList.toggle('hidden',!reg);$('nameField').querySelector('input').required=reg;$('authSubmit').textContent=reg?'Akkaunt yaratish':'Kirish';$('switchAuth').textContent=reg?'Akkauntingiz bormi? Kirish':'Akkauntingiz yo‘qmi? Ro‘yxatdan o‘ting'}
$('categoryButtons').addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(!b)return;state.category=state.category===b.dataset.category?null:b.dataset.category;state.brand=null;state.model=null;renderAll();$('catalog').scrollIntoView({behavior:'smooth',block:'start'})});$('brandButtons').addEventListener('click',e=>{const b=e.target.closest('[data-brand]');if(!b)return;state.brand=state.brand===b.dataset.brand?null:b.dataset.brand;state.model=null;renderAll()});$('modelButtons').addEventListener('click',e=>{const b=e.target.closest('[data-model]');if(!b)return;state.model=state.model===b.dataset.model?null:b.dataset.model;renderAll();$('catalog').scrollIntoView({behavior:'smooth',block:'start'})});$('productGrid').addEventListener('click',e=>{const add=e.target.closest('[data-add]');const detail=e.target.closest('[data-detail]');if(add){e.stopPropagation();addToCart(add.dataset.add)}else if(detail)openProduct(detail.dataset.detail)});$('searchInput').addEventListener('input',e=>{state.search=e.target.value;renderProducts()});$('searchInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('catalog').scrollIntoView({behavior:'smooth'})});$('sortSelect').addEventListener('change',e=>{state.sort=e.target.value;renderProducts()});$('clearFilters').onclick=()=>{state.category=state.brand=state.model=null;state.search='';$('searchInput').value='';renderAll()};$('openCart').onclick=()=>{$('cartOverlay').classList.remove('hidden');updateCart()};$('cartItems').addEventListener('click',e=>{const q=e.target.closest('[data-qty]');const rm=e.target.closest('[data-remove]');if(q){const item=state.cart.find(x=>x.id===Number(q.dataset.id));if(item){item.qty+=q.dataset.qty==='+'?1:-1;if(item.qty<1)state.cart=state.cart.filter(x=>x.id!==item.id)}updateCart()}if(rm){state.cart=state.cart.filter(x=>x.id!==Number(rm.dataset.remove));updateCart()}});$('loginBtn').onclick=openAuth;$('switchAuth').onclick=()=>setAuthMode(state.authMode==='login'?'register':'login');$('authForm').onsubmit=e=>{e.preventDefault();toast('Namuna rejimi: login uchun server va ma’lumotlar bazasi ulanishi kerak');};$('checkoutBtn').onclick=()=>{if(!state.cart.length){toast('Avval savatga mahsulot qo‘shing');return}$('cartOverlay').classList.add('hidden');openAuth();toast('Buyurtma berishdan oldin akkauntga kiring')};document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).classList.add('hidden'));document.querySelectorAll('.overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.add('hidden')}));
const banners=[{eyebrow:'PHONEPARTS DO‘KONI',title:'Telefoningiz uchun<br><span>kerakli ehtiyot qism.</span>',text:'Ekran, batareya va boshqa ehtiyot qismlarni qulay toping.'},{eyebrow:'MOSLIKNI OSON TOPING',title:'Kerakli modelni<br><span>tezda qidiring.</span>',text:'Marka, model yoki mahsulot nomi orqali katalogni saralang.'},{eyebrow:'BUYURTMA QULAYLIGI',title:'Mahsulotlarni tanlang,<br><span>savatga jamlang.</span>',text:'Buyurtma tarkibini tekshirib, keyin rasmiylashtiring.'}];function showBanner(i){state.banner=(i+banners.length)%banners.length;const b=banners[state.banner];document.querySelector('.hero-copy .eyebrow').textContent=b.eyebrow;document.querySelector('.hero h1').innerHTML=b.title;document.querySelector('.hero-copy p').textContent=b.text;document.querySelectorAll('.banner-dots span').forEach((d,n)=>d.classList.toggle('active',n===state.banner))}$('prevBanner').onclick=()=>showBanner(state.banner-1);$('nextBanner').onclick=()=>showBanner(state.banner+1);setInterval(()=>showBanner(state.banner+1),6500);$('year').textContent=new Date().getFullYear();loadProducts();setAuthMode('login');
