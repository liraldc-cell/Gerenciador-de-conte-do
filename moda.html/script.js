
const $ = id => document.getElementById(id);

const STORAGE = {
    products: "maison_products_v2",
    contents: "maison_contents_v2",
    campaigns: "maison_campaigns_v2"
};

function loadData(key) {
    try {
        const data = JSON.parse(localStorage.getItem(key));
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

let products = loadData(STORAGE.products);
let contents = loadData(STORAGE.contents);
let campaigns = loadData(STORAGE.campaigns);

function saveData() {
    try {
        localStorage.setItem(STORAGE.products, JSON.stringify(products));
        localStorage.setItem(STORAGE.contents, JSON.stringify(contents));
        localStorage.setItem(STORAGE.campaigns, JSON.stringify(campaigns));
        return true;
    } catch {
        notify("Não foi possível salvar. Verifique o espaço disponível no navegador.");
        return false;
    }
}

function uid() {
    return crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function money(value) {
    return Number(value).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function dateBR(value) {
    if (!value) return "Sem data";
    const parts = value.split("-");
    if (parts.length !== 3) return value;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

let toastTimer;

function notify(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}

// Navegação entre as páginas
function navigate(page) {
    const validPages = ["inicio", "produtos", "conteudos", "campanhas"];
    if (!validPages.includes(page)) return;

    document.querySelectorAll(".page").forEach(section => {
        section.classList.toggle("active", section.id === `page-${page}`);
    });

    document.querySelectorAll(".nav-link").forEach(link => {
        link.classList.toggle("active", link.dataset.page === page);
    });

    const titles = {
        inicio: "Visão geral",
        produtos: "Produtos",
        conteudos: "Conteúdos",
        campanhas: "Campanhas"
    };

    $("breadcrumbTitle").textContent = titles[page];
    history.replaceState(null, "", `#${page}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-page]").forEach(link => {
    link.addEventListener("click", event => {
        event.preventDefault();
        navigate(link.dataset.page);
    });
});

document.querySelectorAll("[data-go]").forEach(button => {
    button.addEventListener("click", () => navigate(button.dataset.go));
});

// Imagens externas: somente endereços HTTP/HTTPS
function safeImageURL(value) {
    try {
        const url = new URL(value);
        if (url.protocol === "https:" || url.protocol === "http:") {
            return url.href;
        }
    } catch {}
    return "";
}

function imageHTML(url, name, className) {
    const safeURL = safeImageURL(url);
    const alt = escapeHTML(name);

    if (!safeURL) {
        return `<div class="${className === "recent-image" ?
            "recent-placeholder" : "product-placeholder"}">M.</div>`;
    }

    return `<img class="${className}" src="${escapeHTML(safeURL)}"
        alt="${alt}" loading="lazy"
        onerror="this.replaceWith(Object.assign(document.createElement('div'),{
            className:'product-placeholder',textContent:'M.'
        }))">`;
}

function productStatus(product) {
    if (product.quantity === 0) {
        return { text: "Esgotado", className: "stock-out" };
    }

    if (product.quantity <= 5) {
        return { text: "Estoque baixo", className: "stock-low" };
    }

    return { text: "Disponível", className: "stock-ok" };
}

// Dashboard
function renderDashboard() {
    const units = products.reduce((sum, p) => sum + p.quantity, 0);
    const value = products.reduce((sum, p) => sum + p.price * p.quantity, 0);

    $("statProducts").textContent = products.length;
    $("statUnits").textContent = units.toLocaleString("pt-BR");
    $("statValue").textContent = money(value);
    $("statContent").textContent = contents.length;
    $("navProductCount").textContent = products.length;

    $("productSummary").textContent = products.length;
    $("lowStockCount").textContent =
        products.filter(p => p.quantity > 0 && p.quantity <= 5).length;
    $("outStockCount").textContent =
        products.filter(p => p.quantity === 0).length;

    // Gráfico de estoque por categoria
    const categories = {};

    products.forEach(product => {
        categories[product.category] =
            (categories[product.category] || 0) + product.quantity;
    });

    const chart = $("categoryChart");
    const entries = Object.entries(categories)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7);

    chart.innerHTML = entries.map(([category, quantity]) => {
        const max = Math.max(...entries.map(item => item[1]), 1);
        const width = quantity === 0 ? 0 : Math.max(3, quantity / max * 100);

        return `
            <div class="chart-row">
                <span class="chart-label">${escapeHTML(category)}</span>
                <div class="chart-track">
                    <div class="chart-fill" style="width:${width}%"></div>
                </div>
                <span class="chart-value">${quantity}</span>
            </div>
        `;
    }).join("");

    $("chartEmpty").style.display = entries.length ? "none" : "block";

    // Produtos adicionados mais recentemente
    const recent = [...products].reverse().slice(0, 3);

    $("recentProducts").innerHTML = recent.map(product => `
        <article class="recent-item">
            ${imageHTML(product.image, product.name, "recent-image")}
            <div class="recent-details">
                <strong>${escapeHTML(product.name)}</strong>
                <span>${money(product.price)}</span>
                <span>${product.quantity} unidades</span>
            </div>
        </article>
    `).join("");

    if (recent.length === 0) {
        $("recentProducts").innerHTML =
            '<p class="empty-hint">Seus produtos aparecerão aqui após o cadastro.</p>';
    }
}

// Formulário de produtos
function openProductForm(product = null) {
    $("productForm").reset();
    $("editProductId").value = product?.id || "";
    $("productFormTitle").textContent = product ? "Editar produto" : "Adicionar produto";

    if (product) {
        $("productName").value = product.name;
        $("productCategory").value = product.category;
        $("productPrice").value = product.price;
        $("productQuantity").value = product.quantity;
        $("productImage").value = product.image || "";
    }

    $("productFormPanel").classList.remove("hidden");
    $("productFormPanel").scrollIntoView({ behavior: "smooth", block: "start" });
    $("productName").focus();
}

function closeProductForm() {
    $("productFormPanel").classList.add("hidden");
    $("productForm").reset();
    $("editProductId").value = "";
}

$("showProductForm").addEventListener("click", () => openProductForm());
$("closeProductForm").addEventListener("click", closeProductForm);
$("cancelProduct").addEventListener("click", closeProductForm);

$("productForm").addEventListener("submit", event => {
    event.preventDefault();

    const name = $("productName").value.trim();
    const category = $("productCategory").value;
    const price = Number($("productPrice").value);
    const quantityText = $("productQuantity").value;
    const quantity = Number(quantityText);
    const image = $("productImage").value.trim();
    const editId = $("editProductId").value;

    if (!name || !category ||
        !Number.isFinite(price) || price <= 0 || price > 100000000 ||
        quantityText.trim() === "" ||
        !Number.isSafeInteger(quantity) || quantity < 0 || quantity > 1000000) {
        notify("Confira os campos e informe valores válidos.");
        return;
    }

    if (image && !safeImageURL(image)) {
        notify("Informe uma URL válida iniciada com http:// ou https://.");
        return;
    }

    const existing = products.find(p => p.id === editId);

    const product = {
        id: editId || uid(),
        name,
        category,
        price,
        quantity,
        image,
        createdAt: existing?.createdAt || new Date().toISOString()
    };

    const previous = products;

    products = editId
        ? products.map(p => p.id === editId ? product : p)
        : [...products, product];

    if (!saveData()) {
        products = previous;
        return;
    }

    renderAll();
    closeProductForm();
    notify(editId ? "Produto atualizado com sucesso!" : "Produto cadastrado com sucesso!");
});

function renderProducts() {
    const search = $("productSearch").value.trim().toLowerCase();
    const category = $("categoryFilter").value;

    const filtered = products.filter(product => {
        const matchesText =
            product.name.toLowerCase().includes(search) ||
            product.category.toLowerCase().includes(search);

        return matchesText && (!category || product.category === category);
    });

    $("productTable").innerHTML = filtered.map(product => {
        const status = productStatus(product);

        return `
            <tr>
                <td>
                    <div class="product-cell">
                        ${imageHTML(product.image, product.name, "product-image")}
                        <div>
                            <strong>${escapeHTML(product.name)}</strong>
                            <small>ID ${escapeHTML(product.id.slice(0, 8))}</small>
                        </div>
                    </div>
                </td>
                <td>${escapeHTML(product.category)}</td>
                <td>${money(product.price)}</td>
                <td>${product.quantity} un.</td>
                <td><span class="stock-pill ${status.className}">${status.text}</span></td>
                <td>
                    <div class="action-group">
                        <button class="action-btn" data-edit-product="${escapeHTML(product.id)}">Editar</button>
                        <button class="action-btn delete" data-delete-product="${escapeHTML(product.id)}">Excluir</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    $("productEmpty").style.display = filtered.length ? "none" : "block";
}

$("productSearch").addEventListener("input", renderProducts);
$("categoryFilter").addEventListener("change", renderProducts);

$("productTable").addEventListener("click", event => {
    const editButton = event.target.closest("[data-edit-product]");
    const deleteButton = event.target.closest("[data-delete-product]");

    if (editButton) {
        const product = products.find(p => p.id === editButton.dataset.editProduct);
        if (product) openProductForm(product);
    }

    if (deleteButton) {
        const product = products.find(p => p.id === deleteButton.dataset.deleteProduct);
        if (!product) return;

        if (!confirm(`Deseja excluir "${product.name}"?`)) return;

        const previous = products;
        products = products.filter(p => p.id !== product.id);

        if (!saveData()) {
            products = previous;
            return;
        }

        renderAll();
        notify("Produto excluído.");
    }
});

// Conteúdos e publicações
function openContentForm(content = null) {
    $("contentForm").reset();
    $("editContentId").value = content?.id || "";
    $("contentFormTitle").textContent = content ? "Editar conteúdo" : "Planejar conteúdo";

    if (content) {
        $("contentTitle").value = content.title;
        $("contentChannel").value = content.channel;
        $("contentDate").value = content.date;
        $("contentStatus").value = content.status;
        $("contentDescription").value = content.description || "";
    }

    $("contentFormPanel").classList.remove("hidden");
    $("contentFormPanel").scrollIntoView({ behavior: "smooth", block: "start" });
    $("contentTitle").focus();
}

function closeContentForm() {
    $("contentFormPanel").classList.add("hidden");
    $("contentForm").reset();
    $("editContentId").value = "";
}

$("showContentForm").addEventListener("click", () => openContentForm());
$("closeContentForm").addEventListener("click", closeContentForm);
$("cancelContent").addEventListener("click", closeContentForm);

$("contentForm").addEventListener("submit", event => {
    event.preventDefault();

    const title = $("contentTitle").value.trim();
    const channel = $("contentChannel").value;
    const date = $("contentDate").value;
    const status = $("contentStatus").value;
    const description = $("contentDescription").value.trim();
    const editId = $("editContentId").value;

    if (!title || !date) {
        notify("Preencha o título e a data.");
        return;
    }

    const existing = contents.find(c => c.id === editId);

    const content = {
        id: editId || uid(),
        title,
        channel,
        date,
        status,
        description,
        createdAt: existing?.createdAt || new Date().toISOString()
    };

    const previous = contents;
    contents = editId
        ? contents.map(c => c.id === editId ? content : c)
        : [...contents, content];

    if (!saveData()) {
        contents = previous;
        return;
    }

    renderAll();
    closeContentForm();
    notify(editId ? "Conteúdo atualizado!" : "Conteúdo planejado com sucesso!");
});

function contentStatusClass(status) {
    return {
        "Ideia": "status-idea",
        "Em produção": "status-progress",
        "Agendado": "status-scheduled",
        "Publicado": "status-published"
    }[status] || "status-idea";
}

function renderContents() {
    const filter = $("contentStatusFilter").value;

    const filtered = [...contents]
        .filter(c => !filter || c.status === filter)
        .sort((a, b) => a.date.localeCompare(b.date));

    $("contentList").innerHTML = filtered.map(content => `
        <article class="content-card">
            <div class="content-card-top">
                <span class="channel-label">${escapeHTML(content.channel)}</span>
                <span class="status-pill ${contentStatusClass(content.status)}">${escapeHTML(content.status)}</span>
            </div>
            <h3>${escapeHTML(content.title)}</h3>
            <div class="content-description">${escapeHTML(content.description || "Nenhuma descrição adicionada.")}</div>
            <div class="content-meta">
                <span>◷ ${dateBR(content.date)}</span>
                <span>${content.status === "Publicado" ? "Concluído" : "Planejado"}</span>
            </div>
            <div class="content-actions">
                <button class="action-btn" data-edit-content="${escapeHTML(content.id)}">Editar</button>
                <button class="action-btn delete" data-delete-content="${escapeHTML(content.id)}">Excluir</button>
            </div>
        </article>
    `).join("");

    $("contentEmpty").style.display = filtered.length ? "none" : "block";
}

$("contentStatusFilter").addEventListener("change", renderContents);

$("contentList").addEventListener("click", event => {
    const edit = event.target.closest("[data-edit-content]");
    const remove = event.target.closest("[data-delete-content]");

    if (edit) {
        const content = contents.find(c => c.id === edit.dataset.editContent);
        if (content) openContentForm(content);
    }

    if (remove) {
        const content = contents.find(c => c.id === remove.dataset.deleteContent);
        if (!content || !confirm(`Excluir o conteúdo "${content.title}"?`)) return;

        const previous = contents;
        contents = contents.filter(c => c.id !== content.id);

        if (!saveData()) {
            contents = previous;
            return;
        }

        renderAll();
        notify("Conteúdo excluído.");
    }
});

// Campanhas
function openCampaignForm(campaign = null) {
    $("campaignForm").reset();
    $("editCampaignId").value = campaign?.id || "";
    $("campaignFormTitle").textContent = campaign ? "Editar campanha" : "Criar campanha";

    if (campaign) {
        $("campaignName").value = campaign.name;
        $("campaignGoal").value = campaign.goal;
        $("campaignStart").value = campaign.start;
        $("campaignEnd").value = campaign.end;
        $("campaignDescription").value = campaign.description || "";
        $("campaignStatus").value = campaign.status;
    }

    $("campaignFormPanel").classList.remove("hidden");
    $("campaignFormPanel").scrollIntoView({ behavior: "smooth", block: "start" });
    $("campaignName").focus();
}

function closeCampaignForm() {
    $("campaignFormPanel").classList.add("hidden");
    $("campaignForm").reset();
    $("editCampaignId").value = "";
}

$("showCampaignForm").addEventListener("click", () => openCampaignForm());
$("closeCampaignForm").addEventListener("click", closeCampaignForm);
$("cancelCampaign").addEventListener("click", closeCampaignForm);

$("campaignForm").addEventListener("submit", event => {
    event.preventDefault();

    const name = $("campaignName").value.trim();
    const goal = $("campaignGoal").value;
    const start = $("campaignStart").value;
    const end = $("campaignEnd").value;
    const description = $("campaignDescription").value.trim();
    const status = $("campaignStatus").value;
    const editId = $("editCampaignId").value;

    if (!name || !start || !end || end < start) {
        notify("Preencha os campos e confira as datas da campanha.");
        return;
    }

    const existing = campaigns.find(c => c.id === editId);

    const campaign = {
        id: editId || uid(),
        name,
        goal,
        start,
        end,
        description,
        status,
        createdAt: existing?.createdAt || new Date().toISOString()
    };

    const previous = campaigns;
    campaigns = editId
        ? campaigns.map(c => c.id === editId ? campaign : c)
        : [...campaigns, campaign];

    if (!saveData()) {
        campaigns = previous;
        return;
    }

    renderAll();
    closeCampaignForm();
    notify(editId ? "Campanha atualizada!" : "Campanha criada com sucesso!");
});

function campaignStatusClass(status) {
    if (status === "Concluída") return "status-published";
    if (status === "Em andamento") return "status-progress";
    return "status-scheduled";
}

function renderCampaigns() {
    const sorted = [...campaigns].sort((a, b) => a.start.localeCompare(b.start));

    $("campaignCount").textContent =
        `${campaigns.length} ${campaigns.length === 1 ? "campanha" : "campanhas"}`;

    $("campaignList").innerHTML = sorted.map(campaign => `
        <article class="campaign-card">
            <div class="campaign-card-head">
                <div>
                    <h3>${escapeHTML(campaign.name)}</h3>
                    <span class="campaign-goal">${escapeHTML(campaign.goal)}</span>
                </div>
                <span class="status-pill ${campaignStatusClass(campaign.status)}">
                    ${escapeHTML(campaign.status)}
                </span>
            </div>

            <p>${escapeHTML(campaign.description || "Nenhuma descrição adicionada.")}</p>

            <div class="campaign-dates">
                ◷ ${dateBR(campaign.start)} — ${dateBR(campaign.end)}
            </div>

            <div class="campaign-actions">
                <button class="action-btn" data-edit-campaign="${escapeHTML(campaign.id)}">Editar</button>
                <button class="action-btn delete" data-delete-campaign="${escapeHTML(campaign.id)}">Excluir</button>
            </div>
        </article>
    `).join("");

    $("campaignEmpty").style.display = sorted.length ? "none" : "block";
}

$("campaignList").addEventListener("click", event => {
    const edit = event.target.closest("[data-edit-campaign]");
    const remove = event.target.closest("[data-delete-campaign]");

    if (edit) {
        const campaign = campaigns.find(c => c.id === edit.dataset.editCampaign);
        if (campaign) openCampaignForm(campaign);
    }

    if (remove) {
        const campaign = campaigns.find(c => c.id === remove.dataset.deleteCampaign);
        if (!campaign || !confirm(`Excluir a campanha "${campaign.name}"?`)) return;

        const previous = campaigns;
        campaigns = campaigns.filter(c => c.id !== campaign.id);

        if (!saveData()) {
            campaigns = previous;
            return;
        }

        renderAll();
        notify("Campanha excluída.");
    }
});

// Atualização geral
function renderAll() {
    renderDashboard();
    renderProducts();
    renderContents();
    renderCampaigns();
}

$("currentYear").textContent = new Date().getFullYear();

renderAll();

const initialPage = location.hash.replace("#", "");
navigate(["produtos", "conteudos", "campanhas"].includes(initialPage)
    ? initialPage
    : "inicio");
