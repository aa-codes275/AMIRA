/* =========================================================
   Amira للعطور — Frontend Logic
   - Supabase products + orders
   - Moyasar Apple Pay / Card
   - WhatsApp confirmation (Apple Pay AND COD)
   - SAR currency
   ========================================================= */
// ============ CONFIG ============
// 🔑 يتم تعبئتها تلقائيًا من إعدادات لوحة الإدارة (localStorage: fi_settings)
const DEFAULT_CONFIG = {
  SUPABASE_URL: "https://fpwipcymceuauksbdsiy.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_U16v3EtalNf4Ip--dUnyiA_3WVIGewQ",
  WHATSAPP_NUMBER: "966558787732",
  // ضع مفتاح Moyasar Publishable من admin > الإعدادات (يبدأ بـ pk_test_ أو pk_live_)
  MOYASAR_PUBLISHABLE_KEY: "",
  STORE_NAME: "Amira للعطور",
  CURRENCY: "SAR"
};
function loadConfig(){
  try{
    const s = JSON.parse(localStorage.getItem('fi_settings')||'{}');
    return {
      ...DEFAULT_CONFIG,
      WHATSAPP_NUMBER: s.wa || DEFAULT_CONFIG.WHATSAPP_NUMBER,
      MOYASAR_PUBLISHABLE_KEY: s.moyasar_pk || DEFAULT_CONFIG.MOYASAR_PUBLISHABLE_KEY,
      STORE_NAME: s.name || DEFAULT_CONFIG.STORE_NAME
    };
  }catch(_){ return DEFAULT_CONFIG; }
}
let CONFIG = loadConfig();
const supabaseClient = window.supabase
  ? supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY)
  : null;
// ============ FALLBACK PRODUCTS ============
const FALLBACK_PRODUCTS = [];
let REAL_PRODUCTS = [];
let cart = JSON.parse(localStorage.getItem('fi_cart') || '[]');
// ============ HELPERS ============
const $ = (s,p=document)=>p.querySelector(s);
const fmt = n => Number(n||0).toFixed(2);
const saveCart = ()=> localStorage.setItem('fi_cart', JSON.stringify(cart));
function showToast(msg, icon='circle-check', isErr=false){
  const t = $('#toast');
  t.innerHTML = `<i class="fa-solid fa-${icon}"></i> ${msg}`;
  t.classList.toggle('err', isErr);
  t.classList.add('show');
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(()=>t.classList.remove('show'), 2800);
}
function starsHTML(r){
  const full = Math.floor(r), half = r%1 >= 0.5;
  let html = '';
  for(let i=0;i<5;i++){
    if(i<full) html+='<i class="fa-solid fa-star"></i>';
    else if(i===full && half) html+='<i class="fa-solid fa-star-half-stroke"></i>';
    else html+='<i class="fa-solid fa-star off"></i>';
  }
  return `<span class="stars" aria-label="${r} من 5">${html}</span><span>(${r.toFixed(1)})</span>`;
}
// ============ HERO ============
function initHero(){
  const slides = document.querySelectorAll('.slide');
  const dotsBox = $('#heroDots');
  if(!slides.length || !dotsBox) return;
  dotsBox.innerHTML = '';
  slides.forEach((_,i)=>{
    const b = document.createElement('button');
    b.setAttribute('aria-label', 'الشريحة '+(i+1));
    if(i===0) b.classList.add('active');
    b.onclick = ()=>goSlide(i);
    dotsBox.appendChild(b);
  });
  let idx = 0;
  function goSlide(n){
    slides[idx].classList.remove('active');
    dotsBox.children[idx].classList.remove('active');
    idx = (n+slides.length)%slides.length;
    slides[idx].classList.add('active');
    dotsBox.children[idx].classList.add('active');
  }
  setInterval(()=>goSlide(idx+1), 6000);
}
// ============ HEADER ============
function initHeader(){
  const header = $('#mainHeader');
  window.addEventListener('scroll', ()=>{
    header.classList.toggle('scrolled', window.scrollY > 30);
  }, { passive:true });
  const burger = $('#burger');
  const nav = document.querySelector('.main-nav');
  burger.addEventListener('click', ()=>{
    burger.classList.toggle('open');
    nav.classList.toggle('open');
  });
  nav.querySelectorAll('a').forEach(a=>a.addEventListener('click', ()=>{
    burger.classList.remove('open'); nav.classList.remove('open');
  }));
  // WhatsApp contact link
  const wa = $('#waContact');
  if(wa){
    wa.href = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}`;
    const num = $('#waContactNum');
    if(num) num.textContent = '+' + CONFIG.WHATSAPP_NUMBER.replace(/^(\d{3})(\d{2})(\d{3})(\d{4})/,'$1 $2 $3 $4');
  }
}
// ============ PRODUCTS ============
async function fetchProducts(){
  let data = null;
  try{
    if(supabaseClient){
      const { data: rows, error } = await supabaseClient
        .from('luxury_products').select('*')
        .eq('is_visible_to_elite', true)
        .order('created_at', { ascending:false });
      if(error) throw error;
      data = rows;
    }
  } catch(e){ console.warn('Supabase unavailable, using fallback:', e.message); }
  REAL_PRODUCTS = (data && data.length) ? data : FALLBACK_PRODUCTS;
  renderProducts();
}
function renderProducts(){
  const c = $('#products-container');
  if(!REAL_PRODUCTS.length){
    c.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--muted);padding:40px">لا توجد منتجات حالياً.</p>`;
    return;
  }
  c.innerHTML = REAL_PRODUCTS.map((p,i)=>{
    const price = fmt(p.price_aqsa);
    const rating = p.rating || 4.7;
    const img = p.supreme_image_url || 'https://via.placeholder.com/600x600?text=Perfume';
    return `
      <article class="product-card" style="animation-delay:${i*60}ms">
        <div class="product-img-wrap">
          ${p.is_new ? '<span class="product-badge">جديد</span>' : ''}
          <img src="${img}" alt="${p.product_name_ar||''}" loading="lazy">
        </div>
        <div class="product-body">
          <h3>${p.product_name_ar||''}</h3>
          <div class="rating">${starsHTML(rating)}</div>
          <p class="product-desc">${p.exquisite_description||'عطر فاخر ومميز.'}</p>
          <div class="price-row">
            <span class="price">${price}<small> ر.س</small></span>
          </div>
        </div>
        <div class="product-actions">
          <button class="btn-add" onclick="addToCart('${p.id}')"><i class="fa-solid fa-bag-shopping"></i> إضافة للحقيبة</button>
          <button class="btn-view" onclick="openProductModal('${p.id}')" aria-label="عرض"><i class="fa-solid fa-eye"></i></button>
        </div>
      </article>`;
  }).join('');
}
function openProductModal(id){
  const p = REAL_PRODUCTS.find(x=>String(x.id)===String(id));
  if(!p) return;
  const price = fmt(p.price_aqsa);
  const rating = p.rating || 4.7;
  $('#productModalBody').innerHTML = `
    <button class="modal-close" onclick="closeProductModal()" aria-label="إغلاق"><i class="fa-solid fa-xmark"></i></button>
    <div class="modal-grid">
      <div class="modal-img" style="background-image:url('${p.supreme_image_url||''}')"></div>
      <div class="modal-info">
        <span class="kicker">مجموعة حصرية</span>
        <h2>${p.product_name_ar||''}</h2>
        <div class="rating">${starsHTML(rating)}</div>
        <p class="desc">${p.exquisite_description||'عطر فاخر ومميز.'}</p>
        <div class="price-row" style="margin-bottom:24px">
          <span class="price">${price}<small> ر.س</small></span>
        </div>
        <button class="btn btn-gold" style="width:100%" onclick="addToCart('${p.id}');closeProductModal()"><i class="fa-solid fa-bag-shopping"></i> إضافة للحقيبة</button>
      </div>
    </div>`;
  $('#productModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeProductModal(){
  $('#productModal').classList.remove('open');
  if(!$('#cartSidebar').classList.contains('open')) document.body.style.overflow = '';
}
// ============ CART ============
function toggleCart(){
  const open = $('#cartSidebar').classList.toggle('open');
  $('#cartBackdrop').classList.toggle('open', open);
  document.body.style.overflow = open ? 'hidden' : '';
}
function addToCart(id){
  const p = REAL_PRODUCTS.find(x=>String(x.id)===String(id));
  if(!p) return;
  const existing = cart.find(c=>String(c.id)===String(id));
  if(existing) existing.qty++;
  else cart.push({ id:p.id, name:p.product_name_ar, price:Number(p.price_aqsa), img:p.supreme_image_url, qty:1 });
  saveCart(); updateCartUI();
  showToast(`✓ تمت إضافة "${p.product_name_ar}" للحقيبة`);
}
function changeQty(id, delta){
  const item = cart.find(c=>String(c.id)===String(id));
  if(!item) return;
  item.qty += delta;
  if(item.qty<=0) cart = cart.filter(c=>String(c.id)!==String(id));
  saveCart(); updateCartUI();
}
function removeItem(id){
  cart = cart.filter(c=>String(c.id)!==String(id));
  saveCart(); updateCartUI();
}
function cartSubtotal(){ return cart.reduce((s,i)=>s+i.price*i.qty, 0); }
function updateCartUI(){
  const count = cart.reduce((s,i)=>s+i.qty, 0);
  $('#cart-count').textContent = count;
  const box = $('#cartItems');
  const footer = $('#cartFooter');
  if(!cart.length){
    box.innerHTML = `<div class="empty-cart"><i class="fa-solid fa-bag-shopping"></i><p>الحقيبة فارغة</p><span>أضف عطورك المفضلة وابدأ التسوق</span></div>`;
    footer.hidden = true;
    return;
  }
  box.innerHTML = cart.map(i=>`
    <div class="cart-item">
      <img src="${i.img||'https://via.placeholder.com/80'}" alt="${i.name}">
      <div class="ci-body">
        <h4>${i.name}</h4>
        <div class="ci-price">${fmt(i.price)} ر.س</div>
        <div class="qty-row">
          <div class="qty">
            <button onclick="changeQty('${i.id}',-1)" aria-label="ناقص">−</button>
            <span>${i.qty}</span>
            <button onclick="changeQty('${i.id}',1)" aria-label="زائد">+</button>
          </div>
          <button class="remove-btn" onclick="removeItem('${i.id}')"><i class="fa-solid fa-trash"></i> حذف</button>
        </div>
      </div>
    </div>`).join('');
  $('#cart-total').textContent = fmt(cartSubtotal());
  footer.hidden = false;
}
// ============ CHECKOUT ============
function openCheckout(){
  if(!cart.length) return showToast('الحقيبة فارغة!', 'circle-exclamation', true);
  // restore saved customer info
  try{
    const saved = JSON.parse(localStorage.getItem('fi_customer')||'{}');
    ['name','phone','region','district','street','floor','postal','notes'].forEach(k=>{
      const el = document.getElementById('c_'+k);
      if(el && saved[k]) el.value = saved[k];
    });
  }catch(_){}
  $('#co-count').textContent = cart.reduce((s,i)=>s+i.qty,0);
  $('#co-total').textContent = fmt(cartSubtotal());
  $('#checkoutModal').classList.add('open');
  document.body.style.overflow = 'hidden';
  updatePayMethodUI();
}
function closeCheckout(){
  $('#checkoutModal').classList.remove('open');
  document.body.style.overflow = '';
  // destroy any moyasar instance
  const mf = $('#moyasar-payment-form');
  if(mf) mf.innerHTML = '';
}
function readCustomer(){
  return {
    name: $('#c_name').value.trim(),
    phone: $('#c_phone').value.trim(),
    region: $('#c_region').value,
    district: $('#c_district').value.trim(),
    street: $('#c_street').value.trim(),
    floor: $('#c_floor').value.trim(),
    postal: $('#c_postal').value.trim(),
    notes: $('#c_notes').value.trim()
  };
}
function validateCustomer(c){
  if(c.name.length < 3) return 'يرجى إدخال الاسم الكامل';
  if(!/^(05|5|9665|\+9665)[0-9]{8}$/.test(c.phone.replace(/\s/g,''))) return 'رقم جوال غير صحيح (مثال: 05XXXXXXXX)';
  if(!c.region) return 'يرجى اختيار المنطقة';
  if(!c.street) return 'يرجى إدخال العنوان التفصيلي';
  return null;
}
function selectedPayMethod(){
  const r = document.querySelector('input[name="paymethod"]:checked');
  return r ? r.value : 'applepay';
}
function updatePayMethodUI(){
  const m = selectedPayMethod();
  $('#submitLabel').textContent = m==='applepay' ? 'الدفع الآن' : 'تأكيد الطلب (دفع عند الاستلام)';
  // clear moyasar form if switching to COD
  if(m === 'cod'){ $('#moyasar-payment-form').innerHTML = ''; }
}
// ============ MOYASAR ============
function initMoyasar(amountHalalas, orderRef, customer){
  if(!window.Moyasar){ showToast('فشل تحميل Moyasar', 'circle-xmark', true); return false; }
  if(!CONFIG.MOYASAR_PUBLISHABLE_KEY){
    showToast('لم يتم ضبط مفتاح Moyasar في لوحة الإدارة', 'triangle-exclamation', true);
    return false;
  }
  $('#moyasar-payment-form').innerHTML = '';
  Moyasar.init({
    element: '#moyasar-payment-form',
    amount: amountHalalas, // halalas (SAR * 100)
    currency: 'SAR',
    description: `${CONFIG.STORE_NAME} — ${orderRef}`,
    publishable_api_key: CONFIG.MOYASAR_PUBLISHABLE_KEY,
    callback_url: window.location.origin + window.location.pathname + '?order=' + orderRef,
    methods: ['creditcard','applepay','stcpay'],
    apple_pay: {
      country: 'SA',
      label: CONFIG.STORE_NAME,
      validate_merchant_url: 'https://api.moyasar.com/v1/applepay/initiate'
    },
    metadata: {
      order_ref: orderRef,
      customer_name: customer.name,
      customer_phone: customer.phone,
      customer_address: [customer.region, customer.district, customer.street, customer.floor].filter(Boolean).join(' - ')
    },
    on_completed: function(payment){
      // store + notify via WhatsApp
      return saveOrder({
        ref: orderRef, total: amountHalalas/100, paid: true,
        method: 'moyasar', moyasar_id: payment.id, customer
      }).then(()=>{
        sendWhatsApp({ ref: orderRef, total: amountHalalas/100, paid: true, customer, paymentId: payment.id });
      });
    }
  });
  return true;
}
// ============ SAVE ORDER (Supabase + localStorage) ============
async function saveOrder({ ref, total, paid, method, moyasar_id, customer }){
  
  // 1. الـ Payload الموجه لقاعدة البيانات (Supabase) متطابق مع جدول luxury_orders في image.png
  const supabasePayload = {
    id: ref, // الـ id في الجدول نوعه text ويستقبل الـ ref كـ Primary Key
    client_name: customer.name,
    client_whatsapp: customer.phone, // أو الـ phone حسب استخدامك للواتساب
    client_phone: customer.phone,
    client_city: customer.region || '', // المنطقة أو المدينة
    client_district: customer.district || '', // الحي
    client_floor_details: `شارع: ${customer.street || ''} | دور: ${customer.floor || ''} | بريد: ${customer.postal || ''}`, // تجميع تفاصيل السكن في خانة الدور والتفاصيل
    payment_method: method,
    payment_status: paid ? 'paid' : 'pending',
    order_status: paid ? 'paid' : 'pending',
    total_amount: Number(total), // العمود في الداتابيز اسمه total_amount
    order_items: cart.map(i=>({id:i.id, name:i.name, qty:i.qty, price:i.price})) // العمود اسمه order_items ونوعه jsonb
  };

  // 2. الـ Payload المحلي للـ localStorage (إذا كنت تريد الاحتفاظ بنفس الصيغة القديمة للوحة التحكم)
  const localPayload = {
    order_ref: ref,
    customer_name: customer.name,
    customer_phone: customer.phone,
    customer_region: customer.region,
    customer_district: customer.district,
    customer_street: customer.street,
    customer_floor: customer.floor,
    customer_postal: customer.postal,
    customer_notes: customer.notes,
    items: cart.map(i=>({id:i.id, name:i.name, qty:i.qty, price:i.price})),
    total: Number(total),
    payment_method: method,
    payment_status: paid ? 'paid' : 'pending',
    moyasar_id: moyasar_id || null,
    status: paid ? 'paid' : 'pending'
  };

  try {
    if(supabaseClient){
      // تغيير اسم الجدول إلى luxury_orders بناءً على صورة image.png
      const { error } = await supabaseClient.from('luxury_orders').insert(supabasePayload);
      if(error) console.warn('Supabase luxury_orders insert failed:', error.message);
    }
  } catch(e) { 
    console.warn(e); 
  }

  // local mirror for admin panel
  try {
    const orders = JSON.parse(localStorage.getItem('fi_orders')||'[]');
    orders.unshift({
      id: ref,
      created_at: new Date().toISOString(),
      ...localPayload
    });
    localStorage.setItem('fi_orders', JSON.stringify(orders.slice(0,500)));
  } catch(_) {}
}
// ============ WHATSAPP ============
async function sendWhatsApp({ ref, total, paid, customer, paymentId }){
  const items = cart.map((it,i)=>`${i+1}. ${it.name} × ${it.qty} = ${fmt(it.price*it.qty)} ر.س`).join('\n');
  const addr = [
    `المنطقة: ${customer.region}`,
    customer.district ? `الحي: ${customer.district}` : null,
    `العنوان: ${customer.street}`,
    customer.floor ? `الدور/الشقة: ${customer.floor}` : null,
    customer.postal ? `الرمز البريدي: ${customer.postal}` : null,
    customer.notes ? `ملاحظات: ${customer.notes}` : null
  ].filter(Boolean).join('\n');
  const msg =
`*طلب جديد — ${CONFIG.STORE_NAME}*
رقم الطلب: *${ref}*
👤 *بيانات العميل:*
الاسم: ${customer.name}
الجوال: ${customer.phone}
${addr}
🛍️ *المنتجات:*
${items}
💰 *الإجمالي:* ${fmt(total)} ر.س
💳 *الدفع:* ${paid ? `✅ مدفوع عبر Apple Pay/Moyasar${paymentId?` (#${paymentId})`:''}` : '🟡 الدفع عند الاستلام'}
شكراً لاختياركم دار ${CONFIG.STORE_NAME} 🌹`;
  // حفظ نسخة من الطلب في جدول store_orders ليظهر بلوحة الإدارة
  try{
    if(supabaseClient){
      await supabaseClient.from('store_orders').insert({
        order_ref: ref,
        customer_name: customer.name,
        customer_phone: customer.phone,
        customer_region: customer.region,
        customer_district: customer.district,
        customer_street: customer.street,
        customer_floor: customer.floor,
        customer_postal: customer.postal,
        customer_notes: customer.notes,
        items: cart.map(i=>({id:i.id, name:i.name, qty:i.qty, price:i.price})),
        total: Number(total),
        payment_method: paid ? 'moyasar' : 'cod',
        payment_status: paid ? 'paid' : 'pending',
        moyasar_id: paymentId || null,
        status: paid ? 'paid' : 'pending'
      });
    }
  }catch(e){ console.warn('store_orders insert:', e.message); }
  window.open(`https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
  // clear cart
  cart = []; saveCart(); updateCartUI();
  closeCheckout();
  showToast('✓ تم إرسال تفاصيل الطلب على واتساب');
}

// ============ LIVE STORE (Supabase) ============
async function initStoreLive(){
  if(!supabaseClient){ fetchProducts(); return; }
  try{
    // 1) جلب إعدادات المتجر الحقيقية
    const { data: settings } = await supabaseClient
      .from('store_settings').select('*').limit(1).maybeSingle();
    if(settings){
      if(settings.whatsapp_number) CONFIG.WHATSAPP_NUMBER = settings.whatsapp_number;
      if(settings.store_name) CONFIG.STORE_NAME = settings.store_name;
      const wa = document.querySelector('#waContact');
      if(wa){
        wa.href = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}`;
        const num = document.querySelector('#waContactNum');
        if(num) num.textContent = '+' + CONFIG.WHATSAPP_NUMBER;
      }
    }
  }catch(e){ console.warn('store_settings:', e.message); }

  try{
    // 2) تزويد عداد الزوار +1
    await supabaseClient.from('store_analytics').insert({
      event_type: 'visit',
      page: location.pathname,
      user_agent: navigator.userAgent
    });
  }catch(e){ console.warn('store_analytics:', e.message); }

  // 3) سحب المنتجات الحقيقية المعروضة
  try{
    const { data: rows, error } = await supabaseClient
      .from('luxury_products').select('*')
      .eq('is_visible_to_elite', true)
      .order('created_at', { ascending:false });
    if(error) throw error;
    REAL_PRODUCTS = rows || [];
    renderProducts();
  }catch(e){
    console.warn('luxury_products:', e.message);
    fetchProducts();
  }
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', ()=>{
  $('#year').textContent = new Date().getFullYear();
  initHero();
  initHeader();
  initStoreLive(); // 👈 تشغيل السيرفر الحي (إعدادات + زوار + منتجات)
  updateCartUI();
  // Pay method change
  document.querySelectorAll('input[name="paymethod"]').forEach(r=>{
    r.addEventListener('change', updatePayMethodUI);
  });
  // Checkout submit
  $('#checkoutForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const c = readCustomer();
    const err = validateCustomer(c);
    if(err) return showToast(err, 'triangle-exclamation', true);
    localStorage.setItem('fi_customer', JSON.stringify(c));
    const total = cartSubtotal();
    const ref = 'AMR-' + Date.now();
    const method = selectedPayMethod();
    if(method === 'cod'){
      await saveOrder({ ref, total, paid:false, method:'cod', customer:c });
      sendWhatsApp({ ref, total, paid:false, customer:c });
      return;
    }
    // Apple Pay / Card via Moyasar
    if(!CONFIG.MOYASAR_PUBLISHABLE_KEY){
      showToast('بوابة الدفع غير مفعلة — يرجى التواصل عبر واتساب', 'triangle-exclamation', true);
      await saveOrder({ ref, total, paid:false, method:'pending', customer:c });
      sendWhatsApp({ ref, total, paid:false, customer:c });
      return;
    }
    const ok = initMoyasar(Math.round(total*100), ref, c);
    if(ok){
      showToast('املأ بيانات الدفع في النموذج أدناه', 'credit-card');
      $('#moyasar-payment-form').scrollIntoView({behavior:'smooth',block:'center'});
    }
  });
});
// expose
window.toggleCart = toggleCart;
window.addToCart = addToCart;
window.changeQty = changeQty;
window.removeItem = removeItem;
window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.openCheckout = openCheckout;
window.closeCheckout = closeCheckout;