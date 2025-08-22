import auth from '../core/auth.js';
import api from '../core/api.js';
import modal from '../Module/modal.js';

class TrackingDashboard {
    constructor() {
        this.initializeAuth();
        this.bindEvents();
        this.loadPOs();
    }

    initializeAuth() {
        if (!auth.isAuthenticated()) {
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
            const pos = await api.getUserPOs();
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
                    <p><strong>Project Manager:</strong> ${po.meta.projectManager}</p>
                    <p><strong>Contract Amount:</strong> $${po.meta.contractAmount.toLocaleString()}</p>
                    <p><strong>Submitted:</strong> ${new Date(po.createdAt).toLocaleDateString()}</p>
                </div>
                <div class="po-actions">
                    <button class="btn btn-primary po-action" data-action="view" data-po-id="${po.id}">View Details</button>
                    ${po.status === 'rejected' ? `
                        <button class="btn btn-warning po-action" data-action="revise" data-po-id="${po.id}">Revise</button>
                    ` : ''}
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
            case 'revise':
                window.location.href = `/pages/form.html?revise=${poId}`;
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

                ${po.status === 'rejected' ? `
                    <div class="rejection-details">
                        <h3>Rejection Details</h3>
                        <p class="rejection-reason">${po.rejectionReason || 'No reason provided'}</p>
                    </div>
                ` : ''}
            </div>
        `;
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
            projectManager: card.querySelector('p:nth-child(1)').textContent.toLowerCase(),
            status: card.querySelector('.status').textContent.toLowerCase(),
            date: new Date(card.querySelector('p:nth-child(3)').textContent.split(': ')[1])
        };
    }

    matchesFilters(poData, searchTerm, statusFilter, dateFilter) {
        const matchesSearch = searchTerm === '' || 
            poData.projectName.includes(searchTerm) || 
            poData.projectManager.includes(searchTerm);

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

// Initialize the tracking dashboard
new TrackingDashboard();
