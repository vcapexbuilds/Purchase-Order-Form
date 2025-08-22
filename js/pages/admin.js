import auth from '../core/auth.js';
import api from '../core/api.js';
import modal from '../Module/modal.js';

class AdminDashboard {
    constructor() {
        this.initializeAuth();
        this.bindEvents();
        this.loadPOs();
    }

    initializeAuth() {
        if (!auth.isAuthenticated() || !auth.isAdminUser()) {
            window.location.href = '/index.html';
            return;
        }
    }

    bindEvents() {
        document.getElementById('logoutBtn').addEventListener('click', () => auth.logout());
        document.getElementById('newPOBtn').addEventListener('click', () => window.location.href = '/pages/form.html');
        document.getElementById('searchInput').addEventListener('input', () => this.filterPOs());
        document.getElementById('statusFilter').addEventListener('change', () => this.filterPOs());
        document.getElementById('dateFilter').addEventListener('change', () => this.filterPOs());
    }

    async loadPOs() {
        try {
            const pos = await api.getAllPOs();
            this.displayPOs(pos);
        } catch (error) {
            modal.showError('Failed to load POs. Please try again later.');
        }
    }

    displayPOs(pos) {
        const poList = document.getElementById('poList');
        poList.innerHTML = pos.map(po => this.createPOCard(po)).join('');

        // Add event listeners to action buttons
        document.querySelectorAll('.po-action').forEach(button => {
            button.addEventListener('click', (e) => this.handlePOAction(e));
        });
    }

    createPOCard(po) {
        return `
            <div class="po-card" data-po-id="${po.id}">
                <div class="po-header">
                    <h3>${po.meta.projectName}</h3>
                    <span class="status ${po.status}">${po.status}</span>
                </div>
                <div class="po-details">
                    <p><strong>Company:</strong> ${po.meta.companyName}</p>
                    <p><strong>Requested By:</strong> ${po.meta.requestedBy}</p>
                    <p><strong>Contract Amount:</strong> $${po.meta.contractAmount.toLocaleString()}</p>
                    <p><strong>Submitted:</strong> ${new Date(po.createdAt).toLocaleDateString()}</p>
                </div>
                <div class="po-actions">
                    <button class="btn btn-primary po-action" data-action="view" data-po-id="${po.id}">View</button>
                    <button class="btn btn-success po-action" data-action="approve" data-po-id="${po.id}">Approve</button>
                    <button class="btn btn-danger po-action" data-action="reject" data-po-id="${po.id}">Reject</button>
                    <button class="btn btn-secondary po-action" data-action="powerAutomate" data-po-id="${po.id}">Send to Power Automate</button>
                </div>
            </div>
        `;
    }

    async handlePOAction(event) {
        const action = event.target.dataset.action;
        const poId = event.target.dataset.poId;

        switch (action) {
            case 'view':
                this.viewPODetails(poId);
                break;
            case 'approve':
                this.approvePO(poId);
                break;
            case 'reject':
                this.rejectPO(poId);
                break;
            case 'powerAutomate':
                this.sendToPowerAutomate(poId);
                break;
        }
    }

    async viewPODetails(poId) {
        try {
            const po = await api.getPOById(poId);
            modal.show({
                title: 'Purchase Order Details',
                content: this.createPODetailView(po),
                size: 'large',
                actions: [{
                    id: 'close',
                    label: 'Close',
                    class: 'btn-secondary'
                }]
            });
        } catch (error) {
            modal.showError('Failed to load PO details.');
        }
    }

    createPODetailView(po) {
        return `
            <div class="po-detail-view">
                <h3>Project Details</h3>
                <div class="detail-section">
                    <p><strong>Project Name:</strong> ${po.meta.projectName}</p>
                    <p><strong>General Contractor:</strong> ${po.meta.generalContractor}</p>
                    <p><strong>Address:</strong> ${po.meta.address}</p>
                    <p><strong>Project Manager:</strong> ${po.meta.projectManager}</p>
                </div>

                <h3>Financial Details</h3>
                <div class="detail-section">
                    <p><strong>Contract Amount:</strong> $${po.meta.contractAmount.toLocaleString()}</p>
                    <p><strong>Add/Alt Amount:</strong> $${po.meta.addAltAmount.toLocaleString()}</p>
                    <p><strong>Retainage %:</strong> ${po.meta.retainagePct}%</p>
                </div>

                <h3>Schedule</h3>
                <table class="detail-table">
                    <thead>
                        <tr>
                            <th>Prime Line</th>
                            <th>Budget Code</th>
                            <th>Description</th>
                            <th>Qty</th>
                            <th>Unit</th>
                            <th>Total Cost</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${po.schedule.map(item => `
                            <tr>
                                <td>${item.primeLine}</td>
                                <td>${item.budgetCode}</td>
                                <td>${item.description}</td>
                                <td>${item.qty}</td>
                                <td>${item.unit}</td>
                                <td>$${item.totalCost.toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    async approvePO(poId) {
        modal.showConfirm(
            'Are you sure you want to approve this Purchase Order?',
            async () => {
                try {
                    await api.updatePO(poId, { status: 'approved' });
                    modal.showSuccess('Purchase Order approved successfully.');
                    this.loadPOs();
                } catch (error) {
                    modal.showError('Failed to approve Purchase Order.');
                }
            }
        );
    }

    async rejectPO(poId) {
        modal.show({
            title: 'Reject Purchase Order',
            content: `
                <div class="form-group">
                    <label for="rejectReason">Reason for rejection:</label>
                    <textarea id="rejectReason" rows="4"></textarea>
                </div>
            `,
            actions: [
                {
                    id: 'cancel',
                    label: 'Cancel',
                    class: 'btn-secondary'
                },
                {
                    id: 'reject',
                    label: 'Reject',
                    class: 'btn-danger',
                    handler: async () => {
                        const reason = document.getElementById('rejectReason').value;
                        try {
                            await api.updatePO(poId, { 
                                status: 'rejected',
                                rejectionReason: reason 
                            });
                            modal.showSuccess('Purchase Order rejected successfully.');
                            this.loadPOs();
                        } catch (error) {
                            modal.showError('Failed to reject Purchase Order.');
                        }
                    }
                }
            ]
        });
    }

    async sendToPowerAutomate(poId) {
        try {
            const po = await api.getPOById(poId);
            
            // Format data for Power Automate
            const powerAutomateData = {
                poNumber: po.id,
                projectName: po.meta.projectName,
                contractAmount: po.meta.contractAmount,
                vendor: po.meta.companyName,
                requestedBy: po.meta.requestedBy,
                approvalDate: new Date().toISOString(),
                status: 'pending_power_automate'
            };

            // Send to Power Automate webhook URL
            const response = await fetch('YOUR_POWER_AUTOMATE_WEBHOOK_URL', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(powerAutomateData)
            });

            if (response.ok) {
                modal.showSuccess('Successfully sent to Power Automate for processing.');
                await api.updatePO(poId, { status: 'processing' });
                this.loadPOs();
            } else {
                throw new Error('Failed to send to Power Automate');
            }
        } catch (error) {
            modal.showError('Failed to send to Power Automate. Please try again.');
        }
    }

    filterPOs() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const statusFilter = document.getElementById('statusFilter').value;
        const dateFilter = document.getElementById('dateFilter').value;

        const cards = document.querySelectorAll('.po-card');
        cards.forEach(card => {
            const poData = this.extractPODataFromCard(card);
            const matches = this.matchesFilters(poData, searchTerm, statusFilter, dateFilter);
            card.style.display = matches ? 'block' : 'none';
        });
    }

    extractPODataFromCard(card) {
        return {
            projectName: card.querySelector('h3').textContent.toLowerCase(),
            company: card.querySelector('p:nth-child(1)').textContent.toLowerCase(),
            status: card.querySelector('.status').textContent.toLowerCase(),
            date: new Date(card.querySelector('p:nth-child(4)').textContent.split(': ')[1])
        };
    }

    matchesFilters(poData, searchTerm, statusFilter, dateFilter) {
        const matchesSearch = searchTerm === '' || 
            poData.projectName.includes(searchTerm) || 
            poData.company.includes(searchTerm);

        const matchesStatus = statusFilter === '' || poData.status === statusFilter;

        const matchesDate = this.dateFilterMatches(poData.date, dateFilter);

        return matchesSearch && matchesStatus && matchesDate;
    }

    dateFilterMatches(date, filter) {
        if (filter === 'all') return true;

        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(startOfDay);
        startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        switch (filter) {
            case 'today':
                return date >= startOfDay;
            case 'week':
                return date >= startOfWeek;
            case 'month':
                return date >= startOfMonth;
            default:
                return true;
        }
    }
}

// Initialize the admin dashboard
new AdminDashboard();
