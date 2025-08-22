// Storage Management System
class StorageManager {
    constructor() {
        this.prefix = 'apex_po_';
        this.users = this.getUsers();
        this.pos = this.getPOs();
        this.currentUser = this.getCurrentUser();
    }

    // Generic storage methods
    set(key, value) {
        try {
            const data = JSON.stringify(value);
            localStorage.setItem(this.prefix + key, data);
            return true;
        } catch (error) {
            console.error('Storage set error:', error);
            return false;
        }
    }

    get(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(this.prefix + key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (error) {
            console.error('Storage get error:', error);
            return defaultValue;
        }
    }

    remove(key) {
        try {
            localStorage.removeItem(this.prefix + key);
            return true;
        } catch (error) {
            console.error('Storage remove error:', error);
            return false;
        }
    }

    clear() {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(this.prefix)) {
                    localStorage.removeItem(key);
                }
            });
            return true;
        } catch (error) {
            console.error('Storage clear error:', error);
            return false;
        }
    }

    // User management
    getUsers() {
        const users = this.get('users', []);
        // Initialize with default admin if no users exist
        if (users.length === 0) {
            const defaultAdmin = {
                id: 1,
                username: 'admin',
                email: 'admin@apex.com',
                password: 'admin123', // In production, this should be hashed
                company: 'Apex Construction',
                role: 'admin',
                status: 'active',
                createdAt: new Date().toISOString()
            };
            users.push(defaultAdmin);
            this.saveUsers(users);
        }
        return users;
    }

    saveUsers(users) {
        this.users = users;
        return this.set('users', users);
    }

    addUser(userData) {
        const newUser = {
            id: this.generateId('user'),
            username: userData.username,
            email: userData.email,
            password: userData.password, // In production, hash this
            company: userData.company,
            role: userData.role || 'user',
            status: userData.status || 'active',
            createdAt: new Date().toISOString()
        };

        this.users.push(newUser);
        this.saveUsers(this.users);
        return newUser;
    }

    updateUser(userId, userData) {
        const userIndex = this.users.findIndex(user => user.id === userId);
        if (userIndex === -1) return null;

        this.users[userIndex] = { ...this.users[userIndex], ...userData };
        this.saveUsers(this.users);
        return this.users[userIndex];
    }

    deleteUser(userId) {
        const userIndex = this.users.findIndex(user => user.id === userId);
        if (userIndex === -1) return false;

        this.users.splice(userIndex, 1);
        this.saveUsers(this.users);
        return true;
    }

    findUser(username, password) {
        return this.users.find(user => 
            user.username === username && 
            user.password === password && 
            user.status === 'active'
        );
    }

    getUserById(userId) {
        return this.users.find(user => user.id === userId);
    }

    // Current user session
    getCurrentUser() {
        return this.get('currentUser');
    }

    setCurrentUser(user) {
        this.currentUser = user;
        return this.set('currentUser', user);
    }

    clearCurrentUser() {
        this.currentUser = null;
        return this.remove('currentUser');
    }

    // Purchase Order management
    getPOs() {
        return this.get('pos', []);
    }

    savePOs(pos) {
        this.pos = pos;
        return this.set('pos', pos);
    }

    addPO(poData) {
        const newPO = {
            ...poData,
            id: this.generateId('po'),
            createdAt: new Date().toISOString(),
            timestamp: Date.now(),
            sent: false,
            sentAt: '',
            userId: this.currentUser ? this.currentUser.id : null,
            status: 'Draft'
        };

        this.pos.push(newPO);
        this.savePOs(this.pos);
        return newPO;
    }

    updatePO(poId, poData) {
        const poIndex = this.pos.findIndex(po => po.id === poId);
        if (poIndex === -1) return null;

        this.pos[poIndex] = { ...this.pos[poIndex], ...poData };
        this.savePOs(this.pos);
        return this.pos[poIndex];
    }

    deletePO(poId) {
        const poIndex = this.pos.findIndex(po => po.id === poId);
        if (poIndex === -1) return false;

        this.pos.splice(poIndex, 1);
        this.savePOs(this.pos);
        return true;
    }

    getPOById(poId) {
        return this.pos.find(po => po.id === poId);
    }

    getUserPOs(userId) {
        return this.pos.filter(po => po.userId === userId);
    }

    // Utility methods
    generateId(type) {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        return parseInt(`${timestamp}${random}`.slice(-10));
    }

    // Schema validation
    validatePOSchema(poData) {
        const requiredFields = [
            'meta.projectName',
            'meta.generalContractor',
            'meta.address',
            'meta.owner',
            'meta.apexOwner',
            'meta.typeStatus',
            'meta.projectManager',
            'meta.contractAmount',
            'meta.requestedBy',
            'meta.companyName',
            'meta.contactName',
            'meta.email',
            'meta.cellNumber',
            'meta.vendorType',
            'meta.workType'
        ];

        const errors = [];
        
        requiredFields.forEach(field => {
            const value = this.getNestedProperty(poData, field);
            if (!value || value === '') {
                errors.push(`${field} is required`);
            }
        });

        // Validate email format
        if (poData.meta && poData.meta.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(poData.meta.email)) {
                errors.push('Invalid email format');
            }
        }

        // Validate amounts are numbers
        if (poData.meta) {
            if (isNaN(poData.meta.contractAmount) || poData.meta.contractAmount < 0) {
                errors.push('Contract amount must be a valid positive number');
            }
            
            if (poData.meta.addAltAmount && (isNaN(poData.meta.addAltAmount) || poData.meta.addAltAmount < 0)) {
                errors.push('Add/Alt amount must be a valid positive number');
            }
            
            if (poData.meta.retainagePct && (isNaN(poData.meta.retainagePct) || poData.meta.retainagePct < 0 || poData.meta.retainagePct > 100)) {
                errors.push('Retainage percentage must be between 0 and 100');
            }
        }

        // Validate schedule items
        if (poData.schedule && Array.isArray(poData.schedule)) {
            poData.schedule.forEach((item, index) => {
                if (!item.primeLine || !item.budgetCode || !item.description) {
                    errors.push(`Schedule item ${index + 1}: Prime Line, Budget Code, and Description are required`);
                }
                if (isNaN(item.qty) || item.qty < 0) {
                    errors.push(`Schedule item ${index + 1}: Quantity must be a valid positive number`);
                }
                if (isNaN(item.unit) || item.unit < 0) {
                    errors.push(`Schedule item ${index + 1}: Unit cost must be a valid positive number`);
                }
            });
        }

        // Validate scope items
        if (poData.scope && Array.isArray(poData.scope)) {
            poData.scope.forEach((item, index) => {
                if (!item.item || !item.description) {
                    errors.push(`Scope item ${index + 1}: Item number and Description are required`);
                }
            });
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    getNestedProperty(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : null;
        }, obj);
    }

    // Statistics methods
    getPOStats(userId = null) {
        let pos = userId ? this.getUserPOs(userId) : this.pos;
        
        const stats = {
            total: pos.length,
            draft: pos.filter(po => po.status === 'Draft').length,
            submitted: pos.filter(po => po.status === 'Submitted').length,
            approved: pos.filter(po => po.status === 'Approved').length,
            rejected: pos.filter(po => po.status === 'Rejected').length,
            totalValue: pos.reduce((sum, po) => sum + (parseFloat(po.meta.contractAmount) || 0), 0),
            avgValue: 0
        };

        stats.avgValue = stats.total > 0 ? stats.totalValue / stats.total : 0;
        
        return stats;
    }

    getUserStats() {
        return {
            total: this.users.length,
            active: this.users.filter(user => user.status === 'active').length,
            inactive: this.users.filter(user => user.status === 'inactive').length,
            admins: this.users.filter(user => user.role === 'admin').length,
            users: this.users.filter(user => user.role === 'user').length
        };
    }

    // Export/Import methods
    exportData(type = 'all') {
        const data = {
            timestamp: new Date().toISOString(),
            version: '1.0'
        };

        switch (type) {
            case 'pos':
                data.pos = this.pos;
                break;
            case 'users':
                data.users = this.users.map(user => ({
                    ...user,
                    password: undefined // Don't export passwords
                }));
                break;
            case 'all':
            default:
                data.pos = this.pos;
                data.users = this.users.map(user => ({
                    ...user,
                    password: undefined
                }));
                break;
        }

        return data;
    }

    importData(data, type = 'all') {
        try {
            if (type === 'pos' || type === 'all') {
                if (data.pos && Array.isArray(data.pos)) {
                    this.savePOs(data.pos);
                }
            }

            if (type === 'users' || type === 'all') {
                if (data.users && Array.isArray(data.users)) {
                    // Don't import users for security reasons in this implementation
                    console.warn('User import disabled for security');
                }
            }

            return true;
        } catch (error) {
            console.error('Import error:', error);
            return false;
        }
    }

    // Search and filter methods
    searchPOs(query, filters = {}, userId = null) {
        let pos = userId ? this.getUserPOs(userId) : this.pos;

        // Apply search query
        if (query) {
            const searchLower = query.toLowerCase();
            pos = pos.filter(po => 
                po.meta.projectName.toLowerCase().includes(searchLower) ||
                po.meta.companyName.toLowerCase().includes(searchLower) ||
                po.meta.generalContractor.toLowerCase().includes(searchLower) ||
                po.meta.contactName.toLowerCase().includes(searchLower) ||
                po.id.toString().includes(searchLower)
            );
        }

        // Apply filters
        if (filters.status && filters.status !== '') {
            pos = pos.filter(po => po.status === filters.status);
        }

        if (filters.dateFrom) {
            const fromDate = new Date(filters.dateFrom);
            pos = pos.filter(po => new Date(po.createdAt) >= fromDate);
        }

        if (filters.dateTo) {
            const toDate = new Date(filters.dateTo);
            toDate.setHours(23, 59, 59, 999); // Include full day
            pos = pos.filter(po => new Date(po.createdAt) <= toDate);
        }

        if (filters.minAmount) {
            const minAmount = parseFloat(filters.minAmount);
            pos = pos.filter(po => parseFloat(po.meta.contractAmount) >= minAmount);
        }

        if (filters.maxAmount) {
            const maxAmount = parseFloat(filters.maxAmount);
            pos = pos.filter(po => parseFloat(po.meta.contractAmount) <= maxAmount);
        }

        if (filters.contractor) {
            const contractorLower = filters.contractor.toLowerCase();
            pos = pos.filter(po => 
                po.meta.generalContractor.toLowerCase().includes(contractorLower)
            );
        }

        if (filters.userId && filters.userId !== '') {
            pos = pos.filter(po => po.userId === parseInt(filters.userId));
        }

        return pos;
    }

    // Pagination helper
    paginateResults(items, page = 1, limit = 10) {
        const offset = (page - 1) * limit;
        const paginatedItems = items.slice(offset, offset + limit);

        return {
            items: paginatedItems,
            currentPage: page,
            totalPages: Math.ceil(items.length / limit),
            totalItems: items.length,
            hasNext: page < Math.ceil(items.length / limit),
            hasPrev: page > 1
        };
    }
}

// Initialize storage manager
const storage = new StorageManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageManager;
}