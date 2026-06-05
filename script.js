/* =========================================================
   Amira للعطور — Frontend Logic v2.0 (UPDATED & COMPLETE)
   - Supabase products + orders
   - Moyasar Card (بدون Apple Pay)
   - WhatsApp confirmation (COD & Card)
   - SAR currency
   ========================================================= */

// ============ CONFIG ============
const DEFAULT_CONFIG = {
  SUPABASE_URL: "https://fpwipcymceuauksbdsiy.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_U16v3EtalNf4Ip--dUnyiA_3WVIGewQ",
  WHATSAPP_NUMBER: "966558787732",
  MOYASAR_PUBLISHABLE_KEY: "",
  STORE_NAME: "Amira للعطور",
  CURRENCY: "SAR"
};

function loadConfig() {
  try {
    const s = JSON.parse(localStorage.getItem('fi_settings') || '{}');
    return {
      ...DEFAULT_CONFIG,
      WHATSAPP_NUMBER: s.wa || DEFAULT_CONFIG.WHATSAPP_NUMBER,
      MOYASAR_PUBLISHABLE_KEY: s.moyasar_pk || DEFAULT_CONFIG.MOYASAR_PUBLISHABLE_KEY,
      STORE_NAME: s.name || DEFAULT_CONFIG.STORE_NAME
    };
  } catch (_) { return DEFAULT_CONFIG; }
}

let CONFIG = loadConfig();

const supabaseClient = (typeof window !== 'undefined' && window.supabase)
  ? supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY)
  : null;

const FALLBACK_PRODUCTS = [];
let REAL_PRODUCTS = [];
let cart = [];

// Safe cart load with validation
try {
  const raw = localStorage.getItem('fi_cart');
  if (raw) {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      cart = parsed.filter(i =>
        i && typeof i.id !== 'undefined' &&
        typeof i.price === 'number' &&
        typeof i.qty === 'number' && i.qty > 0
      );
    }
  }
} catch (_) { cart = []; }

// ============ HELPERS ============
const $ = (s, p = document) => p.querySelector(s);
const fmt = n => Number(n || 0).toFixed(2);
const saveCart = () => {
  try { localStorage.setItem('fi_cart', JSON.stringify(cart)); } catch (_) {}
};

// Safe text setter — prevents XSS from product data
function safeText(el, text) {
  if (el) el.textContent = String(text || '');
}

function showToast(msg, icon = 'circle-check', isErr = false) {
  const t = $('#toast');
  if (!t) return;
  t.innerHTML = `<i class="fa-solid fa-${escHtml(icon)}"></i> `;
  t.appendChild(document.createTextNode(msg));
  t.classList.toggle('err', isErr);
  t.classList.add('show');
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(() => t.classList.remove('show'), 2800);
}

function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
  );
}

function starsHTML(r) {
  const rating = Math.min(5, Math.max(0, Number(r) || 4.7));
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  let html = '';
  for (let i = 0; i < 5; i++) {
    if (i < full) html += '<i class="fa-solid fa-star"></i>';
    else if (i === full && half) html += '<i class="fa-solid fa-star-half-stroke"></i>';
    else html += '<i class="fa-solid fa-star off"></i>';
  }
  return `<span class="stars" aria-label="${rating.toFixed(1)} من 5">${html}</span><span>(${rating.toFixed(1)})</span>`;
}

// ============ HERO ============
function initHero() {
  const slides = document.querySelectorAll('.slide');
  const dotsBox = $('#heroDots');
  if (!slides.length || !dotsBox) return;
  dotsBox.innerHTML = '';
  slides.forEach((_, i) => {
    const b = document.createElement('button');
    b.setAttribute('aria-label', 'الشريحة ' + (i + 1));
    b.setAttribute('role', 'tab');
    if (i === 0) b.classList.add('active');
    b.onclick = () => goSlide(i);
    dotsBox.appendChild(b);
  });
  let idx = 0;
  let autoTimer;
  function goSlide(n) {
    slides[idx].classList.remove('active');
    dotsBox.children[idx].classList.remove('active');
    idx = (n + slides.length) % slides.length;
    slides[idx].classList.add('active');
    dotsBox.children[idx].classList.add('active');
  }
  function startAuto() {
    autoTimer = setInterval(() => goSlide(idx + 1), 6000);
  }
  dotsBox.addEventListener('click', () => {
    clearInterval(autoTimer);
    setTimeout(startAuto, 10000);
  });
  startAuto();
}

// ============ HEADER ============
function initHeader() {
  const header = $('#mainHeader');
  if (!header) return;
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 30);
  }, { passive: true });

  const burger = $('#burger');
  const nav = document.querySelector('.main-nav');
  if (burger && nav) {
    burger.addEventListener('click', () => {
      const isOpen = burger.classList.toggle('open');
      nav.classList.toggle('open', isOpen);
      burger.setAttribute('aria-expanded', isOpen);
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      burger.classList.remove('open');
      nav.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
    }));
  }

  const wa = $('#waContact');
  if (wa) {
    wa.href = `https://wa.me/${encodeURIComponent(CONFIG.WHATSAPP_NUMBER)}`;
    const num = $('#waContactNum');
    if (num) num.textContent = '+' + CONFIG.WHATSAPP_NUMBER;
  }
}

// ============ PRODUCTS ============
async function fetchProducts() {
  let data = null;
  try {
    if (supabaseClient) {
      const { data: rows, error } = await supabaseClient
        .from('luxury_products').select('*')
        .eq('is_visible_to_elite', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      data = rows;
    }
  } catch (e) { console.warn('Supabase unavailable, using fallback:', e.message); }
  REAL_PRODUCTS = (data && data.length) ? data : FALLBACK_PRODUCTS;
  renderProducts();
}

function renderProducts() {
  const c = $('#products-container');
  if (!c) return;
  if (!REAL_PRODUCTS.length) {
    c.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--muted);padding:40px">لا توجد منتجات حالياً.</p>`;
    return;
  }
  c.innerHTML = REAL_PRODUCTS.map((p, i) => {
    const price = fmt(p.price_aqsa);
    const oldPrice = p.discounted_price && Number(p.discounted_price) > 0 ? fmt(p.price_aqsa) : null;
    const displayPrice = p.discounted_price && Number(p.discounted_price) > 0 ? fmt(p.discounted_price) : price;
    const rating = Math.min(5, Math.max(0, Number(p.rating) || 4.7));
    const img = escHtml(p.supreme_image_url || 'https://via.placeholder.com/600x600?text=Perfume');
    const name = escHtml(p.product_name_ar || '');
    const desc = escHtml(p.exquisite_description || 'عطر فاخر ومميز.');
    const discount = oldPrice && p.discounted_price
      ? Math.round((1 - p.discounted_price / p.price_aqsa) * 100)
      : 0;
    return `
      <article class="product-card" style="animation-delay:${i * 60}ms" role="listitem">
        <div class="product-img-wrap">
          ${p.is_new ? '<span class="product-badge">جديد</span>' : ''}
          ${discount > 0 ? `<span class="product-badge" style="inset-inline-start:auto;inset-inline-end:12px;background:linear-gradient(135deg,#27ae60,#1a8a4a)">-${discount}%</span>` : ''}
          <img src="${img}" alt="${name}" loading="lazy" width="300" height="315">
        </div>
        <div class="product-body">
          <h3>${name}</h3>
          <div class="rating">${starsHTML(rating)}</div>
          <p class="product-desc">${desc}</p>
          <div class="price-row">
            <span class="price">${displayPrice}<small> SAR</small></span>
            ${oldPrice ? `<span class="price-old">${oldPrice} SAR</span>` : ''}
            ${discount > 0 ? `<span class="price-badge">خصم ${discount}%</span>` : ''}
          </div>
        </div>
        <div class="product-actions">
          <button class="btn-add" onclick="addToCart('${escHtml(String(p.id))}')">
            <i class="fa-solid fa-bag-shopping" aria-hidden="true"></i> إضافة للحقيبة
          </button>
          <button class="btn-view" onclick="openProductModal('${escHtml(String(p.id))}')" aria-label="عرض تفاصيل ${name}">
            <i class="fa-solid fa-eye" aria-hidden="true"></i>
          </button>
        </div>
      </article>`;
  }).join('');
}

function openProductModal(id) {
  const p = REAL_PRODUCTS.find(x => String(x.id) === String(id));
  if (!p) return;
  const displayPrice = p.discounted_price && Number(p.discounted_price) > 0 ? fmt(p.discounted_price) : fmt(p.price_aqsa);
  const rating = Math.min(5, Math.max(0, Number(p.rating) || 4.7));
  const imgUrl = escHtml(p.supreme_image_url || '');
  const name = escHtml(p.product_name_ar || '');
  const desc = escHtml(p.exquisite_description || 'عطر فاخر ومميز.');
  const pid = escHtml(String(p.id));

  $('#productModalBody').innerHTML = `
    <button class="modal-close" onclick="closeProductModal()" aria-label="إغلاق">
      <i class="fa-solid fa-xmark" aria-hidden="true"></i>
    </button>
    <div class="modal-grid">
      <div class="modal-img" style="background-image:url('${imgUrl}')" role="img" aria-label="${name}"></div>
      <div class="modal-info">
        <span class="kicker">مجموعة حصرية</span>
        <h2>${name}</h2>
        <div class="rating">${starsHTML(rating)}</div>
        <p class="desc">${desc}</p>
        <div class="price-row" style="margin-bottom:24px">
          <span class="price">${displayPrice}<small> SAR</small></span>
          ${p.discounted_price && Number(p.discounted_price) > 0 ? `<span class="price-old">${fmt(p.price_aqsa)} SAR</span>` : ''}
        </div>
        <button class="btn btn-gold" style="width:100%" onclick="addToCart('${pid}');closeProductModal()">
          <i class="fa-solid fa-bag-shopping" aria-hidden="true"></i> إضافة للحقيبة
        </button>
      </div>
    </div>`;
  const modal = $('#productModal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeProductModal() {
  const modal = $('#productModal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  if (!$('#cartSidebar').classList.contains('open')) document.body.style.overflow = '';
}

// ============ CART ============
function toggleCart() {
  const sidebar = $('#cartSidebar');
  const backdrop = $('#cartBackdrop');
  const open = sidebar.classList.toggle('open');
  backdrop.classList.toggle('open', open);
  sidebar.setAttribute('aria-hidden', !open);
  document.body.style.overflow = open ? 'hidden' : '';
}

function addToCart(id) {
  const p = REAL_PRODUCTS.find(x => String(x.id) === String(id));
  if (!p) return;

  const hasDiscount = p.discounted_price && Number(p.discounted_price) > 0;
  const price = hasDiscount ? Number(p.discounted_price) : Number(p.price_aqsa);

  const existing = cart.find(c => String(c.id) === String(id));
  if (existing) {
    existing.qty = Math.min(existing.qty + 1, 99);
  } else {
    cart.push({
      id: p.id,
      name: p.product_name_ar,
      price: price,
      img: p.supreme_image_url,
      qty: 1
    });
  }
  saveCart();
  updateCartUI();
  showToast(`تمت إضافة "${p.product_name_ar}" للحقيبة`);
}

function changeQty(id, delta) {
  const item = cart.find(c => String(c.id) === String(id));
  if (!item) return;
  item.qty = Math.max(0, item.qty + delta);
  if (item.qty <= 0) cart = cart.filter(c => String(c.id) !== String(id));
  saveCart();
  updateCartUI();
}

function removeItem(id) {
  cart = cart.filter(c => String(c.id) !== String(id));
  saveCart();
  updateCartUI();
}

function cartSubtotal() { return cart.reduce((s, i) => s + i.price * i.qty, 0); }

function updateCartUI() {
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const countEl = $('#cart-count');
  if (countEl) countEl.textContent = count;

  const box = $('#cartItems');
  const footer = $('#cartFooter');
  if (!box) return;

  if (!cart.length) {
    box.innerHTML = `<div class="empty-cart">
      <i class="fa-solid fa-bag-shopping" aria-hidden="true"></i>
      <p>الحقيبة فارغة</p>
      <span>أضف عطورك المفضلة وابدأ التسوق</span>
    </div>`;
    if (footer) footer.hidden = true;
    return;
  }

  box.innerHTML = cart.map(i => `
    <div class="cart-item">
      <img src="${escHtml(i.img || 'https://via.placeholder.com/80')}" alt="${escHtml(i.name)}" width="70" height="70" loading="lazy">
      <div class="ci-body">
        <h4>${escHtml(i.name)}</h4>
        <div class="ci-price">${fmt(i.price)} SAR</div>
        <div class="qty-row">
          <div class="qty" role="group" aria-label="الكمية">
            <button onclick="changeQty('${escHtml(String(i.id))}',-1)" aria-label="تقليل الكمية">−</button>
            <span aria-live="polite">${i.qty}</span>
            <button onclick="changeQty('${escHtml(String(i.id))}',1)" aria-label="زيادة الكمية">+</button>
          </div>
          <button class="remove-btn" onclick="removeItem('${escHtml(String(i.id))}')" aria-label="حذف ${escHtml(i.name)}">
            <i class="fa-solid fa-trash" aria-hidden="true"></i> حذف
          </button>
        </div>
      </div>
    </div>`).join('');

  const totalEl = $('#cart-total');
  if (totalEl) totalEl.textContent = fmt(cartSubtotal());
  if (footer) footer.hidden = false;
}

// ============ CHECKOUT ============
function openCheckout() {
  if (!cart.length) return showToast('الحقيبة فارغة!', 'circle-exclamation', true);
  try {
    const saved = JSON.parse(localStorage.getItem('fi_customer') || '{}');
    ['name','phone','region','district','street','floor','postal','notes'].forEach(k => {
      const el = document.getElementById('c_' + k);
      if (el && saved[k]) el.value = saved[k];
    });
  } catch (_) {}
  const countEl = $('#co-count');
  const totalEl = $('#co-total');
  if (countEl) countEl.textContent = cart.reduce((s, i) => s + i.qty, 0);
  if (totalEl) totalEl.textContent = fmt(cartSubtotal());
  const modal = $('#checkoutModal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  updatePayMethodUI();
}

function closeCheckout() {
  const modal = $('#checkoutModal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function readCustomer() {
  return {
    name:     (document.getElementById('c_name')?.value || '').trim(),
    phone:    (document.getElementById('c_phone')?.value || '').trim(),
    region:   (document.getElementById('c_region')?.value || ''),
    district: (document.getElementById('c_district')?.value || '').trim(),
    street:   (document.getElementById('c_street')?.value || '').trim(),
    floor:    (document.getElementById('c_floor')?.value || '').trim(),
    postal:   (document.getElementById('c_postal')?.value || '').trim(),
    notes:    (document.getElementById('c_notes')?.value || '').trim()
  };
}

function validateCustomer(c) {
  if (!c.name || c.name.length < 3) return 'يرجى إدخال الاسم الكامل (3 أحرف على الأقل)';
  if (!/^(05|5|9665|\+9665)[0-9]{8}$/.test(c.phone.replace(/\s/g, '')))
    return 'رقم الجوال غير صحيح (مثال: 05XXXXXXXX)';
  if (!c.region) return 'يرجى اختيار المنطقة';
  if (!c.street || c.street.length < 3) return 'يرجى إدخال العنوان التفصيلي';
  return null;
}

function selectedPayMethod() {
  return 'cod';
}

function updatePayMethodUI() {
  const lbl = $('#submitLabel');
  if (lbl) {
    lbl.textContent = 'تأكيد الطلب — الدفع عند الاستلام';
  }
}

// ============ MOYASAR ============
function initMoyasar(amountHalalas, orderRef, customer) {
  if (!window.Moyasar) {
    showToast('فشل تحميل بوابة الدفع، يرجى المحاولة لاحقاً', 'circle-xmark', true);
    return false;
  }
  if (!CONFIG.MOYASAR_PUBLISHABLE_KEY) {
    showToast('بوابة الدفع غير مفعلة — اختر الدفع عند الاستلام', 'triangle-exclamation', true);
    return false;
  }
  const mf = $('#moyasar-payment-form');
  if (mf) mf.innerHTML = '';

  Moyasar.init({
    element: '#moyasar-payment-form',
    amount: amountHalalas,
    currency: 'SAR',
    description: `${escHtml(CONFIG.STORE_NAME)} — ${escHtml(orderRef)}`,
    publishable_api_key: CONFIG.MOYASAR_PUBLISHABLE_KEY,
    callback_url: window.location.origin + window.location.pathname + '?order=' + encodeURIComponent(orderRef),
    methods: ['creditcard', 'stcpay'],
    metadata: {
      order_ref: orderRef,
      customer_name: customer.name,
      customer_phone: customer.phone,
      customer_address: [customer.region, customer.district, customer.street, customer.floor].filter(Boolean).join(' - ')
    },
    on_completed: function (payment) {
      return saveOrder({
        ref: orderRef,
        total: amountHalalas / 100,
        paid: true,
        method: 'card',
        moyasar_id: payment.id,
        customer
      }).then(() => {
        sendWhatsApp({ ref: orderRef, total: amountHalalas / 100, paid: true, customer, paymentId: payment.id });
      });
    }
  });
  return true;
}

// ============ SAVE ORDER ============
async function saveOrder({ ref, total, paid, method, moyasar_id, customer }) {
  const supabasePayload = {
    id: ref,
    client_name: customer.name,
    client_whatsapp: customer.phone,
    client_phone: customer.phone,
    client_city: customer.region || '',
    client_district: customer.district || '',
    client_floor_details: [
      customer.street ? `شارع: ${customer.street}` : null,
      customer.floor ? `دور: ${customer.floor}` : null,
      customer.postal ? `بريد: ${customer.postal}` : null
    ].filter(Boolean).join(' | '),
    payment_method: method,
    payment_status: paid ? 'paid' : 'pending',
    order_status: paid ? 'paid' : 'pending',
    total_amount: Number(total),
    order_items: cart.map(i => ({ id: i.id, name: i.name, qty: i.qty, price: i.price }))
  };

  try {
    if (supabaseClient) {
      const { error } = await supabaseClient.from('luxury_orders').insert(supabasePayload);
      if (error) console.warn('Supabase insert failed:', error.message);
    }
  } catch (e) { console.warn(e); }

  try {
    const orders = JSON.parse(localStorage.getItem('fi_orders') || '[]');
    orders.unshift({
      id: ref,
      created_at: new Date().toISOString(),
      ...supabasePayload,
      customer_notes: customer.notes
    });
    localStorage.setItem('fi_orders', JSON.stringify(orders.slice(0, 500)));
  } catch (_) {}
}
// ============ WHATSAPP ============
async function sendWhatsApp({ ref, total, paid, customer, paymentId }) {
  // 1. تجميع المنتجات بشكل مرتب ومنسق
  const items = cart.map((it, i) =>
    `  ${i + 1}. *${it.name}* × ${it.qty} = ${fmt(it.price * it.qty)} SAR`
  ).join('\n');

  // 2. تنسيق العنوان بدقة
  const addr = [
    `المنطقة: ${customer.region}`,
    customer.district ? `الحي: ${customer.district}` : null,
    `العنوان: ${customer.street}`,
    customer.floor ? `الدور/الشقة: ${customer.floor}` : null,
    customer.postal ? `الرمز البريدي: ${customer.postal}` : null,
    customer.notes ? `ملاحظات: ${customer.notes}` : null
  ].filter(Boolean).join('\n');

  // 3. تحديد نوع الدفع (مدى، فيزا، أو Apple Pay بناءً على بوابة ميسر)
  const payLabel = paid
    ? `✅ مدفوع بالكامل إلكترونياً عبر Moyasar${paymentId ? `\nرقم عملية ميسر: (#${paymentId})` : ''}`
    : '🟡 الدفع عند الاستلام (COD)';

  // 4. بناء نص الرسالة الفاخرة المرتبة جداً
  const msg =
`*طلب جديد فاخر — ${CONFIG.STORE_NAME}* 💎
رقم الطلب الفريد: *${ref}*
----------------------------------

👤 *بيانات العميل الملكية:*
الاسم: ${customer.name}
الجوال: ${customer.phone}
${addr}

🛍️ *تفاصيل السلة العطرية:*
${items}

----------------------------------
💰 *الإجمالي النهائي:* *${fmt(total)} SAR*
💳 *حالة وطريقة الدفع:* ${payLabel}

*يرجى ترك هذه الرسالة كما هي لإتمام الشحن الفوري السريع لطلبكم* 🚀
شكراً لاختياركم ${CONFIG.STORE_NAME} 🌹`;

  // 5. حفظ البيانات في Supabase أولاً لتأمين الطلب في قاعدة البيانات
  try {
    if (supabaseClient) {
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
        items: cart.map(i => ({ id: i.id, name: i.name, qty: i.qty, price: i.price })),
        total: Number(total),
        payment_method: paid ? 'card' : 'cod',
        payment_status: paid ? 'paid' : 'pending',
        moyasar_id: paymentId || null,
        status: paid ? 'paid' : 'pending'
      });
    }
  } catch (e) { 
    console.warn('خطأ أثناء الحفظ في Supabase:', e.message); 
  }

  // 6. تجهيز الرابط المباشر للواتساب
  const whatsappUrl = `https://wa.me/${CONFIG.WHATSAPP_NUMBER.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`;

  // 7. فتح الواتساب فوراً (قبل مسح داتا السلة لضمان عدم حدوث تعليق)
  const whatsappWindow = window.open(whatsappUrl, '_blank');
  
  // حل أمان إضافي إذا قام المتصفح بحظر فتح النافذة تلقائياً
  if (!whatsappWindow || whatsappWindow.closed || typeof whatsappWindow.closed == 'undefined') {
    // إذا تم حظره كـ Popup، نقوم بالتحويل في نفس الصفحة كحل بديل آمن لتجنب ضياع الطلب
    window.location.href = whatsappUrl;
    return; // نوقف الدالة هنا لأن الصفحة ستقوم بالتحويل، وسيتم تفريغ السلة عند العودة أو الاعتماد على تحديث الصفحة
  }

  // 8. الآن، بعد الاطمئنان أن الرابط فتح بنجاح، نقوم بتفريغ السلة وتحديث الواجهة للعميل
  setTimeout(() => {
    cart = [];
    saveCart();
    updateCartUI();
    closeCheckout();
    showToast('✓ تم تأكيد الطلب وفتح واتساب لإرسال التفاصيل الفاخرة');
  }, 300); // تأخير بسيط جداً (300 مللي ثانية) لضمان استقرار عملية الفتح
}

// ============ LIVE STORE (Supabase) ============
async function initStoreLive() {
  if (!supabaseClient) { fetchProducts(); return; }

  try {
    const { data: settings } = await supabaseClient
      .from('store_settings').select('*').limit(1).maybeSingle();
    if (settings) {
      if (settings.whatsapp_number) CONFIG.WHATSAPP_NUMBER = settings.whatsapp_number;
      if (settings.store_name) CONFIG.STORE_NAME = settings.store_name;
      const wa = document.querySelector('#waContact');
      if (wa) wa.href = `https://wa.me/${encodeURIComponent(CONFIG.WHATSAPP_NUMBER)}`;
      const num = document.querySelector('#waContactNum');
      if (num) num.textContent = '+' + CONFIG.WHATSAPP_NUMBER;
    }
  } catch (e) { console.warn('store_settings:', e.message); }

  try {
    await supabaseClient.from('store_analytics').insert({
      event_type: 'visit',
      page: location.pathname,
      user_agent: navigator.userAgent
    });
  } catch (e) { console.warn('store_analytics:', e.message); }

  try {
    const { data: rows, error } = await supabaseClient
      .from('luxury_products').select('*')
      .eq('is_visible_to_elite', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    REAL_PRODUCTS = rows || [];
    renderProducts();
  } catch (e) {
    console.warn('luxury_products:', e.message);
    fetchProducts();
  }
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  initHero();
  initHeader();
  initStoreLive();
  updateCartUI();

  document.querySelectorAll('input[name="paymethod"]').forEach(r => {
    r.addEventListener('change', updatePayMethodUI);
  });

  const form = $('#checkoutForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('#checkoutSubmit');
      if (btn) { btn.disabled = true; btn.style.opacity = '.7'; }

      try {
        const c = readCustomer();
        const err = validateCustomer(c);
        if (err) {
          showToast(err, 'triangle-exclamation', true);
          return;
        }
        localStorage.setItem('fi_customer', JSON.stringify(c));
        const total = cartSubtotal();
        const ref = 'AMR-' + Date.now();
        const method = selectedPayMethod();

        if (method === 'cod') {
          await saveOrder({ ref, total, paid: false, method: 'cod', customer: c });
          sendWhatsApp({ ref, total, paid: false, customer: c });
          return;
        }

        if (!CONFIG.MOYASAR_PUBLISHABLE_KEY) {
          showToast('بوابة الدفع غير مفعلة — اختر الدفع عند الاستلام', 'triangle-exclamation', true);
          await saveOrder({ ref, total, paid: false, method: 'pending', customer: c });
          sendWhatsApp({ ref, total, paid: false, customer: c });
          return;
        }
        const ok = initMoyasar(Math.round(total * 100), ref, c);
        if (ok) {
          showToast('أدخل بيانات البطاقة في النموذج أدناه', 'credit-card');
          $('#moyasar-payment-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } finally {
        if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
      }
    });
  }
});

// Expose globals
window.toggleCart       = toggleCart;
window.addToCart        = addToCart;
window.changeQty        = changeQty;
window.removeItem       = removeItem;
window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.openCheckout     = openCheckout;
window.closeCheckout    = closeCheckout;
