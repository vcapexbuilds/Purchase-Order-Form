import api from '../core/api.js';
import storage from '../core/storage.js';

class POForm {
    constructor() {
        // Wait for DOM and scripts to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    initialize() {
        console.log('POForm initialize called');
        console.log('window.auth available:', !!window.auth);
        console.log('window.showConfirmModal available:', !!window.showConfirmModal);
        
        // Wait for global objects to be available
        const checkGlobals = () => {
            if (window.auth && window.showConfirmModal) {
                console.log('Both auth and showConfirmModal are available, initializing...');
                this.initializeAuth();
                this.bindEvents();
                this.loadDraft();
                this.scheduleItemTemplate = this.createScheduleItemTemplate();
                this.scopeItemTemplate = this.createScopeItemTemplate();
            } else {
                console.log('Waiting for globals...', {auth: !!window.auth, modal: !!window.showConfirmModal});
                setTimeout(checkGlobals, 100);
            }
        };
        checkGlobals();
    }

    initializeAuth() {
        // Use global auth object that's loaded via script tag
        if (!window.auth || !window.auth.isAuthenticated()) {
            window.location.href = '/index.html';
            return;
        }

        // Check if we're revising an existing PO
        const urlParams = new URLSearchParams(window.location.search);
        this.revisionId = urlParams.get('revise');
        if (this.revisionId) {
            this.loadExistingPO(this.revisionId);
        }
    }

    bindEvents() {
        console.log('bindEvents called');
        console.log('backBtn element:', document.getElementById('backBtn'));
        console.log('window.showConfirmModal available:', typeof window.showConfirmModal);
        
        const backBtn = document.getElementById('backBtn');
        if (!backBtn) {
            console.error('Back button not found!');
            return;
        }
        
        backBtn.addEventListener('click', (e) => {
            console.log('Back button clicked!', e);
            
            if (typeof window.showConfirmModal === 'function') {
                window.showConfirmModal(
                    'Confirm Navigation',
                    'Are you sure you want to leave? Any unsaved changes will be lost.',
                    () => {
                        console.log('Confirmed, navigating to appropriate dashboard');
                        this.navigateToDashboard();
                    },
                    () => {
                        console.log('Cancelled navigation');
                    }
                );
            } else {
                console.log('showConfirmModal not available, using basic confirm');
                if (confirm('Are you sure you want to leave? Any unsaved changes will be lost.')) {
                    this.navigateToDashboard();
                }
            }
        });

        // Note: Logout button now uses onclick="handleLogout()" in HTML

    document.getElementById('poForm').addEventListener('submit', (e) => this.handleSubmit(e));
    const saveBtn = document.getElementById('saveButton');
    if (saveBtn) saveBtn.addEventListener('click', () => this.saveDraft());
    // Avoid double-binding add item buttons; dynamicForm handles these.

        // Auto-save draft every minute
        setInterval(() => this.saveDraft(true), 60000);
    }

    navigateToDashboard() {
        // Navigate to appropriate dashboard based on user role
        if (window.auth && window.auth.isAuthenticated()) {
            const currentUser = window.auth.getCurrentUser();
            if (currentUser && currentUser.role === 'admin') {
                console.log('Navigating to admin dashboard');
                window.location.href = '../pages/admin.html';
            } else {
                console.log('Navigating to user dashboard (tracking)');
                window.location.href = '../pages/tracking.html';
            }
        } else {
            console.log('User not authenticated, redirecting to login');
            window.location.href = '../index.html';
        }
    }

    async loadExistingPO(poId) {
        try {
            const po = await api.getPOById(poId);
            this.fillFormData(po);
        } catch (error) {
            modal.showError('Failed to load PO data for revision.');
        }
    }

    fillFormData(po) {
        // Fill meta (flat fields)
        const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
        const m = po.meta || {};
        setVal('projectName', m.projectName);
        setVal('generalContractor', m.generalContractor);
        setVal('address', m.address);
        setVal('owner', m.owner);
        setVal('apexOwner', m.apexOwner);
        setVal('typeStatus', m.typeStatus);
        setVal('projectManager', m.projectManager);
        setVal('contractAmount', m.contractAmount);
        setVal('addAltAmount', m.addAltAmount);
        setVal('retainagePct', m.retainagePct);
        setVal('addAltDetails', m.addAltDetails);
        setVal('requestedBy', m.requestedBy);
        setVal('companyName', m.companyName);
        setVal('contactName', m.contactName);
        setVal('email', m.email);
        setVal('cellNumber', m.cellNumber);
        setVal('officeNumber', m.officeNumber);
        setVal('vendorType', m.vendorType);
        setVal('workType', m.workType);

        const d = (m.importantDates) || {};
        setVal('noticeToProceed', d.noticeToProceed);
        setVal('anticipatedStart', d.anticipatedStart);
        setVal('substantialCompletion', d.substantialCompletion);
        setVal('hundredPercent', d.hundredPercent);

        // Populate tables via dynamicForm if available
        if (Array.isArray(po.schedule) && window.dynamicForm) {
            window.dynamicForm.clearAllItems();
            window.dynamicForm.loadScheduleData(po.schedule);
        }
        if (Array.isArray(po.scope) && window.dynamicForm) {
            window.dynamicForm.loadScopeData(po.scope);
        }
    }

    createScheduleItemTemplate() {
        return `
            <div class="schedule-item">
                <div class="form-grid">
                    <div class="form-group">
                        <label>Prime Line *</label>
                        <input type="text" name="primeLine" required>
                    </div>
                    <div class="form-group">
                        <label>Budget Code *</label>
                        <input type="text" name="budgetCode" required>
                    </div>
                    <div class="form-group">
                        <label>Description *</label>
                        <textarea name="description" required></textarea>
                    </div>
                    <div class="form-group">
                        <label>Quantity *</label>
                        <input type="number" name="qty" required>
                    </div>
                    <div class="form-group">
                        <label>Unit *</label>
                        <input type="number" name="unit" required>
                    </div>
                    <div class="form-group">
                        <label>Total Cost *</label>
                        <input type="number" name="totalCost" required>
                    </div>
                    <div class="form-group">
                        <label>Scheduled *</label>
                        <input type="number" name="scheduled" required>
                    </div>
                    <div class="form-group">
                        <label>Apex Contract Value *</label>
                        <input type="number" name="apexContractValue" required>
                    </div>
                </div>
                <button type="button" class="btn btn-danger remove-item">Remove</button>
            </div>
        `;
    }

    createScopeItemTemplate() {
        return `
            <div class="scope-item">
                <div class="form-grid">
                    <div class="form-group">
                        <label>Item Number *</label>
                        <input type="text" name="item" required>
                    </div>
                    <div class="form-group">
                        <label>Description *</label>
                        <textarea name="description" required></textarea>
                    </div>
                    <div class="form-group scope-status">
                        <label>Status *</label>
                        <div>
                            <label>
                                <input type="radio" name="status" value="included" checked> Included
                            </label>
                            <label>
                                <input type="radio" name="status" value="excluded"> Excluded
                            </label>
                        </div>
                    </div>
                </div>
                <button type="button" class="btn btn-danger remove-item">Remove</button>
            </div>
        `;
    }

    addScheduleItem(data = null) {
        const container = document.getElementById('scheduleItems');
        const div = document.createElement('div');
        div.innerHTML = this.scheduleItemTemplate;
        container.appendChild(div.firstElementChild);

        const item = container.lastElementChild;
        if (data) {
            Object.entries(data).forEach(([key, value]) => {
                const input = item.querySelector(`[name="${key}"]`);
                if (input) input.value = value;
            });
        }

        item.querySelector('.remove-item').addEventListener('click', () => {
            modal.showConfirm(
                'Are you sure you want to remove this schedule item?',
                () => item.remove(),
                null
            );
        });
    }

    addScopeItem(data = null) {
        const container = document.getElementById('scopeItems');
        const div = document.createElement('div');
        div.innerHTML = this.scopeItemTemplate;
        container.appendChild(div.firstElementChild);

        const item = container.lastElementChild;
        if (data) {
            Object.entries(data).forEach(([key, value]) => {
                if (key === 'included' || key === 'excluded') {
                    const radio = item.querySelector(`[name="status"][value="${key === 'included' ? 'included' : 'excluded'}"]`);
                    if (radio) radio.checked = value;
                } else {
                    const input = item.querySelector(`[name="${key}"]`);
                    if (input) input.value = value;
                }
            });
        }

        item.querySelector('.remove-item').addEventListener('click', () => {
            modal.showConfirm(
                'Are you sure you want to remove this scope item?',
                () => item.remove(),
                null
            );
        });
    }

    collectFormData() {
        // Build meta object in the requested flat structure
        const val = (id) => {
            const el = document.getElementById(id);
            return el ? el.value : '';
        };
        const num = (id) => {
            const n = Number(val(id));
            return isNaN(n) ? 0 : n;
        };

        const formData = {
            meta: {
                projectName: val('projectName'),
                generalContractor: val('generalContractor'),
                address: val('address'),
                owner: val('owner'),
                apexOwner: val('apexOwner'),
                typeStatus: val('typeStatus'),
                projectManager: val('projectManager'),
                contractAmount: num('contractAmount'),
                addAltAmount: num('addAltAmount'),
                addAltDetails: val('addAltDetails'),
                retainagePct: num('retainagePct'),
                requestedBy: val('requestedBy'),
                companyName: val('companyName'),
                contactName: val('contactName'),
                cellNumber: val('cellNumber'),
                email: val('email'),
                officeNumber: val('officeNumber'),
                vendorType: val('vendorType'),
                workType: val('workType'),
                importantDates: {
                    noticeToProceed: val('noticeToProceed'),
                    anticipatedStart: val('anticipatedStart'),
                    substantialCompletion: val('substantialCompletion'),
                    hundredPercent: val('hundredPercent')
                }
            },
            schedule: (window.dynamicForm && typeof window.dynamicForm.getScheduleItems === 'function')
                ? window.dynamicForm.getScheduleItems()
                : [],
            scope: (window.dynamicForm && typeof window.dynamicForm.getScopeItems === 'function')
                ? window.dynamicForm.getScopeItems()
                : []
        };

        // Add metadata
        formData.createdAt = new Date().toISOString();
        formData.sent = false;
        formData.timestamp = Date.now();
        formData.id = this.revisionId || Date.now();

        return formData;
    }

    saveDraft(silent = false) {
        const formData = this.collectFormData();
        storage.saveDraft(formData);
        if (!silent) {
            modal.showSuccess('Draft saved successfully.');
        }
    }

    loadDraft() {
        if (this.revisionId) return; // Don't load draft if we're revising an existing PO

        const draft = storage.getDraft();
        if (draft) {
            modal.showConfirm(
                'Would you like to load your saved draft?',
                () => this.fillFormData(draft),
                () => storage.clearDraft()
            );
        }
    }

    async handleSubmit(event) {
        event.preventDefault();
        
        try {
            const formData = this.collectFormData();
            
            // Show confirmation modal with summary
            modal.show({
                title: 'Confirm Submission',
                content: this.createSubmissionSummary(formData),
                size: 'large',
                actions: [
                    {
                        id: 'cancel',
                        label: 'Cancel',
                        class: 'btn-secondary'
                    },
                    {
                        id: 'confirm',
                        label: 'Confirm & Submit',
                        class: 'btn-primary',
                        handler: async () => {
                            try {
                                // Show loading modal
                                modal.showLoadingModal('Submitting Purchase Order...');
                                
                                formData.sent = true;
                                formData.sentAt = new Date().toISOString();
                                
                                const result = await api.createPO(formData);
                                
                                // Hide loading modal
                                modal.hideLoadingModal();
                                
                                if (result.success) {
                                    storage.clearDraft();
                                    
                                    // Show detailed success message
                                    const syncStatus = result.syncStatus || 'unknown';
                                    const powerAutomateStatus = syncStatus === 'synced' ? 
                                        '✅ Successfully sent to Power Automate' : 
                                        '⚠️ Saved locally, will retry sending to Power Automate';
                                    
                                    modal.show({
                                        title: 'Purchase Order Submitted Successfully!',
                                        content: `
                                            <div class="success-details">
                                                <p><strong>PO ID:</strong> ${result.po.id}</p>
                                                <p><strong>Status:</strong> ${result.po.status}</p>
                                                <p><strong>Local Storage:</strong> ✅ Saved successfully</p>
                                                <p><strong>Power Automate:</strong> ${powerAutomateStatus}</p>
                                                <p><strong>Submitted At:</strong> ${new Date(result.po.sentAt).toLocaleString()}</p>
                                            </div>
                                        `,
                                        actions: [{
                                            id: 'ok',
                                            label: 'View My POs',
                                            class: 'btn-primary',
                                            handler: () => {
                                                const currentUser = window.auth?.getCurrentUser();
                                                if (currentUser?.role === 'admin') {
                                                    window.location.href = '/pages/admin.html';
                                                } else {
                                                    window.location.href = '/pages/tracking.html';
                                                }
                                            }
                                        }]
                                    });
                                } else {
                                    modal.showErrorModal(
                                        'Submission Failed',
                                        `Failed to submit Purchase Order: ${result.error || 'Unknown error'}`
                                    );
                                }
                            } catch (error) {
                                console.error('Submit error:', error);
                                modal.hideLoadingModal();
                                modal.showErrorModal(
                                    'Submission Failed',
                                    `Failed to submit Purchase Order: ${error.message || 'Network or server error'}`
                                );
                            }
                        }
                    }
                ]
            });
        } catch (error) {
            modal.showError('Failed to prepare submission. Please check your inputs and try again.');
        }
    }

    createSubmissionSummary(data) {
        return `
            <div class="submission-summary">
                <h3>Project Summary</h3>
                <p><strong>Project Name:</strong> ${data.meta.projectName}</p>
                <p><strong>Contract Amount:</strong> $${Number(data.meta.contractAmount).toLocaleString()}</p>
                
                <h3>Schedule Summary</h3>
                <p><strong>Items:</strong> ${data.schedule.length}</p>
                <p><strong>Total Value:</strong> $${data.schedule.reduce((sum, item) => sum + Number(item.totalCost), 0).toLocaleString()}</p>
                
                <h3>Scope Summary</h3>
                <p><strong>Items:</strong> ${data.scope.length}</p>
                <p><strong>Included Items:</strong> ${data.scope.filter(item => item.included).length}</p>
                <p><strong>Excluded Items:</strong> ${data.scope.filter(item => item.excluded).length}</p>
                
                <div class="summary-warning">
                    Please review all information carefully before submitting. 
                    This action cannot be undone.
                </div>
            </div>
        `;
    }
}

// Initialize the form
new POForm();
