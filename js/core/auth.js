// Authentication System
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
        this.demoAccounts = {
            admin: {
                email: 'admin@demo.com',
                username: 'admin',
                password: 'admin123',
                role: 'admin',
                name: 'Demo Admin',
                company: 'Apex Building'
            },
            user: {
                email: 'user@demo.com',
                username: 'user',
                password: 'user123',
                role: 'user',
                name: 'Demo User',
                company: 'Test Company'
            }
        };
        this.init();
    }

    init() {
        // Check for existing session
        this.checkSession();
        
        // Set up session monitoring
        this.startSessionMonitoring();
        
        // Handle page navigation auth checks
        this.handlePageSecurity();
    }

    // Login method
    async login(emailOrUsername, password) {
        try {
            // Demo account validation
            const demoAdmin = this.demoAccounts.admin;
            const demoUser = this.demoAccounts.user;

            let user = null;

            // Check for demo admin (support both email and username)
            if ((emailOrUsername === demoAdmin.email || emailOrUsername === demoAdmin.username) && password === demoAdmin.password) {
                user = { ...demoAdmin };
            }
            // Check for demo user (support both email and username)
            else if ((emailOrUsername === demoUser.email || emailOrUsername === demoUser.username) && password === demoUser.password) {
                user = { ...demoUser };
            }

            if (!user) {
                throw new Error('Invalid credentials');
            }

            // Create session
            const sessionData = {
                id: user.id || user.username, // Use username as fallback ID
                username: user.username || user.name,
                email: user.email,
                company: user.company,
                role: user.role,
                loginTime: new Date().toISOString(),
                expiresAt: new Date(Date.now() + this.sessionTimeout).toISOString()
            };

            // Store session
            storage.setCurrentUser(sessionData);
            this.currentUser = sessionData;

            // Update user's last login
            storage.updateUser(user.id, {
                lastLogin: new Date().toISOString()
            });

            return {
                success: true,
                user: sessionData,
                message: 'Login successful'
            };

        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    // Register method
    async register(userData) {
        try {
            // Validate inputs
            const required = ['username', 'email', 'password', 'company'];
            for (const field of required) {
                if (!userData[field]) {
                    throw new Error(`${field} is required`);
                }
            }

            // Check if username already exists
            const existingUser = storage.users.find(user => 
                user.username.toLowerCase() === userData.username.toLowerCase()
            );
            
            if (existingUser) {
                throw new Error('Username already exists');
            }

            // Check if email already exists
            const existingEmail = storage.users.find(user => 
                user.email.toLowerCase() === userData.email.toLowerCase()
            );
            
            if (existingEmail) {
                throw new Error('Email already exists');
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(userData.email)) {
                throw new Error('Invalid email format');
            }

            // Validate password strength
            if (userData.password.length < 6) {
                throw new Error('Password must be at least 6 characters long');
            }

            // Create new user
            const newUser = storage.addUser({
                username: userData.username,
                email: userData.email,
                password: userData.password, // In production, hash this
                company: userData.company,
                role: 'user' // Default role
            });

            return {
                success: true,
                user: newUser,
                message: 'Registration successful'
            };

        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    // Logout method
    logout() {
        try {
            // Clear session data
            storage.clearCurrentUser();
            this.currentUser = null;

            // Redirect to login
            this.redirectToLogin();

            return {
                success: true,
                message: 'Logged out successfully'
            };

        } catch (error) {
            return {
                success: false,
                message: 'Error during logout'
            };
        }
    }

    // Check if user is authenticated
    isAuthenticated() {
        if (!this.currentUser) {
            return false;
        }

        // Check if session has expired
        if (new Date() > new Date(this.currentUser.expiresAt)) {
            this.logout();
            return false;
        }

        return true;
    }

    // Check if user has specific role
    hasRole(role) {
        return this.isAuthenticated() && this.currentUser.role === role;
    }

    // Check if user is admin
    isAdmin() {
        return this.hasRole('admin');
    }

    // Check if user is regular user
    isUser() {
        return this.hasRole('user');
    }

    // Get current user info
    getCurrentUser() {
        return this.isAuthenticated() ? this.currentUser : null;
    }

    // Check and restore session from storage
    checkSession() {
        const sessionData = storage.getCurrentUser();
        
        if (sessionData) {
            // Check if session is still valid
            if (new Date() <= new Date(sessionData.expiresAt)) {
                this.currentUser = sessionData;
                return true;
            } else {
                // Session expired, clear it
                storage.clearCurrentUser();
                return false;
            }
        }
        
        return false;
    }

    // Extend session
    extendSession() {
        if (this.currentUser) {
            this.currentUser.expiresAt = new Date(Date.now() + this.sessionTimeout).toISOString();
            storage.setCurrentUser(this.currentUser);
        }
    }

    // Start monitoring session
    startSessionMonitoring() {
        // Check session every 5 minutes
        setInterval(() => {
            if (this.currentUser) {
                const now = new Date();
                const expiresAt = new Date(this.currentUser.expiresAt);
                
                // Warn user 10 minutes before session expires
                const timeUntilExpiry = expiresAt - now;
                if (timeUntilExpiry <= 10 * 60 * 1000 && timeUntilExpiry > 0) {
                    this.showSessionWarning();
                }
                
                // Auto-logout when session expires
                if (now >= expiresAt) {
                    this.handleSessionExpiry();
                }
            }
        }, 5 * 60 * 1000); // 5 minutes

        // Extend session on user activity
        ['click', 'keypress', 'scroll', 'mousemove'].forEach(eventType => {
            document.addEventListener(eventType, () => {
                if (this.currentUser && Date.now() % 30000 === 0) { // Throttle to every 30 seconds
                    this.extendSession();
                }
            }, { passive: true });
        });
    }

    // Show session warning modal
    showSessionWarning() {
        // This would typically show a modal warning the user
        console.warn('Session will expire in 10 minutes');
        
        // You could implement a modal here
        if (typeof showModal === 'function') {
            showModal('Session Warning', 'Your session will expire in 10 minutes. Click OK to extend it.', [
                {
                    text: 'Extend Session',
                    class: 'btn-primary',
                    action: () => this.extendSession()
                },
                {
                    text: 'Logout',
                    class: 'btn-secondary',
                    action: () => this.logout()
                }
            ]);
        }
    }

    // Handle session expiry
    handleSessionExpiry() {
        // Show expiry message
        if (typeof showModal === 'function') {
            showModal('Session Expired', 'Your session has expired. Please log in again.', [
                {
                    text: 'OK',
                    class: 'btn-primary',
                    action: () => this.logout()
                }
            ]);
        } else {
            alert('Your session has expired. Please log in again.');
            this.logout();
        }
    }

    // Handle page security based on authentication
    handlePageSecurity() {
        const currentPath = window.location.pathname;
        const filename = currentPath.split('/').pop() || 'index.html';
        
        // Define protected pages
        const protectedPages = {
            'form.html': ['user', 'admin'],
            'tracking.html': ['user', 'admin'],
            'admin.html': ['admin']
        };

        // Check if current page requires authentication
        if (protectedPages[filename]) {
            if (!this.isAuthenticated()) {
                this.redirectToLogin();
                return;
            }

            // Check role-based access
            const requiredRoles = protectedPages[filename];
            if (!requiredRoles.includes(this.currentUser.role)) {
                this.redirectToUnauthorized();
                return;
            }
        }

        // Redirect authenticated users away from login page
        if (filename === 'index.html' && this.isAuthenticated()) {
            this.redirectToDashboard();
        }
    }

    // Redirect to login page
    redirectToLogin() {
        const currentPath = window.location.pathname;
        const isInPages = currentPath.includes('/pages/');
        const loginPath = isInPages ? '../index.html' : 'index.html';
        
        window.location.href = loginPath;
    }

    // Redirect to dashboard based on role
    redirectToDashboard() {
        if (this.isAdmin()) {
            window.location.href = 'pages/admin.html';
        } else {
            window.location.href = 'pages/tracking.html';
        }
    }

    // Redirect to unauthorized page or show message
    redirectToUnauthorized() {
        alert('You do not have permission to access this page.');
        this.redirectToDashboard();
    }

    // Update user profile
    async updateProfile(updateData) {
        try {
            if (!this.isAuthenticated()) {
                throw new Error('Not authenticated');
            }

            // Don't allow role changes through profile update
            delete updateData.role;
            delete updateData.status;
            delete updateData.id;

            // Update user in storage
            const updatedUser = storage.updateUser(this.currentUser.id, updateData);
            
            if (!updatedUser) {
                throw new Error('Failed to update profile');
            }

            // Update current session if email or username changed
            if (updateData.email) this.currentUser.email = updateData.email;
            if (updateData.username) this.currentUser.username = updateData.username;
            if (updateData.company) this.currentUser.company = updateData.company;

            storage.setCurrentUser(this.currentUser);

            return {
                success: true,
                message: 'Profile updated successfully'
            };

        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    // Change password
    async changePassword(currentPassword, newPassword) {
        try {
            if (!this.isAuthenticated()) {
                throw new Error('Not authenticated');
            }

            // Get current user data
            const user = storage.getUserById(this.currentUser.id);
            
            if (!user || user.password !== currentPassword) {
                throw new Error('Current password is incorrect');
            }

            if (newPassword.length < 6) {
                throw new Error('New password must be at least 6 characters long');
            }

            // Update password
            storage.updateUser(this.currentUser.id, {
                password: newPassword // In production, hash this
            });

            return {
                success: true,
                message: 'Password changed successfully'
            };

        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    // Get user permissions
    getPermissions() {
        if (!this.isAuthenticated()) {
            return [];
        }

        const permissions = {
            admin: [
                'view_all_pos',
                'edit_all_pos',
                'delete_all_pos',
                'approve_pos',
                'reject_pos',
                'manage_users',
                'view_reports',
                'export_data'
            ],
            user: [
                'create_po',
                'view_own_pos',
                'edit_own_pos',
                'delete_own_pos'
            ]
        };

        return permissions[this.currentUser.role] || [];
    }

    // Check if user has specific permission
    hasPermission(permission) {
        return this.getPermissions().includes(permission);
    }
}

// Initialize auth manager
const auth = new AuthManager();

// Make auth available globally
window.auth = auth;

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
}