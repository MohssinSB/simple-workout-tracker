// ---------- Configuración de la API ----------
// Cuando pruebes desde el móvil, cambia esto por la IP de tu PC en la red local,
// por ejemplo: 'http://192.168.1.35:8000'
const API_BASE_URL = 'http://localhost:8000';

const incrementOptions = [2.5, 5, 10];

// Estado en memoria: se recarga desde la API al iniciar
// state.groups: [{ id_grupo, nombre, exercises: [...] }]
// cada exercise: { id_ejercicio, nombre, id_grupo, logs: [...], pesoActualKg, step, unit }
let state = { groups: [] };
let openGroupIds = new Set();
let expandedExerciseIds = new Set();
let allExpanded = true;
let searchTerm = '';
let modalConfirmHandler = null;
let chartInstances = {}; // id_ejercicio -> instancia de Chart.js activa

document.addEventListener('DOMContentLoaded', () => {
    init();
    setupDrawers();
    setupSearch();
    setupToggleAll();
    setupModal();
    setupAddGroup();
    setupGlobalEscape();
});

// ---------- Carga inicial desde la API ----------
async function init() {
    showLoading(true);
    try {
        const grupos = await apiGet('/grupos');
        const groups = [];
        for (const g of grupos) {
            const ejercicios = await apiGet(`/ejercicios/${g.id_grupo}`);
            const exercises = [];
            for (const ex of ejercicios) {
                const logs = await apiGet(`/progreso/${ex.id_ejercicio}`);
                exercises.push({
                    id_ejercicio: ex.id_ejercicio,
                    nombre: ex.nombre,
                    id_grupo: ex.id_grupo,
                    logs,
                    pesoActualKg: logs.length ? logs[0].peso : 20,
                    step: 2.5,
                    unit: 'Kg',
                    chartMetric: 'peso' // 'peso' (máximo) o 'volumen' (peso × reps)
                });
            }
            groups.push({ id_grupo: g.id_grupo, nombre: g.nombre, exercises });
        }
        state.groups = groups;
        openGroupIds = new Set(groups.map(g => g.id_grupo));
        clearError();
        renderList();
    } catch (e) {
        showError('No se pudo conectar con el servidor. ¿Está main.py corriendo (uvicorn main:app --reload)?');
    } finally {
        showLoading(false);
    }
}

// ---------- Helpers de red ----------
async function apiGet(path) {
    const res = await fetch(`${API_BASE_URL}${path}`);
    if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
    return res.json();
}

async function apiPost(path, body) {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || `POST ${path} -> ${res.status}`);
    }
    return res.json();
}

async function apiDelete(path) {
    const res = await fetch(`${API_BASE_URL}${path}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`DELETE ${path} -> ${res.status}`);
    return res.json();
}

function showLoading(isLoading) {
    const container = document.getElementById('muscle-groups-container');
    if (isLoading) container.innerHTML = '<p class="empty-hint">Cargando...</p>';
}

function showError(msg) {
    let banner = document.getElementById('error-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'error-banner';
        banner.className = 'error-banner';
        document.body.appendChild(banner);
    }
    banner.textContent = msg;
    banner.classList.add('active');
}

function clearError() {
    const banner = document.getElementById('error-banner');
    if (banner) banner.classList.remove('active');
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

function formatDate(d) {
    if (d === todayStr()) return 'Hoy';
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

// ---------- Render principal ----------
function renderList() {
    const container = document.getElementById('muscle-groups-container');
    container.innerHTML = '';

    if (state.groups.length === 0) {
        container.innerHTML = '<p class="empty-hint">Añade tu primer grupo muscular con el botón +.</p>';
        return;
    }

    state.groups.forEach(group => {
        const isOpen = openGroupIds.has(group.id_grupo);
        const groupEl = document.createElement('div');
        groupEl.className = `muscle-group ${isOpen ? 'open' : ''}`;
        groupEl.dataset.id = group.id_grupo;

        const exercisesHtml = group.exercises.map(ex => renderExerciseItem(ex)).join('');
        const emptyHtml = group.exercises.length === 0
            ? '<p class="empty-hint">Aún no tienes ejercicios aquí.</p>'
            : '';

        groupEl.innerHTML = `
            <div class="group-header">
                <span>${escapeHtml(group.nombre)}</span>
                <div class="group-header-actions">
                    <button class="delete-group-btn" aria-label="Eliminar ${escapeHtml(group.nombre)}">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                    <span class="material-symbols-outlined arrow">expand_more</span>
                </div>
            </div>
            <div class="exercises-list">
                ${exercisesHtml}
                ${emptyHtml}
                <button class="add-exercise-btn">+ Añadir ejercicio</button>
            </div>
        `;

        const header = groupEl.querySelector('.group-header');
        header.addEventListener('click', (e) => {
            if (e.target.closest('.delete-group-btn')) return;
            const nowOpen = groupEl.classList.toggle('open');
            if (nowOpen) openGroupIds.add(group.id_grupo); else openGroupIds.delete(group.id_grupo);
        });

        groupEl.querySelector('.delete-group-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`¿Eliminar "${group.nombre}" y todos sus ejercicios?`)) {
                deleteGroup(group.id_grupo);
            }
        });

        groupEl.querySelector('.add-exercise-btn').addEventListener('click', () => {
            openModal('Nuevo ejercicio', 'Ej. Sentadilla', (name) => addExercise(group.id_grupo, name));
        });

        group.exercises.forEach(ex => wireExerciseItem(groupEl, group, ex));

        container.appendChild(groupEl);
    });

    applySearchFilter();
}

function renderExerciseItem(ex) {
    const isExpanded = expandedExerciseIds.has(ex.id_ejercicio);
    const summary = lastSessionSummary(ex);
    return `
        <div class="exercise-item ${isExpanded ? 'expanded' : ''}" data-id="${ex.id_ejercicio}">
            <div class="exercise-row" data-name="${escapeHtml(ex.nombre.toLowerCase())}">
                <button class="exercise-name-btn" aria-expanded="${isExpanded}">
                    <span class="material-symbols-outlined chevron">chevron_right</span>
                    <span class="exercise-name-col">
                        <span class="exercise-name">${escapeHtml(ex.nombre)}</span>
                        ${summary ? `<span class="exercise-subtitle">${summary}</span>` : ''}
                    </span>
                </button>
                <div class="weight-controls">
                    <button class="btn-circle minus-btn" aria-label="Restar peso"><span class="material-symbols-outlined">remove_circle</span></button>
                    <div class="weight-input-container">
                        <input type="number" class="weight-input" value="${getDisplayWeight(ex.pesoActualKg, ex.unit)}" step="any" aria-label="Peso">
                        <button class="unit-toggle">${ex.unit}</button>
                    </div>
                    <button class="btn-circle plus-btn" aria-label="Sumar peso"><span class="material-symbols-outlined">add_circle</span></button>
                    <button class="increment-toggle">${ex.step} ${ex.unit}</button>
                </div>
            </div>
            <div class="exercise-detail">
                ${renderExerciseDetailContent(ex)}
            </div>
        </div>
    `;
}

function renderExerciseDetailContent(ex) {
    const todayLogs = ex.logs
        .filter(l => l.fecha === todayStr())
        .slice()
        .sort((a, b) => a.id_serie - b.id_serie);
    const pastDates = [...new Set(ex.logs.filter(l => l.fecha !== todayStr()).map(l => l.fecha))].slice(0, 5);

    const todayChips = todayLogs.length
        ? `<div class="today-sets">${todayLogs.map((l, i) => `
            <span class="set-chip" data-log-id="${l.id_serie}">
                Serie ${i + 1}: ${l.peso}${ex.unit === 'Kg' ? 'kg' : 'lb'}×${l.repeticiones}
                <button class="delete-log-btn" aria-label="Eliminar serie"><span class="material-symbols-outlined" style="font-size:14px;">close</span></button>
            </span>`).join('')}</div>`
        : '<p class="empty-hint" style="padding:0 0 10px 0;">Aún no has registrado series hoy.</p>';

    const historyHtml = pastDates.length
        ? `<div class="history-list">${pastDates.map(d => {
            const daySets = ex.logs.filter(l => l.fecha === d).sort((a, b) => a.id_serie - b.id_serie);
            return `<div class="history-item"><strong>${formatDate(d)}:</strong> ${daySets.map(l => `${l.peso}kg×${l.repeticiones}`).join(', ')}</div>`;
        }).join('')}</div>`
        : '';

    const series = buildChartSeries(ex);
    const hasEnoughData = series.labels.length >= 2;
    const metricLabel = ex.chartMetric === 'volumen' ? 'Volumen total' : 'Peso máximo';
    const progressHtml = `
        <div class="progress-section">
            <div class="progress-header">
                <span class="detail-label" style="margin:0;">Progreso</span>
                ${hasEnoughData ? `<button class="metric-toggle">${metricLabel} ▾</button>` : ''}
            </div>
            ${hasEnoughData
                ? `<div class="chart-wrapper"><canvas id="chart-${ex.id_ejercicio}"></canvas></div>`
                : '<p class="empty-hint" style="padding:2px 0 4px;">Registra al menos 2 sesiones para ver tu progreso.</p>'}
        </div>
    `;

    return `
        <div class="detail-label">Registrar serie</div>
        <div class="reps-stepper">
            <button class="btn-circle reps-minus" aria-label="Restar repeticiones"><span class="material-symbols-outlined">remove_circle</span></button>
            <div class="reps-input-container">
                <input type="number" class="weight-input" value="8" min="1" aria-label="Repeticiones">
            </div>
            <button class="btn-circle reps-plus" aria-label="Sumar repeticiones"><span class="material-symbols-outlined">add_circle</span></button>
            <button class="log-btn">Registrar</button>
        </div>
        ${todayChips}
        ${historyHtml}
        ${progressHtml}
        <button class="delete-exercise-btn">Eliminar ejercicio</button>
    `;
}

// Agrupa el historial por fecha: peso máximo del día y volumen total (peso × reps sumado)
function buildChartSeries(ex) {
    const byDate = {};
    ex.logs.forEach(l => {
        if (!byDate[l.fecha]) byDate[l.fecha] = { pesoMax: 0, volumen: 0 };
        byDate[l.fecha].pesoMax = Math.max(byDate[l.fecha].pesoMax, l.peso);
        byDate[l.fecha].volumen += l.peso * l.repeticiones;
    });
    const dates = Object.keys(byDate).sort(); // formato YYYY-MM-DD ordena bien como texto
    return {
        labels: dates.map(d => formatDate(d)),
        peso: dates.map(d => byDate[d].pesoMax),
        volumen: dates.map(d => Math.round(byDate[d].volumen))
    };
}

// Crea o actualiza el gráfico Chart.js del panel de progreso de un ejercicio
function renderProgressChart(ex) {
    if (chartInstances[ex.id_ejercicio]) {
        chartInstances[ex.id_ejercicio].destroy();
        delete chartInstances[ex.id_ejercicio];
    }
    const canvas = document.getElementById(`chart-${ex.id_ejercicio}`);
    if (!canvas) return; // aún no hay suficientes datos para pintar el gráfico

    const series = buildChartSeries(ex);
    const values = ex.chartMetric === 'volumen' ? series.volumen : series.peso;
    const label = ex.chartMetric === 'volumen' ? 'Volumen (kg)' : 'Peso máximo (kg)';

    chartInstances[ex.id_ejercicio] = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: series.labels,
            datasets: [{
                label,
                data: values,
                borderColor: '#FF6B6B',
                backgroundColor: 'rgba(198, 40, 40, 0.15)',
                tension: 0.3,
                fill: true,
                pointBackgroundColor: '#FF6B6B',
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#9A9A9A', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { beginAtZero: true, ticks: { color: '#9A9A9A', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });
}

// ---------- Cableado de eventos por ejercicio ----------
function wireExerciseItem(groupEl, group, ex) {
    const item = groupEl.querySelector(`.exercise-item[data-id="${ex.id_ejercicio}"]`);
    if (!item) return;
    const row = item.querySelector('.exercise-row');
    const input = row.querySelector('.weight-input');
    const minusBtn = row.querySelector('.minus-btn');
    const plusBtn = row.querySelector('.plus-btn');
    const unitToggle = row.querySelector('.unit-toggle');
    const stepToggle = row.querySelector('.increment-toggle');
    const nameBtn = row.querySelector('.exercise-name-btn');

    // Estos controles solo ajustan el peso EN MEMORIA (el "peso que vas a usar ahora").
    // No se guarda en la base de datos hasta que pulsas "Registrar".
    input.addEventListener('change', (e) => {
        let val = parseFloat(String(e.target.value).replace(',', '.'));
        if (isNaN(val) || val < 0) val = 0;
        ex.pesoActualKg = ex.unit === 'Lbs' ? val / 2.20462 : val;
        updateDisplay(input, ex);
    });

    minusBtn.addEventListener('click', () => {
        const stepValue = ex.unit === 'Lbs' ? ex.step * 2.20462 : ex.step;
        ex.pesoActualKg = Math.max(0, ex.pesoActualKg - stepValue);
        updateDisplay(input, ex);
    });

    plusBtn.addEventListener('click', () => {
        const stepValue = ex.unit === 'Lbs' ? ex.step * 2.20462 : ex.step;
        ex.pesoActualKg += stepValue;
        updateDisplay(input, ex);
    });

    unitToggle.addEventListener('click', () => {
        ex.unit = ex.unit === 'Kg' ? 'Lbs' : 'Kg';
        unitToggle.textContent = ex.unit;
        stepToggle.textContent = `${ex.step} ${ex.unit}`;
        updateDisplay(input, ex);
    });

    stepToggle.addEventListener('click', () => {
        const idx = incrementOptions.indexOf(ex.step);
        ex.step = incrementOptions[(idx + 1) % incrementOptions.length];
        stepToggle.textContent = `${ex.step} ${ex.unit}`;
    });

    nameBtn.addEventListener('click', () => {
        const nowExpanded = item.classList.toggle('expanded');
        nameBtn.setAttribute('aria-expanded', String(nowExpanded));
        if (nowExpanded) expandedExerciseIds.add(ex.id_ejercicio); else expandedExerciseIds.delete(ex.id_ejercicio);
    });

    wireExerciseDetail(item, group, ex);
}

function wireExerciseDetail(item, group, ex) {
    const detail = item.querySelector('.exercise-detail');
    const repsInput = detail.querySelector('.weight-input');

    detail.querySelector('.reps-minus').addEventListener('click', () => {
        repsInput.value = Math.max(1, (parseInt(repsInput.value, 10) || 1) - 1);
    });
    detail.querySelector('.reps-plus').addEventListener('click', () => {
        repsInput.value = (parseInt(repsInput.value, 10) || 0) + 1;
    });

    detail.querySelector('.log-btn').addEventListener('click', async () => {
        const reps = parseInt(repsInput.value, 10);
        if (isNaN(reps) || reps <= 0) return;
        try {
            await apiPost('/registro', {
                id_ejercicio: ex.id_ejercicio,
                peso: Number(ex.pesoActualKg.toFixed(2)),
                repeticiones: reps
            });
            ex.logs = await apiGet(`/progreso/${ex.id_ejercicio}`);
            clearError();
            refreshExerciseUI(item, group, ex);
        } catch (e) {
            showError('No se pudo registrar la serie. Comprueba la conexión con el servidor.');
        }
    });

    detail.querySelectorAll('.delete-log-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const logId = btn.closest('.set-chip').dataset.logId;
            try {
                await apiDelete(`/registro/${logId}`);
                ex.logs = await apiGet(`/progreso/${ex.id_ejercicio}`);
                clearError();
                refreshExerciseUI(item, group, ex);
            } catch (e) {
                showError('No se pudo eliminar la serie.');
            }
        });
    });

    detail.querySelector('.delete-exercise-btn').addEventListener('click', () => {
        if (confirm(`¿Eliminar "${ex.nombre}"?`)) {
            deleteExercise(group.id_grupo, ex.id_ejercicio);
        }
    });

    const metricToggle = detail.querySelector('.metric-toggle');
    if (metricToggle) {
        metricToggle.addEventListener('click', () => {
            ex.chartMetric = ex.chartMetric === 'volumen' ? 'peso' : 'volumen';
            metricToggle.textContent = `${ex.chartMetric === 'volumen' ? 'Volumen total' : 'Peso máximo'} ▾`;
            renderProgressChart(ex);
        });
    }
    renderProgressChart(ex);
}

// Actualiza solo el subtítulo y el panel de detalle sin recargar toda la lista
function refreshExerciseUI(item, group, ex) {
    const nameCol = item.querySelector('.exercise-name-col');
    let subtitleEl = nameCol.querySelector('.exercise-subtitle');
    const summary = lastSessionSummary(ex);
    if (summary) {
        if (!subtitleEl) {
            subtitleEl = document.createElement('span');
            subtitleEl.className = 'exercise-subtitle';
            nameCol.appendChild(subtitleEl);
        }
        subtitleEl.textContent = summary;
    } else if (subtitleEl) {
        subtitleEl.remove();
    }

    const detail = item.querySelector('.exercise-detail');
    detail.innerHTML = renderExerciseDetailContent(ex);
    wireExerciseDetail(item, group, ex);
}

function lastSessionSummary(ex) {
    if (!ex.logs.length) return '';
    const lastDate = ex.logs[0].fecha;
    const lastSets = ex.logs.filter(l => l.fecha === lastDate).sort((a, b) => a.id_serie - b.id_serie);
    return `${formatDate(lastDate)}: ${lastSets.map(l => `${l.peso}kg×${l.repeticiones}`).join(', ')}`;
}

// ---------- Peso: unidades y display (solo en memoria/pantalla) ----------
function getDisplayWeight(weightKg, unit) {
    const weight = unit === 'Lbs' ? weightKg * 2.20462 : weightKg;
    return parseFloat(weight.toFixed(1));
}

function updateDisplay(inputElement, exerciseObj) {
    inputElement.value = getDisplayWeight(exerciseObj.pesoActualKg, exerciseObj.unit);
}

// ---------- CRUD de grupos y ejercicios (vía API) ----------
async function addGroup(name) {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    try {
        const nuevo = await apiPost('/grupos', { nombre: trimmed });
        state.groups.push({ id_grupo: nuevo.id_grupo, nombre: nuevo.nombre, exercises: [] });
        openGroupIds.add(nuevo.id_grupo);
        clearError();
        renderList();
    } catch (e) {
        showError(e.message || 'No se pudo crear el grupo.');
    }
}

async function deleteGroup(groupId) {
    try {
        await apiDelete(`/grupos/${groupId}`);
        state.groups = state.groups.filter(g => g.id_grupo !== groupId);
        openGroupIds.delete(groupId);
        clearError();
        renderList();
    } catch (e) {
        showError('No se pudo eliminar el grupo.');
    }
}

async function addExercise(groupId, name) {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    try {
        const nuevo = await apiPost('/ejercicios', { nombre: trimmed, id_grupo: groupId });
        const group = state.groups.find(g => g.id_grupo === groupId);
        if (group) {
            group.exercises.push({
                id_ejercicio: nuevo.id_ejercicio,
                nombre: nuevo.nombre,
                id_grupo: groupId,
                logs: [],
                pesoActualKg: 20,
                step: 2.5,
                unit: 'Kg',
                chartMetric: 'peso'
            });
        }
        openGroupIds.add(groupId);
        clearError();
        renderList();
    } catch (e) {
        showError(e.message || 'No se pudo crear el ejercicio.');
    }
}

async function deleteExercise(groupId, exId) {
    try {
        await apiDelete(`/ejercicios/${exId}`);
        const group = state.groups.find(g => g.id_grupo === groupId);
        if (group) group.exercises = group.exercises.filter(e => e.id_ejercicio !== exId);
        expandedExerciseIds.delete(exId);
        if (chartInstances[exId]) {
            chartInstances[exId].destroy();
            delete chartInstances[exId];
        }
        clearError();
        renderList();
    } catch (e) {
        showError('No se pudo eliminar el ejercicio.');
    }
}

// ---------- Búsqueda ----------
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
        searchTerm = e.target.value.toLowerCase();
        applySearchFilter();
    });
}

function applySearchFilter() {
    document.querySelectorAll('.exercise-row').forEach(row => {
        const item = row.closest('.exercise-item');
        const match = !searchTerm || row.dataset.name.includes(searchTerm);
        item.style.display = match ? '' : 'none';
        if (match && searchTerm) {
            item.closest('.muscle-group').classList.add('open');
        }
    });
}

// ---------- Plegar/Desplegar todo ----------
function setupToggleAll() {
    document.getElementById('toggle-all-btn').addEventListener('click', () => {
        allExpanded = !allExpanded;
        document.querySelectorAll('.muscle-group').forEach(group => {
            if (allExpanded) {
                group.classList.add('open');
                openGroupIds.add(Number(group.dataset.id));
            } else {
                group.classList.remove('open');
                openGroupIds.delete(Number(group.dataset.id));
            }
        });
    });
}

// ---------- FAB: añadir grupo ----------
function setupAddGroup() {
    document.getElementById('add-group-fab').addEventListener('click', () => {
        openModal('Nuevo grupo muscular', 'Ej. Piernas', (name) => addGroup(name));
    });
}

// ---------- Modal genérico ----------
function setupModal() {
    const overlay = document.getElementById('input-modal');
    const input = document.getElementById('modal-input');
    const cancelBtn = document.getElementById('modal-cancel');
    const confirmBtn = document.getElementById('modal-confirm');

    function close() {
        overlay.classList.remove('active');
        modalConfirmHandler = null;
    }

    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    confirmBtn.addEventListener('click', () => {
        if (modalConfirmHandler) modalConfirmHandler(input.value);
        close();
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirmBtn.click();
        if (e.key === 'Escape') close();
    });
}

function openModal(title, placeholder, onConfirm) {
    const overlay = document.getElementById('input-modal');
    document.getElementById('modal-title').textContent = title;
    const input = document.getElementById('modal-input');
    input.value = '';
    input.placeholder = placeholder;
    modalConfirmHandler = onConfirm;
    overlay.classList.add('active');
    setTimeout(() => input.focus(), 50);
}

// ---------- Menús laterales ----------
function setupDrawers() {
    const profileBtn = document.getElementById('profile-btn');
    const menuBtn = document.getElementById('menu-btn');
    const profileDrawer = document.getElementById('profile-drawer');
    const menuDrawer = document.getElementById('menu-drawer');
    const overlay = document.getElementById('overlay');

    function openDrawer(drawer) {
        drawer.classList.add('active');
        drawer.setAttribute('aria-hidden', 'false');
        overlay.classList.add('active');
    }

    function closeDrawers() {
        profileDrawer.classList.remove('active');
        menuDrawer.classList.remove('active');
        profileDrawer.setAttribute('aria-hidden', 'true');
        menuDrawer.setAttribute('aria-hidden', 'true');
        overlay.classList.remove('active');
    }

    profileBtn.addEventListener('click', () => openDrawer(profileDrawer));
    menuBtn.addEventListener('click', () => openDrawer(menuDrawer));
    overlay.addEventListener('click', closeDrawers);
    window._closeDrawers = closeDrawers;
}

function setupGlobalEscape() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && window._closeDrawers) window._closeDrawers();
    });
}