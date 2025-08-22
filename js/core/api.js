// API and Power Automate Integration
class APIManager {
    constructor() {
        // ⚠️ CRITICAL: JSON structure must match POWER_AUTOMATE_GUIDE.md exactly
        // Any deviation will cause HTTP 400 schema validation errors
        
        // Load Power Automate HTTP trigger URL from environment variable or secure config
        this.POWER_AUTOMATE_URL = (typeof process !== 'undefined' && process.env && process.env.POWER_AUTOMATE_URL)
            ? process.env.POWER_AUTOMATE_URL
            : (window && window.POWER_AUTOMATE_URL ? window.POWER_AUTOMATE_URL : 
                'https://defaulta543e2f6ae4b4d1db263a38786ce68.44.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/146de521bc3a415d9dbbdfec5476be38/triggers/manual/paths/invoke/?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=_bSEuYWnBRzJs_p7EvROZXVi6KLitzuyOtIlD7lEqLA');
        
        // Configuration
        this.config = {
            timeout: 30000, // 30 seconds
            retryAttempts: 3,
            retryDelay: 1000, // 1 second
            enableSync: true // Enable/disable Power Automate sync
        };
        
        // Queue for failed requests
        this.failedRequests = [];
        
        // Initialize
        this.init();
    }

    init() {
        // Check for pending failed requests on startup
        this.processPendingRequests();
        
        // Set up periodic sync check
        this.startPeriodicSync();
        
        // Listen for online/offline events
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
    }

    // Generic HTTP request method
    async makeRequest(url, options = {}) {
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: this.config.timeout
        };

        const requestOptions = { ...defaultOptions, ...options };

        console.log('🌐 Making HTTP request:', {
            url: url,
            method: requestOptions.method,
            headers: requestOptions.headers,
            bodyLength: requestOptions.body ? requestOptions.body.length : 0
        });

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                console.log('⏰ Request timeout after', requestOptions.timeout, 'ms');
                controller.abort();
            }, requestOptions.timeout);

            const response = await fetch(url, {
                ...requestOptions,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            console.log('📡 Response received:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok,
                headers: Object.fromEntries(response.headers.entries())
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.log('❌ Response error body:', errorText);
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            }

            // Try to parse JSON response
            let data;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
                console.log('📄 Non-JSON response:', data);
            }
            
            console.log('✅ Request successful, data:', data);
            return { success: true, data };

        } catch (error) {
            console.error('❌ Request failed:', {
                url: url,
                error: error.message,
                name: error.name
            });
            
            if (error.name === 'AbortError') {
                return { success: false, error: 'Request timeout' };
            }
            
            return { success: false, error: error.message };
        }
    }

    // Sync data with Power Automate
    async syncWithPowerAutomate(action, data, retryCount = 0) {
        if (!this.config.enableSync) {
            console.log('Power Automate sync is disabled');
            return { success: true, message: 'Sync disabled' };
        }

        try {
            const payload = {
                action: action,
                data: data,
                timestamp: new Date().toISOString(),
                userId: auth.getCurrentUser()?.id || null,
                userInfo: auth.getCurrentUser() || null
            };

            const response = await this.makeRequest(this.POWER_AUTOMATE_URL, {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            if (response.success) {
                console.log(`Power Automate sync successful: ${action}`);
                return response;
            } else {
                throw new Error(response.error);
            }

        } catch (error) {
            console.error(`Power Automate sync failed: ${action}`, error);

            // Retry logic
            if (retryCount < this.config.retryAttempts) {
                console.log(`Retrying sync in ${this.config.retryDelay}ms... (${retryCount + 1}/${this.config.retryAttempts})`);
                
                await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * (retryCount + 1)));
                return this.syncWithPowerAutomate(action, data, retryCount + 1);
            }

            // Add to failed requests queue
            this.addToFailedQueue(action, data);

            return {
                success: false,
                error: error.message,
                queued: true
            };
        }
    }

    // Purchase Order API methods
    async createPO(poData) {
        try {
            // Validate PO data
            const validation = storage.validatePOSchema(poData);
            if (!validation.isValid) {
                return {
                    success: false,
                    errors: validation.errors
                };
            }

            // Save locally first
            const savedPO = storage.addPO(poData);
            
            // Update status to submitted
            const submittedPO = storage.updatePO(savedPO.id, {
                sent: true,
                sentAt: new Date().toISOString(),
                status: 'Submitted'
            });

            // Send shaped payload directly (not wrapped in action/data)
            const shaped = this.shapePOForSend(submittedPO);
            const syncResult = await this.syncDirectly(shaped);

            return {
                success: true,
                po: submittedPO,
                syncStatus: syncResult.success ? 'synced' : 'queued',
                message: 'Purchase Order created successfully'
            };

        } catch (error) {
            console.error('Create PO error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async updatePO(poId, updateData) {
        try {
            // Update locally
            const updatedPO = storage.updatePO(poId, {
                ...updateData,
                updatedAt: new Date().toISOString()
            });

            if (!updatedPO) {
                throw new Error('Purchase Order not found');
            }

            // Send shaped payload directly
            const shaped = this.shapePOForSend(updatedPO);
            const syncResult = await this.syncDirectly(shaped);

            return {
                success: true,
                po: updatedPO,
                syncStatus: syncResult.success ? 'synced' : 'queued',
                message: 'Purchase Order updated successfully'
            };

        } catch (error) {
            console.error('Update PO error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Shape PO to the requested HTTP schema
    shapePOForSend(po) {
        if (!po) return po;
        
        const meta = po.meta || {};
        
        // Ensure proper data types - Power Automate expects specific types
        const shaped = {
            meta: {
                projectName: String(meta.projectName || ""),
                generalContractor: String(meta.generalContractor || ""),
                address: String(meta.address || ""),
                owner: String(meta.owner || ""),
                apexOwner: String(meta.apexOwner || ""),
                typeStatus: String(meta.typeStatus || ""),
                projectManager: String(meta.projectManager || ""),
                contractAmount: parseInt(meta.contractAmount) || 0,
                addAltAmount: parseInt(meta.addAltAmount) || 0,
                addAltDetails: String(meta.addAltDetails || ""),
                retainagePct: parseInt(meta.retainagePct) || 0,
                requestedBy: String(meta.requestedBy || ""),
                companyName: String(meta.companyName || ""),
                contactName: String(meta.contactName || ""),
                cellNumber: String(meta.cellNumber || ""),
                email: String(meta.email || ""),
                officeNumber: String(meta.officeNumber || ""),
                vendorType: String(meta.vendorType || ""),
                workType: String(meta.workType || ""),
                importantDates: {
                    noticeToProceed: String((meta.importantDates?.noticeToProceed) || ""),
                    anticipatedStart: String((meta.importantDates?.anticipatedStart) || ""),
                    substantialCompletion: String((meta.importantDates?.substantialCompletion) || ""),
                    hundredPercent: String((meta.importantDates?.hundredPercent) || "")
                }
            },
            schedule: Array.isArray(po.schedule) ? po.schedule.map(item => ({
                primeLine: String(item.primeLine || ""),
                budgetCode: String(item.budgetCode || ""),
                description: String(item.description || ""),
                qty: parseInt(item.qty) || 0,
                unit: parseInt(item.unit) || 0,
                totalCost: parseInt(item.totalCost) || 0,
                scheduled: parseInt(item.scheduled) || 0,
                apexContractValue: parseInt(item.apexContractValue) || 0,
                profit: parseInt(item.profit) || 0
            })) : [],
            scope: Array.isArray(po.scope) ? po.scope.map(item => ({
                item: String(item.item || ""),
                description: String(item.description || ""),
                included: Boolean(item.included),
                excluded: Boolean(item.excluded)
            })) : [],
            createdAt: String(po.createdAt || new Date().toISOString()),
            sent: Boolean(po.sent),
            timestamp: parseInt(po.timestamp) || Date.now(),
            id: parseInt(po.id) || Math.floor(Date.now() / 1000), // Ensure integer ID
            sentAt: String(po.sentAt || new Date().toISOString())
        };
        
        console.log('🔄 Shaped PO for Power Automate (with profit field):', JSON.stringify(shaped, null, 2));
        return shaped;
    }

    // Send payload directly to Power Automate without wrapper, with retry and queue handling
    async syncDirectly(data, retryCount = 0) {
        if (!this.config.enableSync) {
            console.log('Power Automate sync is disabled');
            return { success: true, message: 'Sync disabled' };
        }

        console.log('=== POWER AUTOMATE SYNC ATTEMPT ===');
        console.log('URL:', this.POWER_AUTOMATE_URL);
        console.log('Data being sent:', JSON.stringify(data, null, 2));
        console.log('Retry count:', retryCount);

        try {
            const response = await this.makeRequest(this.POWER_AUTOMATE_URL, {
                method: 'POST',
                body: JSON.stringify(data),
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            if (response.success) {
                console.log('✅ Power Automate sync successful');
                console.log('Response:', response.data);
                return response;
            } else {
                console.error('❌ Power Automate sync failed:', response.error);
                throw new Error(response.error);
            }

        } catch (error) {
            console.error('❌ Power Automate sync failed with error:', error);
            console.log('Error details:', {
                message: error.message,
                name: error.name,
                stack: error.stack
            });

            // Retry logic
            if (retryCount < this.config.retryAttempts) {
                console.log(`🔄 Retrying direct sync in ${this.config.retryDelay}ms... (${retryCount + 1}/${this.config.retryAttempts})`);
                await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * (retryCount + 1)));
                return this.syncDirectly(data, retryCount + 1);
            }

            console.log('❌ All retry attempts exhausted, adding to failed queue');
            // Add to failed requests queue
            this.addToFailedQueue('DIRECT_SYNC', data);

            return {
                success: false,
                error: error.message,
                queued: true
            };
        }
    }

    async deletePO(poId) {
        try {
            // Get PO data before deletion
            const po = storage.getPOById(poId);
            if (!po) {
                throw new Error('Purchase Order not found');
            }

            // Delete locally
            const deleted = storage.deletePO(poId);
            if (!deleted) {
                throw new Error('Failed to delete Purchase Order');
            }

            // Sync with Power Automate
            const syncResult = await this.syncWithPowerAutomate('DELETE_PO', { id: poId, ...po });

            return {
                success: true,
                syncStatus: syncResult.success ? 'synced' : 'queued',
                message: 'Purchase Order deleted successfully'
            };

        } catch (error) {
            console.error('Delete PO error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getPOs(filters = {}, userId = null) {
        try {
            // Get from local storage
            const pos = storage.searchPOs(filters.query || '', filters, userId);
            
            // Apply pagination if specified
            let result = pos;
            if (filters.page && filters.limit) {
                result = storage.paginateResults(pos, filters.page, filters.limit);
            }

            return {
                success: true,
                data: result,
                message: 'Purchase Orders retrieved successfully'
            };

        } catch (error) {
            console.error('Get POs error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getPOById(poId) {
        try {
            const po = storage.getPOById(poId);
            
            if (!po) {
                throw new Error('Purchase Order not found');
            }

            return {
                success: true,
                data: po,
                message: 'Purchase Order retrieved successfully'
            };

        } catch (error) {
            console.error('Get PO by ID error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // User management API methods (Admin only)
    async createUser(userData) {
        try {
            if (!auth.hasPermission('manage_users')) {
                throw new Error('Insufficient permissions');
            }

            // Register user
            const result = await auth.register(userData);
            
            if (result.success) {
                // Sync with Power Automate
                const syncResult = await this.syncWithPowerAutomate('CREATE_USER', result.user);
                
                return {
                    success: true,
                    user: result.user,
                    syncStatus: syncResult.success ? 'synced' : 'queued',
                    message: 'User created successfully'
                };
            } else {
                throw new Error(result.message);
            }

        } catch (error) {
            console.error('Create user error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async updateUser(userId, userData) {
        try {
            if (!auth.hasPermission('manage_users')) {
                throw new Error('Insufficient permissions');
            }

            const updatedUser = storage.updateUser(userId, userData);
            
            if (!updatedUser) {
                throw new Error('User not found');
            }

            // Sync with Power Automate
            const syncResult = await this.syncWithPowerAutomate('UPDATE_USER', updatedUser);

            return {
                success: true,
                user: updatedUser,
                syncStatus: syncResult.success ? 'synced' : 'queued',
                message: 'User updated successfully'
            };

        } catch (error) {
            console.error('Update user error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async deleteUser(userId) {
        try {
            if (!auth.hasPermission('manage_users')) {
                throw new Error('Insufficient permissions');
            }

            // Get user data before deletion
            const user = storage.getUserById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Delete user
            const deleted = storage.deleteUser(userId);
            if (!deleted) {
                throw new Error('Failed to delete user');
            }

            // Sync with Power Automate
            const syncResult = await this.syncWithPowerAutomate('DELETE_USER', { id: userId, ...user });

            return {
                success: true,
                syncStatus: syncResult.success ? 'synced' : 'queued',
                message: 'User deleted successfully'
            };

        } catch (error) {
            console.error('Delete user error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getUsers() {
        try {
            if (!auth.hasPermission('manage_users')) {
                throw new Error('Insufficient permissions');
            }

            const users = storage.getUsers();
            
            return {
                success: true,
                data: users,
                message: 'Users retrieved successfully'
            };

        } catch (error) {
            console.error('Get users error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Statistics API methods
    async getStats(userId = null) {
        try {
            const poStats = storage.getPOStats(userId);
            const userStats = auth.hasPermission('manage_users') ? storage.getUserStats() : null;

            return {
                success: true,
                data: {
                    pos: poStats,
                    users: userStats
                },
                message: 'Statistics retrieved successfully'
            };

        } catch (error) {
            console.error('Get stats error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Export data
    async exportData(type = 'all', format = 'json') {
        try {
            const data = storage.exportData(type);
            
            if (format === 'json') {
                return {
                    success: true,
                    data: data,
                    filename: `apex_po_export_${type}_${new Date().toISOString().split('T')[0]}.json`,
                    message: 'Data exported successfully'
                };
            }
            
            // Could add CSV export here
            throw new Error('Unsupported export format');

        } catch (error) {
            console.error('Export error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Failed request queue management
    addToFailedQueue(action, data) {
        const failedRequest = {
            id: Date.now() + Math.random(),
            action,
            data,
            timestamp: new Date().toISOString(),
            attempts: 0
        };

        this.failedRequests.push(failedRequest);
        
        // Save to local storage for persistence
        storage.set('failedRequests', this.failedRequests);
    }

    async processPendingRequests() {
        // Load failed requests from storage
        const savedFailedRequests = storage.get('failedRequests', []);
        this.failedRequests = savedFailedRequests;

        if (this.failedRequests.length === 0) return;

        console.log(`Processing ${this.failedRequests.length} pending requests...`);

        const processedRequests = [];

        for (const request of this.failedRequests) {
            try {
                request.attempts++;
                
                const result = await this.syncWithPowerAutomate(request.action, request.data);
                
                if (result.success) {
                    console.log(`Successfully processed pending request: ${request.action}`);
                    processedRequests.push(request);
                } else if (request.attempts >= this.config.retryAttempts) {
                    console.log(`Giving up on failed request after ${request.attempts} attempts: ${request.action}`);
                    processedRequests.push(request);
                }
                
            } catch (error) {
                console.error(`Failed to process pending request: ${request.action}`, error);
            }
        }

        // Remove processed requests
        this.failedRequests = this.failedRequests.filter(
            request => !processedRequests.includes(request)
        );

        // Update storage
        storage.set('failedRequests', this.failedRequests);
    }

    // Network status handlers
    handleOnline() {
        console.log('Connection restored. Processing pending requests...');
        this.processPendingRequests();
    }

    handleOffline() {
        console.log('Connection lost. New requests will be queued.');
    }

    // Periodic sync
    startPeriodicSync() {
        // Process pending requests every 5 minutes
        setInterval(() => {
            if (navigator.onLine && this.failedRequests.length > 0) {
                this.processPendingRequests();
            }
        }, 5 * 60 * 1000);
    }

    // Configuration methods
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        storage.set('apiConfig', this.config);
    }

    getConfig() {
        return { ...this.config };
    }

    // Health check
    async healthCheck() {
        try {
            const result = await this.makeRequest(this.POWER_AUTOMATE_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'HEALTH_CHECK',
                    timestamp: new Date().toISOString()
                })
            });

            return {
                success: result.success,
                online: navigator.onLine
            };
        } catch (error) {
            return {
                success: false,
                online: false
            };
        }
    }
}