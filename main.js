/**
 * Enhanced main.js with auto-formatting, validation, and improved UX
 * Maintains JSON structure as specified
 */
(() => {
  'use strict';

  /* ==================== CONFIGURATION ==================== */
  const DEFAULT_REMOTE = {
    endpoint: 'https://defaulta543e2f6ae4b4d1db263a38786ce68.44.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/146de521bc3a415d9dbbdfec5476be38/triggers/manual/paths/invoke/?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=_bSEuYWnBRzJs_p7EvROZXVi6KLitzuyOtIlD7lEqLA',
    apiKey: '3.14159265358979323846264'
  };

  const LS_REMOTE_CFG = 'apex_remote_cfg';
  const LS_ADMIN_PIN = 'apex_admin_pin';
  const LS_DARK_MODE = 'apex_dark_mode';
  const LS_DRAFT = 'apex_form_draft';

  const DB_NAME = 'ApexProjectDB';
  const DB_VERSION = 1;
  const STORE_SUBMISSIONS = 'submissions';

  const DEFAULT_PIN = '1234';
  const RETRY_INTERVAL_MS = 5 * 60 * 1000;
  const AUTO_SAVE_DELAY = 2000;

  /* ==================== STATE MANAGEMENT ==================== */
  let db = null;
  let remoteConfig = loadRemoteConfig();
  let retryTimer = null;
  let autoSaveTimer = null;
  let isDarkMode = false;
  let currentAdminFilter = 'all'; // all|sent|pending

  /* ==================== INITIALIZATION ==================== */
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      await initDB();
    } catch (e) {
      console.error('DB init failed', e);
    }

    // Initialize all features
    initDarkMode();
    initAutoFormatting();
    initValidation();
    initAutoSave();
    initFileUpload();
    
    // Wire up functionality
    wirePageNavigation();
    wireScheduleTable();
    wireScopeTable();
    wireFormSubmission();
    wireAdminDrawer();
    wireClearButtons();
    
    // Load saved draft
    loadDraft();

    // Expose for debugging
    window.recalcRow = recalcRow;
    window.ApexStorage = {
      saveSubmissionLocal,
      getPendingSubmissions,
      getAllSubmissions,
      markSubmissionSent,
      attemptPushAll,
      testPost,
      getRemoteConfig,
      persistRemoteConfig,
      getSubmissionById,
      deleteSubmission
    };

    // Start background sync
    attemptPushAll().catch(() => {});
    retryTimer = setInterval(() => attemptPushAll().catch(() => {}), RETRY_INTERVAL_MS);
    window.addEventListener('online', () => attemptPushAll().catch(() => {}));
  });

  /* ==================== DATABASE FUNCTIONS ==================== */
  function initDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (ev) => {
        const _db = ev.target.result;
        if (!_db.objectStoreNames.contains(STORE_SUBMISSIONS)) {
          const store = _db.createObjectStore(STORE_SUBMISSIONS, {
            keyPath: 'id',
            autoIncrement: true
          });
          store.createIndex('sent', 'sent', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
      req.onsuccess = (ev) => {
        db = ev.target.result;
        resolve();
      };
      req.onerror = reject;
    });
  }

  function saveSubmissionLocal(entry) {
    return new Promise((resolve, reject) => {
      if (!db) return reject(new Error('DB not ready'));
      entry = { ...entry, timestamp: Date.now(), sent: !!entry.sent };
      const tx = db.transaction(STORE_SUBMISSIONS, 'readwrite');
      const req = tx.objectStore(STORE_SUBMISSIONS).add(entry);
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = reject;
    });
  }

  function getAllSubmissions() {
    return new Promise((resolve, reject) => {
      if (!db) return reject(new Error('DB not ready'));
      const tx = db.transaction(STORE_SUBMISSIONS, 'readonly');
      const req = tx.objectStore(STORE_SUBMISSIONS).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = reject;
    });
  }

  function getPendingSubmissions() {
    return new Promise((resolve, reject) => {
      if (!db) return reject(new Error('DB not ready'));
      const tx = db.transaction(STORE_SUBMISSIONS, 'readonly');
      const req = tx.objectStore(STORE_SUBMISSIONS).index('sent').getAll(false);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = reject;
    });
  }

  function getSubmissionById(id) {
    return new Promise((resolve, reject) => {
      if (!db) return reject(new Error('DB not ready'));
      const tx = db.transaction(STORE_SUBMISSIONS, 'readonly');
      const req = tx.objectStore(STORE_SUBMISSIONS).get(Number(id));
      req.onsuccess = () => resolve(req.result);
      req.onerror = reject;
    });
  }

  function deleteSubmission(id) {
    return new Promise((resolve, reject) => {
      if (!db) return reject(new Error('DB not ready'));
      const tx = db.transaction(STORE_SUBMISSIONS, 'readwrite');
      const req = tx.objectStore(STORE_SUBMISSIONS).delete(Number(id));
      req.onsuccess = resolve;
      req.onerror = reject;
    });
  }

  function markSubmissionSent(id) {
    return new Promise((resolve, reject) => {
      if (!db) return reject(new Error('DB not ready'));
      const tx = db.transaction(STORE_SUBMISSIONS, 'readwrite');
      const store = tx.objectStore(STORE_SUBMISSIONS);
      const getReq = store.get(Number(id));
      getReq.onsuccess = () => {
        const rec = getReq.result;
        if (!rec) return resolve();
        rec.sent = true;
        rec.sentAt = new Date().toISOString();
        store.put(rec).onsuccess = resolve;
      };
      getReq.onerror = reject;
    });
  }

  /* ==================== REMOTE SYNC FUNCTIONS ==================== */
  function loadRemoteConfig() {
    try {
      const raw = localStorage.getItem(LS_REMOTE_CFG);
      return raw ? { ...DEFAULT_REMOTE, ...JSON.parse(raw) } : DEFAULT_REMOTE;
    } catch (e) {
      console.warn(e);
      return DEFAULT_REMOTE;
    }
  }

  function persistRemoteConfig(cfg) {
    remoteConfig = { ...remoteConfig, ...cfg };
    try {
      localStorage.setItem(LS_REMOTE_CFG, JSON.stringify(remoteConfig));
    } catch (e) {}
  }

  function getRemoteConfig() {
    return remoteConfig;
  }

  async function postToRemote(entry) {
    const cfg = getRemoteConfig();
    if (!cfg.endpoint) throw new Error('No remote endpoint configured');

    const payload = { ...entry };
    delete payload.id;

    const res = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cfg.apiKey || ''
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Remote error ${res.status} ${res.statusText} ${txt}`);
    }
    return res;
  }

  async function testPost() {
    return postToRemote({
      test: true,
      ts: new Date().toISOString(),
      source: 'admin_test'
    });
  }

  async function attemptPushAll() {
    if (!navigator.onLine || !db) return;

    const pending = await getPendingSubmissions();
    if (!pending.length) return;

    for (const entry of pending) {
      try {
        await postToRemote(entry);
        if (entry.id) await markSubmissionSent(entry.id);
      } catch (err) {
        console.warn('Push failed for id:', entry.id, err);
      }
    }

    if (window.__renderAdminList) window.__renderAdminList();
  }

  /* ==================== AUTO-FORMATTING FUNCTIONS ==================== */
  function initAutoFormatting() {
    // Currency formatting
    document.querySelectorAll('.currency-input, [data-type="currency"]').forEach(input => {
      input.addEventListener('input', handleCurrencyInput);
      input.addEventListener('blur', formatCurrency);
      input.addEventListener('focus', unformatCurrency);
    });

    // Percentage formatting
    document.querySelectorAll('.percent-input, [data-type="percent"]').forEach(input => {
      input.addEventListener('input', handlePercentInput);
      input.addEventListener('blur', formatPercent);
    });

    // Phone formatting
    document.querySelectorAll('.phone-input, [data-type="phone"]').forEach(input => {
      input.addEventListener('input', handlePhoneInput);
    });

    // Email validation
    document.querySelectorAll('[data-type="email"]').forEach(input => {
      input.addEventListener('blur', validateEmail);
    });
  }

  function handleCurrencyInput(e) {
    let value = e.target.value.replace(/[^\d.-]/g, '');
    if (value) {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        e.target.dataset.rawValue = num;
      }
    }
  }

  function formatCurrency(e) {
    const raw = parseFloat(e.target.dataset.rawValue || e.target.value.replace(/[^\d.-]/g, ''));
    if (!isNaN(raw)) {
      e.target.value = raw.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }
  }

  function unformatCurrency(e) {
    const raw = e.target.dataset.rawValue || e.target.value.replace(/[^\d.-]/g, '');
    e.target.value = raw;
  }

  function handlePercentInput(e) {
    let value = e.target.value.replace(/[^\d.-]/g, '');
    if (value) {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        // Clamp between 0 and 100
        const clamped = Math.max(0, Math.min(100, num));
        e.target.dataset.rawValue = clamped;
        if (e.target.id === 'retainage') {
          updateRetainageNote(clamped);
        }
      }
    }
  }

  function formatPercent(e) {
    const raw = parseFloat(e.target.dataset.rawValue || e.target.value);
    if (!isNaN(raw)) {
      e.target.value = raw.toFixed(2);
    }
  }

  function handlePhoneInput(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 0) {
      if (value.startsWith('63')) {
        // Philippine format
        if (value.length <= 2) {
          value = '+' + value;
        } else if (value.length <= 5) {
          value = '+' + value.slice(0, 2) + ' ' + value.slice(2);
        } else if (value.length <= 8) {
          value = '+' + value.slice(0, 2) + ' ' + value.slice(2, 5) + ' ' + value.slice(5);
        } else {
          value = '+' + value.slice(0, 2) + ' ' + value.slice(2, 5) + ' ' + value.slice(5, 8) + ' ' + value.slice(8, 12);
        }
      } else {
        // Generic format
        if (value.length <= 3) {
          value = value;
        } else if (value.length <= 6) {
          value = value.slice(0, 3) + ' ' + value.slice(3);
        } else if (value.length <= 10) {
          value = value.slice(0, 3) + ' ' + value.slice(3, 6) + ' ' + value.slice(6);
        } else {
          value = value.slice(0, 3) + ' ' + value.slice(3, 6) + ' ' + value.slice(6, 10);
        }
      }
      e.target.value = value;
    }
  }

  function validateEmail(e) {
    const isValid = !e.target.value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.target.value);
    e.target.classList.toggle('input-valid', isValid && e.target.value);
    e.target.classList.toggle('input-invalid', !isValid && e.target.value);
  }

  function updateRetainageNote(value) {
    const note = document.getElementById('retainageNote');
    if (note) {
      if (value > 10) {
        note.textContent = '⚠️ High retainage percentage';
        note.className = 'note warning';
      } else if (value > 0) {
        note.textContent = `✓ ${value}% will be retained`;
        note.className = 'note success';
      } else {
        note.textContent = '';
      }
    }
  }

  /* ==================== VALIDATION FUNCTIONS ==================== */
  function initValidation() {
    const requiredFields = ['projectName', 'companyName', 'generalContractor'];

    requiredFields.forEach(id => {
      const field = document.getElementById(id);
      if (field) {
        field.addEventListener('blur', () => validateField(field));
        field.addEventListener('input', () => {
          if (field.classList.contains('input-invalid')) {
            validateField(field);
          }
        });
      }
    });
  }

  function validateField(field) {
    const isValid = field.value.trim() !== '';
    field.classList.toggle('input-valid', isValid);
    field.classList.toggle('input-invalid', !isValid);

    const msg = field.parentElement.querySelector('.validation-message');
    if (msg) {
      msg.classList.toggle('show', !isValid);
    }

    return isValid;
  }

  function validatePage1() {
    const projectName = document.getElementById('projectName');
    const companyName = document.getElementById('companyName');

    const projectValid = validateField(projectName);
    const companyValid = validateField(companyName);

    if (!projectValid && !companyValid) {
      return confirm('Both Project Name and Company Name are empty. Continue anyway?');
    }
    return true;
  }

  /* ==================== AUTO-SAVE FUNCTIONS ==================== */
  function initAutoSave() {
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        clearTimeout(autoSaveTimer);
        showAutoSaveIndicator('saving');
        autoSaveTimer = setTimeout(() => {
          saveDraft();
          showAutoSaveIndicator('saved');
        }, AUTO_SAVE_DELAY);
      });
    });
  }

  function showAutoSaveIndicator(status) {
    const indicator = document.getElementById('autoSaveIndicator');
    const text = document.getElementById('autoSaveText');
    const spinner = indicator?.querySelector('.spinner');

    if (indicator && text) {
      indicator.className = `auto-save-indicator show ${status}`;

      if (status === 'saving') {
        text.textContent = 'Saving...';
        if (spinner) spinner.style.display = 'inline-block';
      } else if (status === 'saved') {
        text.textContent = '✓ All changes saved';
        if (spinner) spinner.style.display = 'none';
        setTimeout(() => {
          indicator.classList.remove('show');
        }, 3000);
      }
    }
  }

  function saveDraft() {
    const draft = collectFormData();
    try {
      localStorage.setItem(LS_DRAFT, JSON.stringify(draft));
    } catch (e) {
      console.warn('Failed to save draft:', e);
    }
  }

  function loadDraft() {
    try {
      const draft = localStorage.getItem(LS_DRAFT);
      if (draft) {
        const data = JSON.parse(draft);
        populateFormData(data);
        showAutoSaveIndicator('saved');
      }
    } catch (e) {
      console.warn('Failed to load draft:', e);
    }
  }

  function populateFormData(data) {
    if (!data || !data.meta) return;

    // Populate page 1 fields
    Object.keys(data.meta).forEach(key => {
      if (key !== 'importantDates') {
        const el = document.getElementById(key);
        if (el) {
          el.value = data.meta[key] || '';
          // Trigger formatting for special inputs
          if (el.classList.contains('currency-input')) {
            el.dataset.rawValue = data.meta[key];
            formatCurrency({ target: el });
          } else if (el.classList.contains('percent-input')) {
            el.dataset.rawValue = data.meta[key];
            formatPercent({ target: el });
          }
        }
      }
    });

    // Populate dates
    if (data.meta.importantDates) {
      Object.keys(data.meta.importantDates).forEach(key => {
        const el = document.getElementById(key);
        if (el) el.value = data.meta.importantDates[key] || '';
      });
    }

    // Populate schedule table
    if (data.schedule && data.schedule.length) {
      const tbody = document.getElementById('scheduleTableBody');
      tbody.innerHTML = '';
      data.schedule.forEach(row => {
        addScheduleRow(row);
      });
    }

    // Populate scope table
    if (data.scope && data.scope.length) {
      const tbody = document.getElementById('page3Body');
      tbody.innerHTML = '';
      data.scope.forEach(row => {
        addScopeRow(row);
      });
    }
  }

  /* ==================== FILE UPLOAD ==================== */
  function initFileUpload() {
    const fileInput = document.getElementById('costFileUpload');
    const fileName = document.getElementById('costFileName');
    const fileWarning = document.getElementById('fileWarning');

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          fileName.textContent = `📎 ${file.name}`;
          fileName.className = 'note success';

          // Check file size (5MB limit)
          if (file.size > 5 * 1024 * 1024) {
            fileWarning.textContent = '⚠️ File size exceeds 5MB';
            fileWarning.style.display = 'block';
          } else {
            fileWarning.style.display = 'none';
          }
        } else {
          fileName.textContent = 'No file chosen';
          fileName.className = 'note';
          fileWarning.style.display = 'none';
        }
      });
    }
  }

  /* ==================== DARK MODE ==================== */
  function initDarkMode() {
    const container = document.getElementById('appContainer');
    const toggleBtn = document.getElementById('btnToggleDark');
    const darkModeText = document.getElementById('darkModeText');

    if (!container || !toggleBtn) return;

    // Load saved preference
    try {
      const saved = localStorage.getItem(LS_DARK_MODE);
      isDarkMode = saved === '1';
      if (isDarkMode) {
        container.classList.add('dark');
        darkModeText.textContent = '☀️ Light';
      }
    } catch (e) {}

    toggleBtn.addEventListener('click', () => {
      isDarkMode = !isDarkMode;
      container.classList.toggle('dark', isDarkMode);
      darkModeText.textContent = isDarkMode ? '☀️ Light' : '🌙 Dark';

      try {
        localStorage.setItem(LS_DARK_MODE, isDarkMode ? '1' : '0');
      } catch (e) {}
    });
  }

  /* ==================== PAGE NAVIGATION ==================== */
  function wirePageNavigation() {
    document.getElementById('nextPage1')?.addEventListener('click', () => {
      if (validatePage1()) showPage(2);
    });
    document.getElementById('nextFromPage2')?.addEventListener('click', () => showPage(3));
    document.getElementById('prevFromPage2')?.addEventListener('click', () => showPage(1));
    document.getElementById('prevFromPage3')?.addEventListener('click', () => showPage(2));
  }

  function showPage(n) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById('page' + n);
    if (page) {
      page.classList.add('active');

      // Update progress bar
      const progress = document.getElementById('progressBar');
      if (progress) {
        progress.style.width = ((n / 3) * 100) + '%';
      }

      // Update page 2 header fields
      if (n === 2) {
        document.getElementById('subcontractor').value = document.getElementById('companyName').value || '';
        document.getElementById('sovProjectName').value = document.getElementById('projectName').value || '';
        document.getElementById('projectLocation').value = document.getElementById('address').value || '';
      }

      // Update page 3 display fields
      if (n === 3) {
        populatePage3Header();
      }
    }
  }

  function populatePage3Header() {
    const mappings = [
      ['page3_projectName_display', 'projectName'],
      ['page3_category_display', 'typeStatus'],
      ['page3_projectManager_display', 'projectManager'],
      ['page3_company_display', 'companyName'],
      ['page3_contact_display', 'contactName'],
      ['page3_email_display', 'email'],
      ['page3_cell_display', 'cellNumber'],
      ['page3_tel_display', 'officeNumber']
    ];

    mappings.forEach(([targetId, sourceId]) => {
      const target = document.getElementById(targetId);
      const source = document.getElementById(sourceId);
      if (target && source) {
        target.value = source.value || '';
      }
    });
  }

  /* ==================== SCHEDULE TABLE ==================== */
  function wireScheduleTable() {
    document.getElementById('addRowPage2')?.addEventListener('click', () => addScheduleRow());

    const tbody = document.getElementById('scheduleTableBody');
    if (tbody) {
      tbody.addEventListener('click', (e) => {
        if (e.target.matches('.remove-row')) {
          e.target.closest('tr').remove();
          renumberSchedule();
          updateScheduleTotals();
        }
      });

      tbody.addEventListener('input', (e) => {
        const row = e.target.closest('tr');
        if (row) recalcRow(row);
      });

      tbody.addEventListener('blur', (e) => {
        if (e.target.matches('.currency-input')) {
          formatTableCurrency(e.target);
        }
      }, true);

      tbody.addEventListener('focus', (e) => {
        if (e.target.matches('.currency-input')) {
          unformatTableCurrency(e.target);
        }
      }, true);
    }
  }

  function addScheduleRow(data = null) {
    const tbody = document.getElementById('scheduleTableBody');
    if (!tbody) return;

    const idx = tbody.querySelectorAll('tr').length + 1;
    const tr = document.createElement('tr');
    
    const rowData = data || {
      primeLine: '',
      budgetCode: '',
      description: '',
      qty: 0,
      unit: 0,
      scheduled: 0,
      apexContractValue: 0
    };

    tr.innerHTML = `
      <td>${idx}</td>
      <td><input class="tbl-input" value="${rowData.primeLine}" placeholder="Line item"></td>
      <td><input class="tbl-input" value="${rowData.budgetCode}" placeholder="Code"></td>
      <td><input class="tbl-input" value="${rowData.description}" placeholder="Description"></td>
      <td><input class="tbl-input qty number-input" value="${rowData.qty}" type="number" min="0" step="0.01"></td>
      <td><input class="tbl-input unit currency-input" value="${rowData.unit}" type="number" min="0" step="0.01"></td>
      <td class="totalCost">$0.00</td>
      <td><input class="tbl-input scheduled currency-input" value="${rowData.scheduled}" type="number" min="0" step="0.01"></td>
      <td><input class="tbl-input apexVal currency-input" value="${rowData.apexContractValue}" type="number" min="0" step="0.01"></td>
      <td class="profit">$0.00</td>
      <td><button class="small-action-btn remove-row" title="Remove row">×</button></td>
    `;
    
    tbody.appendChild(tr);
    renumberSchedule();
    recalcRow(tr);
  }

  function formatTableCurrency(input) {
    const value = parseFloat(input.value);
    if (!isNaN(value)) {
      input.value = value.toFixed(2);
    }
  }

  function unformatTableCurrency(input) {
    const value = input.value.replace(/[^\d.-]/g, '');
    input.value = value;
  }

  function renumberSchedule() {
    const tbody = document.getElementById('scheduleTableBody');
    if (!tbody) return;

    tbody.querySelectorAll('tr').forEach((row, i) => {
      if (row.cells[0]) row.cells[0].textContent = (i + 1).toString();
    });
  }

  function recalcRow(row) {
    const qtyInput = row.querySelector('.qty');
    const unitInput = row.querySelector('.unit');
    const apexInput = row.querySelector('.apexVal');
    const totalCell = row.querySelector('.totalCost');
    const profitCell = row.querySelector('.profit');

    const qty = parseFloat(qtyInput?.value || 0) || 0;
    const unit = parseFloat(unitInput?.value || 0) || 0;
    const apex = parseFloat(apexInput?.value || 0) || 0;

    const total = qty * unit;
    const profit = apex - total;

    if (totalCell) {
      totalCell.textContent = '$' + total.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }

    if (profitCell) {
      profitCell.className = profit >= 0 ? 'profit profit-positive' : 'profit profit-negative';
      const profitText = Math.abs(profit).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      profitCell.textContent = profit >= 0 ? '$' + profitText : '($' + profitText + ')';
    }

    updateScheduleTotals();
  }

  function updateScheduleTotals() {
    let totalCost = 0, totalScheduled = 0, totalApex = 0;

    const tbody = document.getElementById('scheduleTableBody');
    if (!tbody) return;

    tbody.querySelectorAll('tr').forEach(row => {
      const costCell = row.querySelector('.totalCost');
      const scheduledInput = row.querySelector('.scheduled');
      const apexInput = row.querySelector('.apexVal');

      const cost = parseFloat(costCell?.textContent.replace(/[^\d.-]/g, '') || 0) || 0;
      const scheduled = parseFloat(scheduledInput?.value || 0) || 0;
      const apex = parseFloat(apexInput?.value || 0) || 0;

      totalCost += cost;
      totalScheduled += scheduled;
      totalApex += apex;
    });

    const profit = totalApex - totalCost;

    const formatCurrency = (val) => '$' + Math.abs(val).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    document.getElementById('totalCost').textContent = formatCurrency(totalCost);
    document.getElementById('totalScheduled').textContent = formatCurrency(totalScheduled);
    document.getElementById('totalApex').textContent = formatCurrency(totalApex);

    const profitEl = document.getElementById('totalProfit');
    if (profitEl) {
      profitEl.className = profit >= 0 ? 'profit-positive' : 'profit-negative';
      profitEl.textContent = profit >= 0 ? formatCurrency(profit) : '(' + formatCurrency(profit) + ')';
    }
  }

  /* ==================== SCOPE TABLE ==================== */
  function wireScopeTable() {
    document.getElementById('addRowPage3')?.addEventListener('click', () => addScopeRow());

    const tbody = document.getElementById('page3Body');
    if (tbody) {
      tbody.addEventListener('click', (e) => {
        if (e.target.matches('.remove-scope')) {
          e.target.closest('tr').remove();
          renumberScope();
        }
      });

      tbody.addEventListener('change', (e) => {
        if (e.target.matches('.incChk') || e.target.matches('.excChk')) {
          toggleIncludeExclude(e.target);
        }
      });
    }
  }

  function addScopeRow(data = null) {
    const tbody = document.getElementById('page3Body');
    if (!tbody) return;

    const idx = tbody.querySelectorAll('tr').length + 1;
    const tr = document.createElement('tr');
    
    const rowData = data || {
      description: '',
      included: false,
      excluded: false
    };

    tr.innerHTML = `
      <td>${idx}</td>
      <td><input class="tbl-input scope-desc" value="${rowData.description}" placeholder="Enter description"></td>
      <td style="text-align: center;">
        <input type="checkbox" class="incChk" ${rowData.included ? 'checked' : ''}>
      </td>
      <td style="text-align: center;">
        <input type="checkbox" class="excChk" ${rowData.excluded ? 'checked' : ''}>
      </td>
      <td style="text-align: center;">
        <button class="small-action-btn remove-scope" title="Remove row">×</button>
      </td>
    `;
    
    tbody.appendChild(tr);
    renumberScope();
  }

  function renumberScope() {
    const tbody = document.getElementById('page3Body');
    if (!tbody) return;

    tbody.querySelectorAll('tr').forEach((row, i) => {
      if (row.cells[0]) row.cells[0].textContent = (i + 1).toString();
    });
  }

  function toggleIncludeExclude(checkbox) {
    const row = checkbox.closest('tr');
    if (!row) return;

    const inc = row.querySelector('.incChk');
    const exc = row.querySelector('.excChk');

    if (checkbox === inc && inc.checked) {
      exc.checked = false;
    } else if (checkbox === exc && exc.checked) {
      inc.checked = false;
    }
  }

  /* ==================== FORM SUBMISSION ==================== */
  function wireFormSubmission() {
    document.getElementById('btnSubmitForm')?.addEventListener('click', onSubmitForm);
  }

  async function onSubmitForm() {
    try {
      const data = collectFormData();

      // Validate minimum requirements
      if (!data.meta.projectName && !data.meta.companyName) {
        if (!confirm('Both Project Name and Company Name are empty. Submit anyway?')) {
          showPage(1);
          return;
        }
      }

      // Save to database
      const id = await saveSubmissionLocal({ ...data, sent: false });
      console.info('Saved locally with id:', id);

      // Clear draft
      try {
        localStorage.removeItem(LS_DRAFT);
      } catch (e) {}

      // Try to push
      try {
        await attemptPushAll();
      } catch (e) {
        console.warn('Push failed (queued):', e);
      }

      // Success feedback
      const submitBtn = document.getElementById('btnSubmitForm');
      submitBtn.classList.add('success-pulse');
      setTimeout(() => submitBtn.classList.remove('success-pulse'), 1000);

      // Success message
      alert('✅ Form submitted successfully!' + 
            (navigator.onLine ? ' Data will be synced.' : ' (Offline - will sync when connected)'));

      // Clear form
      if (confirm('Would you like to start a new form?')) {
        clearAllForms();
        showPage(1);
      }
    } catch (err) {
      console.error('Submit failed:', err);
      alert('❌ Failed to submit: ' + (err.message || err));
    }
  }

  function collectFormData() {
    const getValue = (id) => {
      const el = document.getElementById(id);
      if (!el) return '';

      // Handle currency inputs
      if (el.classList.contains('currency-input') || el.dataset.type === 'currency') {
        return parseFloat(el.dataset.rawValue || el.value.replace(/[^\d.-]/g, '')) || 0;
      }

      // Handle percentage inputs
      if (el.classList.contains('percent-input') || el.dataset.type === 'percent') {
        return parseFloat(el.dataset.rawValue || el.value) || 0;
      }

      return el.value || '';
    };

    // Build metadata (matching JSON structure)
    const meta = {
      projectName: getValue('projectName'),
      generalContractor: getValue('generalContractor'),
      address: getValue('address'),
      owner: getValue('owner'),
      apexOwner: getValue('apexOwner'),
      typeStatus: getValue('typeStatus'),
      projectManager: getValue('projectManager'),
      contractAmount: getValue('contractAmount'),
      addAltAmount: getValue('addAltAmount'),
      addAltDetails: getValue('addAltDetails'),
      retainagePct: getValue('retainage'),
      requestedBy: getValue('requestedBy'),
      companyName: getValue('companyName'),
      contactName: getValue('contactName'),
      cellNumber: getValue('cellNumber'),
      email: getValue('email'),
      officeNumber: getValue('officeNumber'),
      vendorType: getValue('vendorType'),
      workType: getValue('workType'),
      importantDates: {
        noticeToProceed: getValue('noticeToProceed'),
        anticipatedStart: getValue('anticipatedStart'),
        substantialCompletion: getValue('substantialCompletion'),
        hundredPercent: getValue('hundredPercent')
      }
    };

    // Collect schedule
    const schedule = [];
    document.querySelectorAll('#scheduleTableBody tr').forEach(row => {
      const qty = parseFloat(row.querySelector('.qty')?.value || 0);
      const unit = parseFloat(row.querySelector('.unit')?.value || 0);
      const totalCost = qty * unit;
      const apexVal = parseFloat(row.querySelector('.apexVal')?.value || 0);
      
      schedule.push({
        primeLine: row.cells[1].querySelector('input')?.value || '',
        budgetCode: row.cells[2].querySelector('input')?.value || '',
        description: row.cells[3].querySelector('input')?.value || '',
        qty: qty,
        unit: unit,
        totalCost: totalCost,
        scheduled: parseFloat(row.querySelector('.scheduled')?.value || 0),
        apexContractValue: apexVal,
        profit: apexVal - totalCost
      });
    });

    // Collect scope
    const scope = [];
    document.querySelectorAll('#page3Body tr').forEach(row => {
      scope.push({
        item: row.cells[0]?.textContent || '',
        description: row.cells[1].querySelector('input')?.value || '',
        included: row.querySelector('.incChk')?.checked || false,
        excluded: row.querySelector('.excChk')?.checked || false
      });
    });

    return {
      meta,
      schedule,
      scope,
      createdAt: new Date().toISOString()
    };
  }

  /* ==================== CLEAR BUTTONS ==================== */
  function wireClearButtons() {
    // Page 1
    document.getElementById('btnClearPage1')?.addEventListener('click', () => {
      if (confirm('Clear all fields on this page?')) clearPage1();
    });
    document.getElementById('btnClearAll1')?.addEventListener('click', () => {
      if (confirm('Clear ALL form data? This cannot be undone.')) clearAllForms();
    });

    // Page 2
    document.getElementById('btnClearPage2')?.addEventListener('click', () => {
      if (confirm('Clear all schedule entries?')) clearPage2();
    });
    document.getElementById('btnClearAll2')?.addEventListener('click', () => {
      if (confirm('Clear ALL form data? This cannot be undone.')) clearAllForms();
    });

    // Page 3
    document.getElementById('btnClearPage3')?.addEventListener('click', () => {
      if (confirm('Clear all scope entries?')) clearPage3();
    });
    document.getElementById('btnClearAll3')?.addEventListener('click', () => {
      if (confirm('Clear ALL form data? This cannot be undone.')) clearAllForms();
    });
  }

  function clearPage1() {
    document.querySelectorAll('#page1 input, #page1 select, #page1 textarea').forEach(el => {
      el.value = '';
      el.classList.remove('input-valid', 'input-invalid');
      delete el.dataset.rawValue;
    });
    document.getElementById('retainageNote').textContent = '';
    document.getElementById('costFileName').textContent = 'No file chosen';
  }

  function clearPage2() {
    document.getElementById('scheduleTableBody').innerHTML = '';
    updateScheduleTotals();
  }

  function clearPage3() {
    document.getElementById('page3Body').innerHTML = '';
  }

  function clearAllForms() {
    clearPage1();
    clearPage2();
    clearPage3();
    try {
      localStorage.removeItem(LS_DRAFT);
    } catch (e) {}
    showAutoSaveIndicator('saved');
  }

  /* ==================== ADMIN PANEL ==================== */
  function wireAdminDrawer() {
    const btnAdmin = document.getElementById('btnAdmin');
    const adminDrawer = document.getElementById('adminDrawer');
    const adminClose = document.getElementById('adminClose');
    const saveBtn = document.getElementById('saveAdminBtn');
    const testBtn = document.getElementById('btnTestPost');
    const pushBtn = document.getElementById('btnPushPending');
    const refreshBtn = document.getElementById('btnRefreshAdmin');
    const selectAll = document.getElementById('adminSelectAll');

    if (!btnAdmin || !adminDrawer) return;

    // Load config
    const cfg = getRemoteConfig();
    document.getElementById('admin_remote_endpoint').value = cfg.endpoint || '';
    document.getElementById('admin_api_key').value = cfg.apiKey || '';

    btnAdmin.addEventListener('click', () => {
      const storedPin = localStorage.getItem(LS_ADMIN_PIN) || DEFAULT_PIN;
      const attempt = prompt('Enter Admin PIN:');
      if (attempt === storedPin) {
        adminDrawer.classList.add('active');
        renderAdminList();
      } else {
        alert('❌ Incorrect PIN');
      }
    });

    adminClose?.addEventListener('click', () => {
      adminDrawer.classList.remove('active');
    });

    saveBtn?.addEventListener('click', () => {
      const endpoint = document.getElementById('admin_remote_endpoint').value.trim();
      const apiKey = document.getElementById('admin_api_key').value.trim();
      const newPin = document.getElementById('admin_pin').value;

      persistRemoteConfig({ endpoint, apiKey });
      showAdminStatus('✅ Configuration saved', 'success');

      if (newPin && newPin.length >= 4) {
        try {
          localStorage.setItem(LS_ADMIN_PIN, newPin);
          document.getElementById('admin_pin').value = '';
          showAdminStatus('✅ PIN updated', 'success');
        } catch (e) {
          showAdminStatus('❌ Failed to save PIN', 'error');
        }
      }
    });

    testBtn?.addEventListener('click', async () => {
      showAdminStatus('🔄 Testing connection...', 'info');
      try {
        await testPost();
        showAdminStatus('✅ Test successful!', 'success');
      } catch (err) {
        showAdminStatus('❌ Test failed: ' + err.message, 'error');
      }
    });

    pushBtn?.addEventListener('click', async () => {
      showAdminStatus('📤 Pushing pending submissions...', 'info');
      try {
        await attemptPushAll();
        showAdminStatus('✅ Push completed', 'success');
        renderAdminList();
      } catch (err) {
        showAdminStatus('❌ Push failed: ' + err.message, 'error');
      }
    });

    refreshBtn?.addEventListener('click', renderAdminList);

    selectAll?.addEventListener('change', (e) => {
      document.querySelectorAll('.admin-row-select').forEach(cb => {
        cb.checked = e.target.checked;
      });
    });

    // Wire up table actions
    wireAdminTableActions();

    // Wire up modal
    wireAdminModal();

    // Wire up bulk actions
    wireBulkActions();

    // Expose render function
    window.__renderAdminList = renderAdminList;
  }

  function showAdminStatus(message, type) {
    const status = document.getElementById('adminStatus');
    if (!status) return;

    status.textContent = message;
    status.style.display = 'block';
    status.style.background = type === 'error' ? 'rgba(220, 38, 38, 0.1)' :
                             type === 'success' ? 'rgba(22, 163, 74, 0.1)' :
                             'rgba(245, 158, 11, 0.1)';
    status.style.color = type === 'error' ? 'var(--danger)' :
                        type === 'success' ? 'var(--success)' :
                        'var(--warning)';
    status.style.border = `1px solid ${status.style.color}`;
    status.style.borderRadius = 'var(--input-radius)';
    status.style.padding = '8px 12px';

    if (type !== 'info') {
      setTimeout(() => {
        status.style.display = 'none';
      }, 5000);
    }
  }

  async function renderAdminList() {
    const tbody = document.getElementById('adminTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;"><span class="spinner"></span> Loading...</td></tr>';

    try {
      const submissions = await getAllSubmissions();

      // Apply filter
      let filtered = submissions;
      if (currentAdminFilter === 'sent') {
        filtered = submissions.filter(s => s.sent === true);
      } else if (currentAdminFilter === 'pending') {
        filtered = submissions.filter(s => !s.sent);
      }

      if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No submissions found</td></tr>';
        return;
      }

      const rows = filtered
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .map(sub => {
          const date = sub.createdAt ? new Date(sub.createdAt).toLocaleString() :
                       sub.timestamp ? new Date(sub.timestamp).toLocaleString() : '—';
          const project = sub.meta?.projectName || sub.meta?.companyName || '—';
          const status = sub.sent ?
            '<span style="color: var(--success); font-weight: 600;">✓ Sent</span>' :
            '<span style="color: var(--warning); font-weight: 600;">⏳ Pending</span>';

          return `
            <tr data-id="${sub.id}">
              <td><input type="checkbox" class="admin-row-select" data-id="${sub.id}"></td>
              <td>${sub.id}</td>
              <td>${escapeHtml(project)}</td>
              <td>${date}</td>
              <td>${status}</td>
              <td>
                <button class="btn btn-secondary admin-view" data-id="${sub.id}" style="padding: 4px 8px; font-size: 0.75rem;">👁️</button>
                <button class="btn btn-primary admin-resend" data-id="${sub.id}" style="padding: 4px 8px; font-size: 0.75rem;">📤</button>
                <button class="btn btn-secondary admin-delete" data-id="${sub.id}" style="padding: 4px 8px; font-size: 0.75rem;">🗑️</button>
              </td>
            </tr>
          `;
        }).join('');

      tbody.innerHTML = rows;
      document.getElementById('adminSelectAll').checked = false;
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--danger);">Failed to load: ${err.message}</td></tr>`;
    }
  }

  function wireAdminTableActions() {
    const tbody = document.getElementById('adminTableBody');

    tbody?.addEventListener('click', async (e) => {
      const id = e.target.dataset.id;
      if (!id) return;

      if (e.target.matches('.admin-view')) {
        const sub = await getSubmissionById(id);
        openAdminModal(sub);
      } else if (e.target.matches('.admin-resend')) {
        if (confirm('Resend this submission?')) {
          try {
            const sub = await getSubmissionById(id);
            await postToRemote(sub);
            await markSubmissionSent(id);
            showAdminStatus('✅ Resent successfully', 'success');
            renderAdminList();
          } catch (err) {
            showAdminStatus('❌ Resend failed: ' + err.message, 'error');
          }
        }
      } else if (e.target.matches('.admin-delete')) {
        if (confirm('Delete this submission? This cannot be undone.')) {
          try {
            await deleteSubmission(id);
            showAdminStatus('✅ Deleted', 'success');
            renderAdminList();
          } catch (err) {
            showAdminStatus('❌ Delete failed', 'error');
          }
        }
      }
    });
  }

  function wireBulkActions() {
    const resendBtn = document.getElementById('btnResendSelected');
    const deleteBtn = document.getElementById('btnDeleteSelected');

    resendBtn?.addEventListener('click', async () => {
      const selected = getSelectedIds();
      if (!selected.length) {
        alert('Please select submissions to resend');
        return;
      }

      if (confirm(`Resend ${selected.length} submission(s)?`)) {
        showAdminStatus(`📤 Resending ${selected.length} items...`, 'info');

        let successCount = 0;
        for (const id of selected) {
          try {
            const sub = await getSubmissionById(id);
            await postToRemote(sub);
            await markSubmissionSent(id);
            successCount++;
          } catch (err) {
            console.warn('Failed to resend id:', id, err);
          }
        }

        showAdminStatus(`✅ Resent ${successCount}/${selected.length} items`, 'success');
        renderAdminList();
      }
    });

    deleteBtn?.addEventListener('click', async () => {
      const selected = getSelectedIds();
      if (!selected.length) {
        alert('Please select submissions to delete');
        return;
      }

      if (confirm(`Delete ${selected.length} submission(s)? This cannot be undone.`)) {
        for (const id of selected) {
          try {
            await deleteSubmission(id);
          } catch (err) {
            console.warn('Failed to delete id:', id, err);
          }
        }

        showAdminStatus('✅ Deleted selected items', 'success');
        renderAdminList();
      }
    });
  }

  function getSelectedIds() {
    const checkboxes = document.querySelectorAll('.admin-row-select:checked');
    return Array.from(checkboxes).map(cb => Number(cb.dataset.id));
  }

  function wireAdminModal() {
    const modal = document.getElementById('adminModal');
    const modalClose = document.getElementById('adminModalClose');
    const modalBody = document.getElementById('adminModalBody');

    modalClose?.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    modal?.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  }

  function openAdminModal(submission) {
    const modal = document.getElementById('adminModal');
    const modalBody = document.getElementById('adminModalBody');

    if (modal && modalBody) {
      modalBody.textContent = JSON.stringify(submission, null, 2);
      modal.style.display = 'flex';
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

})();