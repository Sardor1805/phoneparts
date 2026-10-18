
/* =========================================================
   PHONEPARTS — ADMIN PANEL
   Supabase bilan ishlaydigan admin.js
   ========================================================= */

// 1. SUPABASE SOZLAMALARI
const SUPABASE_URL = "https://tvbguhyuwkcozmuntcss.supabase.co";
const SUPABASE_KEY = "sb_publishable_4gzBrF4DL7hvyllfyC80Eg_6uLaZO37";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// 2. KATEGORIYALAR
const categoryNames = {
  screens: "Ekranlar",
  batteries: "Batareyalar",
  "back-covers": "Orqa korpuslar",
  glass: "Ekran oynalari",
  other: "Boshqa ehtiyot qismlar"
};

const categoryIds = Object.fromEntries(
  Object.entries(categoryNames).map(([id, name]) => [name, id])
);

// 3. MA'LUMOTLAR
let adminProducts = [];
let brands = [];
let orders = [];
let customers = [];

const statuses = [
  "Yangi",
  "Tasdiqlangan",
  "Yuborilgan",
  "Yakunlangan",
  "Bekor qilingan"
];

let nextId = 1;
let stockEntryProductId = null;

const $ = (selector) => document.querySelector(selector);

const fmt = (value) =>
  new Intl.NumberFormat("uz-UZ").format(Number(value) || 0) + " so'm";

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function toast(message, type = "success") {
  const el = $("#adminToast");
  if (!el) {
    console.log(message);
    return;
  }

  el.textContent = message;
  el.className = "admin-toast show " + type;

  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    el.classList.remove("show");
  }, 3500);
}

function showError(error, prefix = "Xatolik") {
  console.error(prefix, error);
  toast(`${prefix}: ${error?.message || error}`, "error");
}

function categoryId(value) {
  if (categoryIds[value]) return categoryIds[value];
  if (categoryNames[value]) return value;
  return value || "other";
}

function categoryLabel(value) {
  return categoryNames[value] || value || "Boshqa ehtiyot qismlar";
}

// 4. SUPABASE'DAN MAHSULOTLARNI YUKLASH
async function loadAdminProducts() {
  const { data, error } = await supabaseClient
    .from("products")
    .select(`
      *,
      product_compatibility (
        phone_models (
          name,
          brands (
            name
          )
        )
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    showError(error, "Mahsulotlarni yuklab bo'lmadi");
    return;
  }

  adminProducts = (data || []).map((p) => {
    const compatibleModels = (p.product_compatibility || [])
      .map((item) => item.phone_models)
      .filter(Boolean);

    const modelNames = compatibleModels.map((m) => m.name);
    const brandNames = [
      ...new Set(
        compatibleModels
          .map((m) => m.brands?.name)
          .filter(Boolean)
      )
    ];

    return {
      id: p.id,
      name: p.name || "",
      category: categoryLabel(p.category),
      categoryId: p.category,
      internalCode: p.internal_code || "",
      brand: brandNames.join(", "),
      models: modelNames,
      price: Number(p.price) || 0,
      cost: Number(p.cost_price) || 0,
      stock: Number(p.stock) || 0,
      status: p.is_active ? "Faol" : "Yashirin",
      hidden: !p.is_active,
      image: p.image_url || "",
      description: p.description || "",
      createdAt: p.created_at
    };
  });

  nextId = Math.max(
    1,
    ...adminProducts.map((p) => Number(p.id) || 0)
  ) + 1;

  renderAdminProducts();
  renderStock();
  refreshStockProductOptions();
}

// 5. BRЕNDLAR VA MODELLARNI YUKLASH
async function loadBrands() {
  const { data: brandData, error: brandError } = await supabaseClient
    .from("brands")
    .select("id, name")
    .order("name");

  if (brandError) {
    showError(brandError, "Brendlarni yuklashda xatolik");
    return;
  }

  const { data: modelData, error: modelError } = await supabaseClient
    .from("phone_models")
    .select("id, name, brand_id")
    .order("name");

  if (modelError) {
    showError(modelError, "Modellarni yuklashda xatolik");
    return;
  }

  brands = (brandData || []).map((brand) => ({
    id: brand.id,
    name: brand.name,
    models: (modelData || [])
      .filter((model) => model.brand_id === brand.id)
      .map((model) => model.name)
  }));

  renderBrands();
}

// 6. MAHSULOTLAR RO'YXATI
function renderAdminProducts() {
  const tbody = $("#adminProductRows");
  if (!tbody) return;

  const search = ($("#productSearch")?.value || "").toLowerCase().trim();
  const selectedCategory = $("#productCategory")?.value || "";
  const selectedState = $("#productState")?.value || "";

  const filtered = adminProducts.filter((p) => {
    const searchText = [
      p.name,
      p.internalCode,
      p.brand,
      p.models.join(" ")
    ].join(" ").toLowerCase();

    const matchesSearch = !search || searchText.includes(search);
    const matchesCategory =
      !selectedCategory ||
      p.categoryId === selectedCategory ||
      p.category === selectedCategory;
    const matchesState =
      !selectedState ||
      (selectedState === "Faol" && !p.hidden) ||
      (selectedState === "Yashirin" && p.hidden) ||
      p.status === selectedState;

    return matchesSearch && matchesCategory && matchesState;
  });

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align:center;padding:24px">
          Mahsulot topilmadi
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((p) => `
    <tr>
      <td>${escapeHTML(p.id)}</td>
      <td>
        <strong>${escapeHTML(p.name)}</strong>
        <div class="muted">${escapeHTML(p.internalCode)}</div>
      </td>
      <td>${escapeHTML(p.category)}</td>
      <td>${escapeHTML(p.brand || "—")}</td>
      <td>${escapeHTML(p.models.join(", ") || "—")}</td>
      <td>${fmt(p.price)}</td>
      <td>${fmt(p.cost)}</td>
      <td>${p.stock}</td>
      <td>
        <span class="${p.hidden ? "status-hidden" : "status-active"}">
          ${p.hidden ? "Yashirin" : "Faol"}
        </span>
      </td>
      <td>
        <button type="button" data-edit-product="${p.id}">Tahrirlash</button>
        <button type="button" data-toggle-product="${p.id}">
          ${p.hidden ? "Faollashtirish" : "Yashirish"}
        </button>
      </td>
    </tr>
  `).join("");
}

// 7. BRЕNDLAR RO'YXATI
function renderBrands() {
  const container = $("#brandAdminGrid");
  if (!container) return;

  if (!brands.length) {
    container.innerHTML = "<p>Hozircha brendlar mavjud emas.</p>";
    return;
  }

  container.innerHTML = brands.map((b) => `
    <div class="brand-card">
      <strong>${escapeHTML(b.name)}</strong>
      <p>${b.models.length} ta model</p>
      <div>${escapeHTML(b.models.join(", ") || "Modellar kiritilmagan")}</div>
      <button type="button" data-edit-brand="${b.id}">Tahrirlash</button>
    </div>
  `).join("");
}

// 8. BUYURTMALAR
// Buyurtma yaratish va ruxsatlarni keyinchalik xavfsiz backend orqali
// ulash kerak. Bu funksiya mavjud buyurtmalarni Supabase'dan o'qiydi.
async function loadOrders() {
  const { data, error } = await supabaseClient
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    showError(error, "Buyurtmalarni yuklashda xatolik");
    return;
  }

  orders = (data || []).map((o) => ({
    id: o.id,
    orderNumber: o.order_number || o.id,
    customer: o.customer_name || "",
    phone: o.phone || "",
    address: o.address || "",
    status: mapOrderStatus(o.status),
    total: Number(o.total) || 0,
    createdAt: o.created_at
  }));

  renderOrders();
}

function mapOrderStatus(value) {
  const map = {
    new: "Yangi",
    confirmed: "Tasdiqlangan",
    shipped: "Yuborilgan",
    completed: "Yakunlangan",
    cancelled: "Bekor qilingan"
  };
  return map[value] || value || "Yangi";
}

function dbOrderStatus(value) {
  const map = {
    "Yangi": "new",
    "Tasdiqlangan": "confirmed",
    "Yuborilgan": "shipped",
    "Yakunlangan": "completed",
    "Bekor qilingan": "cancelled"
  };
  return map[value] || value;
}

function renderOrders() {
  const tbody = $("#orderRows");
  if (!tbody) return;

  const search = ($("#orderSearch")?.value || "").toLowerCase().trim();
  const filter = $("#orderFilter")?.value || "";

  const filtered = orders.filter((o) => {
    const text = [
      o.orderNumber,
      o.customer,
      o.phone
    ].join(" ").toLowerCase();

    return (!search || text.includes(search)) &&
      (!filter || o.status === filter);
  });

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr><td colspan="8" style="text-align:center;padding:24px">
        Buyurtmalar topilmadi
      </td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((o) => `
    <tr>
      <td>${escapeHTML(o.orderNumber)}</td>
      <td>${escapeHTML(o.customer)}</td>
      <td>${escapeHTML(o.phone)}</td>
      <td>${escapeHTML(o.address)}</td>
      <td>${fmt(o.total)}</td>
      <td>
        <select data-order-status="${o.id}">
          ${statuses.map((s) => `
            <option value="${escapeHTML(s)}"
              ${s === o.status ? "selected" : ""}>
              ${escapeHTML(s)}
            </option>
          `).join("")}
        </select>
      </td>
      <td>${o.createdAt ? new Date(o.createdAt).toLocaleDateString("uz-UZ") : "—"}</td>
    </tr>
  `).join("");
}

async function updateOrderStatus(id, status) {
  const { error } = await supabaseClient
    .from("orders")
    .update({ status: dbOrderStatus(status) })
    .eq("id", id);

  if (error) {
    showError(error, "Buyurtma holatini o'zgartirib bo'lmadi");
    await loadOrders();
    return;
  }

  toast("Buyurtma holati saqlandi");
  await loadOrders();
}

// 9. MIJOZLAR
// profiles jadvali hozir faqat user_id va role saqlaydi.
// Telefon va ism orders jadvalidan olinadi.
async function loadCustomers() {
  const tbody = $("#customerRows");
  if (!tbody) return;

  const { data, error } = await supabaseClient
    .from("orders")
    .select("customer_name, phone, address, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    showError(error, "Mijozlarni yuklashda xatolik");
    return;
  }

  const unique = new Map();

  (data || []).forEach((o) => {
    const key = o.phone || o.customer_name;
    if (key && !unique.has(key)) unique.set(key, o);
  });

  customers = Array.from(unique.values());

  renderCustomers();
}

function renderCustomers() {
  const tbody = $("#customerRows");
  if (!tbody) return;

  const search = ($("#customerSearch")?.value || "").toLowerCase().trim();
  const filtered = customers.filter((c) =>
    [c.customer_name, c.phone, c.address]
      .join(" ").toLowerCase().includes(search)
  );

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr><td colspan="5" style="text-align:center;padding:24px">
        Mijozlar topilmadi
      </td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((c) => `
    <tr>
      <td>${escapeHTML(c.customer_name || "—")}</td>
      <td>${escapeHTML(c.phone || "—")}</td>
      <td>${escapeHTML(c.address || "—")}</td>
      <td>${c.created_at ? new Date(c.created_at).toLocaleDateString("uz-UZ") : "—"}</td>
    </tr>
  `).join("");
}

// 10. OMBOR
function renderStock() {
  const tbody = $("#stockRows");
  if (!tbody) return;

  if (!adminProducts.length) {
    tbody.innerHTML = `
      <tr><td colspan="6" style="text-align:center;padding:24px">
        Omborda mahsulot yo'q
      </td></tr>`;
    return;
  }

  tbody.innerHTML = adminProducts.map((p) => `
    <tr>
      <td>${escapeHTML(p.name)}</td>
      <td>${escapeHTML(p.internalCode)}</td>
      <td>${p.stock}</td>
      <td>${fmt(p.cost)}</td>
      <td>${fmt(p.price)}</td>
      <td>
        <button type="button" data-stock-product="${p.id}">
          Kirim qilish
        </button>
      </td>
    </tr>
  `).join("");
}

function refreshStockProductOptions() {
  const select = $("#stockProduct");
  if (!select) return;

  select.innerHTML = `
    <option value="">Mahsulotni tanlang</option>
    ${adminProducts.map((p) => `
      <option value="${p.id}">
        ${escapeHTML(p.name)} — ${escapeHTML(p.internalCode)}
      </option>
    `).join("")}
  `;
}

// 11. MODAL OCHISH VA YOPISH

 // 11. MODAL OCHISH VA YOPISH
function openForm(title, body, onSave) {
  const backdrop = $("#formBackdrop");
  const content = $("#formContent");

  if (!backdrop || !content) {
    toast("Forma elementlari HTML'da topilmadi", "error");
    return;
  }

  content.innerHTML = `
    <div class="form-header">
      <h2>${escapeHTML(title)}</h2>
      <button type="button" id="modalCloseBtn">✕</button>
    </div>
    <form id="adminDynamicForm">
      ${body}
      <div class="form-actions">
        <button type="button" id="cancelDynamicForm">Bekor qilish</button>
        <button type="submit">Saqlash</button>
      </div>
    </form>
  `;

  // Modal oynani ko'rsatish
  backdrop.classList.remove("hidden");
  backdrop.classList.add("open");
  backdrop.style.display = "flex";

  const close = () => {
    backdrop.classList.remove("open");
    backdrop.classList.add("hidden");
    backdrop.style.display = "none";
  };

  $("#modalCloseBtn")?.addEventListener("click", close);
  $("#cancelDynamicForm")?.addEventListener("click", close);

  // Oynaning tashqi qismini bosganda yopish
  backdrop.onclick = (event) => {
    if (event.target === backdrop) {
      close();
    }
  };

  // Formani saqlash
  $("#adminDynamicForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submit = event.submitter;
    if (submit) submit.disabled = true;

    try {
      const formData = new FormData(event.currentTarget);
      await onSave(formData);
      close();
    } catch (error) {
      showError(error, "Saqlashda xatolik");
    } finally {
      if (submit) submit.disabled = false;
    }
  });
}


function closeForm() {
  const backdrop = $("#formBackdrop");
  if (!backdrop) return;
  backdrop.classList.remove("open");
  backdrop.style.display = "none";
}

$("#closeForm")?.addEventListener("click", closeForm);
$("#formBackdrop")?.addEventListener("click", (event) => {
  if (event.target === $("#formBackdrop")) closeForm();
});

// 12. MAHSULOT FORMASI
function productForm(p = null) {
  const isEdit = Boolean(p);

  const categoryOptions = Object.entries(categoryNames).map(([id, name]) => `
    <option value="${id}" ${
      categoryId(p?.categoryId || p?.category) === id ? "selected" : ""
    }>${escapeHTML(name)}</option>
  `).join("");

  const brandOptions = brands.map((b) => `
    <option value="${escapeHTML(b.name)}"
      ${p?.brand === b.name ? "selected" : ""}>
      ${escapeHTML(b.name)}
    </option>
  `).join("");

  openForm(isEdit ? "Mahsulotni tahrirlash" : "Yangi mahsulot", `
    <label>Kategoriya</label>
    <select name="category" required>${categoryOptions}</select>

    <label>Brend</label>
    <select name="brand">
      <option value="">Brend tanlanmagan</option>
      ${brandOptions}
    </select>

    <label>Telefon modellari (vergul bilan ajrating)</label>
    <input name="models" value="${escapeHTML((p?.models || []).join(", "))}"
      placeholder="Galaxy A15, Galaxy A16">

    <label>Mahsulot nomi</label>
    <input name="name" required value="${escapeHTML(p?.name || "")}">

    <label>Ichki kod</label>
    <input name="internalCode" required
      value="${escapeHTML(p?.internalCode || "")}">

    <label>Sotuv narxi (so'm)</label>
    <input name="price" type="number" min="0" required
      value="${p?.price ?? ""}">

    <label>Tannarx (so'm)</label>
    <input name="cost" type="number" min="0" required
      value="${p?.cost ?? ""}">

    <label>Ombordagi soni</label>
    <input name="stock" type="number" min="0" required
      value="${p?.stock ?? 0}">

    <label>Rasm URL manzili (ixtiyoriy)</label>
    <input name="image" type="url"
      value="${escapeHTML(p?.image || "")}"
      placeholder="https://...">

    <label>Tavsif</label>
    <textarea name="description">${escapeHTML(p?.description || "")}</textarea>

    <label>Holati</label>
    <select name="isActive">
      <option value="true" ${!p?.hidden ? "selected" : ""}>Faol</option>
      <option value="false" ${p?.hidden ? "selected" : ""}>Yashirin</option>
    </select>
  `, async (fd) => {
    const name = String(fd.get("name") || "").trim();
    const internalCode = String(fd.get("internalCode") || "").trim();
    const category = String(fd.get("category") || "other");
    const price = Number(fd.get("price"));
    const cost = Number(fd.get("cost"));
    const stock = Number(fd.get("stock"));
    const image = String(fd.get("image") || "").trim();
    const description = String(fd.get("description") || "").trim();
    const brandName = String(fd.get("brand") || "").trim();
    const modelNames = String(fd.get("models") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const isActive = fd.get("isActive") === "true";

    if (!name || !internalCode) {
      throw new Error("Mahsulot nomi va ichki kodni kiriting.");
    }

    if (
      !Number.isFinite(price) || price < 0 ||
      !Number.isFinite(cost) || cost < 0 ||
      !Number.isInteger(stock) || stock < 0
    ) {
      throw new Error("Narx, tannarx va ombor sonini tekshiring.");
    }

    // Ichki kod takrorlanmasligini tekshirish
    const duplicate = adminProducts.find((item) =>
      item.internalCode.toLowerCase() === internalCode.toLowerCase() &&
      item.categoryId === category &&
      String(item.id) !== String(p?.id ?? "")
    );

    if (duplicate) {
      throw new Error("Bu kategoriya ichida ushbu ichki kod mavjud.");
    }

    const payload = {
      name,
      internal_code: internalCode,
      category,
      price,
      cost_price: cost,
      stock,
      image_url: image || null,
      description: description || null,
      is_active: isActive
    };

    let productId = p?.id;

    if (isEdit) {
      const { error } = await supabaseClient
        .from("products")
        .update(payload)
        .eq("id", productId);

      if (error) throw error;
    } else {
      const { data, error } = await supabaseClient
        .from("products")
        .insert(payload)
        .select("id")
        .single();

      if (error) throw error;
      productId = data.id;
    }

    // Brend va telefon modellari bog'lanishi
    if (brandName) {
      const brandId = await ensureBrand(brandName);

      const modelIds = [];
      for (const modelName of [...new Set(modelNames)]) {
        const modelId = await ensureModel(brandId, modelName);
        modelIds.push(modelId);
      }

      // Faqat shu mahsulotning oldingi mosliklarini o'chirish
      const { error: deleteError } = await supabaseClient
        .from("product_compatibility")
        .delete()
        .eq("product_id", productId);

      if (deleteError) throw deleteError;

      if (modelIds.length) {
        const rows = modelIds.map((modelId) => ({
          product_id: productId,
          model_id: modelId
        }));

        const { error: insertError } = await supabaseClient
          .from("product_compatibility")
          .insert(rows);

        if (insertError) throw insertError;
      }
    } else if (isEdit) {
      // Brend tanlanmagan bo'lsa, eski mosliklarni olib tashlash
      const { error } = await supabaseClient
        .from("product_compatibility")
        .delete()
        .eq("product_id", productId);

      if (error) throw error;
    }

    await Promise.all([loadAdminProducts(), loadBrands()]);
    toast(isEdit ? "Mahsulot yangilandi" : "Mahsulot qo'shildi");
  });
}

// 13. BRЕND/MODELNI BAZADA TOPISH YOKI YARATISH
async function ensureBrand(name) {
  const { data: existing, error: findError } = await supabaseClient
    .from("brands")
    .select("id")
    .eq("name", name)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) return existing.id;

  const { data, error } = await supabaseClient
    .from("brands")
    .insert({ name })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

async function ensureModel(brandId, name) {
  const { data: existing, error: findError } = await supabaseClient
    .from("phone_models")
    .select("id")
    .eq("brand_id", brandId)
    .eq("name", name)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) return existing.id;

  const { data, error } = await supabaseClient
    .from("phone_models")
    .insert({ brand_id: brandId, name })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

// 14. MAHSULOTNI YASHIRISH / FAOLLASHTIRISH
async function toggleProduct(id) {
  const p = adminProducts.find((item) => String(item.id) === String(id));
  if (!p) return;

  const newActiveState = p.hidden;

  const { error } = await supabaseClient
    .from("products")
    .update({ is_active: newActiveState })
    .eq("id", id);

  if (error) {
    showError(error, "Mahsulot holatini o'zgartirib bo'lmadi");
    return;
  }

  toast(newActiveState ? "Mahsulot faollashtirildi" : "Mahsulot yashirildi");
  await loadAdminProducts();
}

// 15. BRЕND QO'SHISH / TAHRIRLASH
function brandForm(brand = null) {
  openForm(brand ? "Brendni tahrirlash" : "Yangi brend", `
    <label>Brend nomi</label>
    <input name="name" required value="${escapeHTML(brand?.name || "")}">

    <label>Telefon modellari (vergul bilan ajrating)</label>
    <textarea name="models" placeholder="Galaxy A15, Galaxy A16">${
      escapeHTML((brand?.models || []).join(", "))
    }</textarea>
  `, async (fd) => {
    const name = String(fd.get("name") || "").trim();
    const modelNames = [...new Set(
      String(fd.get("models") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    )];

    if (!name) throw new Error("Brend nomini kiriting.");

    let brandId = brand?.id;

    if (brandId) {
      const { error } = await supabaseClient
        .from("brands")
        .update({ name })
        .eq("id", brandId);

      if (error) throw error;
    } else {
      brandId = await ensureBrand(name);
    }

    for (const modelName of modelNames) {
      await ensureModel(brandId, modelName);
    }

    await loadBrands();
    toast(brand ? "Brend yangilandi" : "Brend qo'shildi");
  });
}

// 16. OMBORGA KIRIM
function stockEntryForm(product = null) {
  const options = adminProducts.map((p) => `
    <option value="${p.id}"
      ${String(p.id) === String(product?.id) ? "selected" : ""}>
      ${escapeHTML(p.name)} (${escapeHTML(p.internalCode)}) — qoldiq: ${p.stock}
    </option>
  `).join("");

  openForm("Omborga kirim", `
    <label>Mahsulot</label>
    <select name="productId" required>
      <option value="">Mahsulotni tanlang</option>
      ${options}
    </select>

    <label>Kirim miqdori</label>
    <input name="quantity" type="number" min="1" step="1" required>

    <label>Yangi tannarx (ixtiyoriy)</label>
    <input name="cost" type="number" min="0" placeholder="Bo'sh qoldirilsa eski tannarx saqlanadi">
  `, async (fd) => {
    const id = fd.get("productId");
    const quantity = Number(fd.get("quantity"));
    const newCostText = String(fd.get("cost") || "").trim();
    const p = adminProducts.find((item) => String(item.id) === String(id));

    if (!p) throw new Error("Mahsulotni tanlang.");
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("Kirim miqdori musbat butun son bo'lishi kerak.");
    }

    const payload = { stock: p.stock + quantity };

    if (newCostText !== "") {
      const newCost = Number(newCostText);
      if (!Number.isFinite(newCost) || newCost < 0) {
        throw new Error("Tannarx noto'g'ri.");
      }
      payload.cost_price = newCost;
    }

    const { error } = await supabaseClient
      .from("products")
      .update(payload)
      .eq("id", id);

    if (error) throw error;

    await loadAdminProducts();
    toast("Ombor kirimi saqlandi");
  });
}

// 17. NAVIGATSIYA

 // 17. NAVIGATSIYA — admin.html BILAN MOSLASHTIRILDI

const pageTitles = {
  dashboard: "Boshqaruv paneli",
  products: "Mahsulotlar",
  brands: "Brendlar",
  orders: "Buyurtmalar",
  customers: "Mijozlar",
  stock: "Ombor",
  reports: "Hisobotlar",
  settings: "Sozlamalar"
};

function navigate(page, title) {
  // Menyu tugmalarining faol holati
  document.querySelectorAll(".nav-item[data-page], [data-page-link]").forEach((el) => {
    const targetPage = el.dataset.page || el.dataset.pageLink;
    el.classList.toggle("active", targetPage === page);
  });

  // HTML ichidagi sahifalarni almashtirish
  document.querySelectorAll(".page, .admin-page").forEach((el) => {
    el.classList.toggle("active", el.id === `page-${page}` || el.id === page);
  });

  // Sahifa sarlavhasi
  const crumb = document.querySelector("#pageCrumb");
  if (crumb) {
    crumb.textContent = title || pageTitles[page] || page;
  }

  // Mobil menyuni yopish
  document.querySelector("#sidebar")?.classList.remove("open");
  document.querySelector(".sidebar")?.classList.remove("open");
}

// Chap menyu
document.querySelectorAll("[data-page], [data-page-link]").forEach((el) => {
  el.addEventListener("click", (event) => {
    const page = el.dataset.page || el.dataset.pageLink;
    if (!page) return;

    event.preventDefault();
    navigate(page, el.dataset.title || pageTitles[page]);
  });
});

// Sahifaga olib o'tuvchi tezkor tugmalar
document.querySelectorAll("[data-goto]").forEach((el) => {
  el.addEventListener("click", () => {
    const page = el.dataset.goto;
    if (page) navigate(page, pageTitles[page]);
  });
});

// Mobil menyu
document.querySelector("#mobileMenu")?.addEventListener("click", () => {
  document.querySelector("#sidebar")?.classList.toggle("open");
  document.querySelector(".sidebar")?.classList.toggle("open");
});

// 18. TUGMALAR VA QIDIRUVLAR
$("#newProductBtn")?.addEventListener("click", () => productForm());

$("#addBrandBtn")?.addEventListener("click", () => brandForm());

$("#stockEntryBtn")?.addEventListener("click", () => stockEntryForm());

$("#productSearch")?.addEventListener("input", renderAdminProducts);
$("#productCategory")?.addEventListener("change", renderAdminProducts);
$("#productState")?.addEventListener("change", renderAdminProducts);

$("#orderSearch")?.addEventListener("input", renderOrders);
$("#orderFilter")?.addEventListener("change", renderOrders);
$("#customerSearch")?.addEventListener("input", renderCustomers);

$("#adminProductRows")?.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-product]");
  const toggleButton = event.target.closest("[data-toggle-product]");

  if (editButton) {
    const p = adminProducts.find(
      (item) => String(item.id) === editButton.dataset.editProduct
    );
    if (p) productForm(p);
  }

  if (toggleButton) {
    toggleProduct(toggleButton.dataset.toggleProduct);
  }
});

$("#brandAdminGrid")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit-brand]");
  if (!button) return;

  const brand = brands.find(
    (item) => String(item.id) === button.dataset.editBrand
  );
  if (brand) brandForm(brand);
});

$("#stockRows")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-stock-product]");
  if (!button) return;

  const p = adminProducts.find(
    (item) => String(item.id) === button.dataset.stockProduct
  );
  if (p) stockEntryForm(p);
});

$("#orderRows")?.addEventListener("change", (event) => {
  const select = event.target.closest("[data-order-status]");
  if (!select) return;

  updateOrderStatus(select.dataset.orderStatus, select.value);
});

// 19. HISOBOT
$("#applyReport")?.addEventListener("click", () => {
  const reportArea = $("#reportResult");
  if (!reportArea) {
    toast("Hisobot natijasini ko'rsatadigan HTML elementi topilmadi.");
    return;
  }

  const activeProducts = adminProducts.filter((p) => !p.hidden);
  const totalStock = activeProducts.reduce((sum, p) => sum + p.stock, 0);
  const stockCost = activeProducts.reduce(
    (sum, p) => sum + p.stock * p.cost, 0
  );
  const stockRetail = activeProducts.reduce(
    (sum, p) => sum + p.stock * p.price, 0
  );

  reportArea.innerHTML = `
    <p>Faol mahsulotlar: <strong>${activeProducts.length}</strong></p>
    <p>Jami ombor qoldig'i: <strong>${totalStock}</strong></p>
    <p>Ombor tannarxi: <strong>${fmt(stockCost)}</strong></p>
    <p>Taxminiy sotuv qiymati: <strong>${fmt(stockRetail)}</strong></p>
  `;
});

// 20. CSV EKSPORT
$("#exportCsv")?.addEventListener("click", () => {
  const rows = [
    ["ID", "Nomi", "Kategoriya", "Ichki kod", "Brend", "Modellar",
      "Sotuv narxi", "Tannarx", "Ombor", "Holati"],
    ...adminProducts.map((p) => [
      p.id,
      p.name,
      p.category,
      p.internalCode,
      p.brand,
      p.models.join(", "),
      p.price,
      p.cost,
      p.stock,
      p.hidden ? "Yashirin" : "Faol"
    ])
  ];

  const csv = "\uFEFF" + rows.map((row) =>
    row.map((value) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`
    ).join(";")
  ).join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "phoneparts-mahsulotlar.csv";
  link.click();

  URL.revokeObjectURL(url);
});

// 21. SOZLAMALAR TUGMALARI
$("#bannerSettingsBtn")?.addEventListener("click", () => {
  toast("Banner sozlamalari hali Supabase bilan ulanmagan.");
});

$("#employeeSettingsBtn")?.addEventListener("click", () => {
  toast("Xodimlar sozlamalari hali ulanmagan.");
});

$("#deliverySettingsBtn")?.addEventListener("click", () => {
  toast("Yetkazib berish sozlamalari hali ulanmagan.");
});

// 22. SANA
const todayDate = $("#todayDate");
if (todayDate) {
  todayDate.textContent = new Date().toLocaleDateString("uz-UZ", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

// 23. ADMIN PANELNI ISHGA TUSHIRISH

/* 23. ADMIN LOGIN VA RUXSAT TEKSHIRUVI */

let adminInitialized = false;
let loginBusy = false;

function showLogin(message = "") {
  const loginScreen = document.querySelector("#loginScreen");
  const adminApp = document.querySelector("#adminApp");
  const errorBox = document.querySelector("#loginError");

  if (adminApp) adminApp.hidden = true;
  if (loginScreen) loginScreen.style.display = "flex";
  if (errorBox) errorBox.textContent = message;
}

function showAdmin() {
  const loginScreen = document.querySelector("#loginScreen");
  const adminApp = document.querySelector("#adminApp");

  if (loginScreen) loginScreen.style.display = "none";
  if (adminApp) adminApp.hidden = false;
}

async function verifyAdmin(user) {
  if (!user) {
    throw new Error("Foydalanuvchi sessiyasi topilmadi.");
  }

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(
      "Admin rolini tekshirib bo‘lmadi: " + error.message
    );
  }

  if (profile?.role !== "admin") {
    throw new Error(
      "Bu hisobga admin huquqi berilmagan. Administrator bilan bog‘laning."
    );
  }

  return true;
}

async function initAdmin() {
  if (adminInitialized) return;

  adminInitialized = true;

  try {
    await Promise.all([
      loadAdminProducts(),
      loadBrands(),
      loadOrders(),
      loadCustomers()
    ]);

    renderStock();
    refreshStockProductOptions();
  } catch (error) {
    adminInitialized = false;
    throw error;
  }
}

async function enterAdmin(user) {
  await verifyAdmin(user);
  showAdmin();
  await initAdmin();
}

const loginForm = document.querySelector("#loginForm");

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (loginBusy) return;
  loginBusy = true;

  const button = document.querySelector("#loginSubmit");
  const errorBox = document.querySelector("#loginError");
  const email = document.querySelector("#loginEmail").value.trim();
  const password = document.querySelector("#loginPassword").value;

  button.disabled = true;
  button.textContent = "Tekshirilmoqda...";
  errorBox.textContent = "";

  try {
    const { data, error } = await supabaseClient.auth
      .signInWithPassword({ email, password });

    if (error) throw error;

    try {
      await enterAdmin(data.user);
    } catch (roleError) {
      await supabaseClient.auth.signOut();
      throw roleError;
    }
  } catch (error) {
    showLogin(error.message || "Kirish amalga oshmadi.");
  } finally {
    loginBusy = false;
    button.disabled = false;
    button.textContent = "Kirish";
  }
});

document.querySelector("#logoutBtn")?.addEventListener("click", async () => {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    showError(error, "Tizimdan chiqishda xatolik");
    return;
  }

  adminInitialized = false;
  loginForm?.reset();
  showLogin("Tizimdan chiqdingiz.");
});

async function startAdmin() {
  showLogin();

  if (!window.supabase) {
    showLogin("Supabase kutubxonasi yuklanmagan.");
    return;
  }

  try {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) throw error;

    if (!data.session?.user) {
      showLogin();
      return;
    }

    await enterAdmin(data.session.user);
  } catch (error) {
    await supabaseClient.auth.signOut();
    showLogin(error.message || "Sessiyani tekshirishda xatolik.");
  }
}

startAdmin();

