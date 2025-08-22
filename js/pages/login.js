// Login Page Logic
class LoginPage {
    constructor() {
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeWhenReady());
        } else {
            this.initializeWhenReady();
        }
    }

    initializeWhenReady() {
        // Wait for global objects to be available
        const checkGlobals = () => {
            console.log('Checking global objects:', {
                auth: !!window.auth,
                showErrorModal: !!window.showErrorModal,
                showSuccessModal: !!window.showSuccessModal
            });
            
            if (window.auth) {
                this.setupEventListeners();
                this.checkExistingSession();
            } else {
                console.log('Waiting for auth object...');
                setTimeout(checkGlobals, 100);
            }
        };
        checkGlobals();
    }

    setupEventListeners() {
        // Login form submission
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Register modal handlers
        this.setupRegistrationHandlers();

        // Modal event handlers
        this.setupModalHandlers();

        // Enter key handling for better UX
        this.setupKeyboardHandlers();
    }

    // Check for existing session
    checkExistingSession() {
        if (auth.isAuthenticated()) {
            // User is already logged in, redirect to appropriate dashboard
            if (auth.isAdmin()) {
                window.location.href = 'pages/admin.html';
            } else {
                window.location.href = 'pages/tracking.html';
            }
        }
    }

    // Handle login form submission
    async handleLogin(event) {
        event.preventDefault();
        
        console.log('Login form submitted');

        const form = event.target;
        const formData = new FormData(form);
        
        const username = formData.get('username');
        const password = formData.get('password');
        const role = formData.get('role');

        console.log('Login attempt:', { username, role });

        // Basic client-side validation
        if (!username || !password || !role) {
            if (typeof showErrorModal === 'function') {
                showErrorModal('Validation Error', 'Please fill in all fields.');
            } else {
                alert('Please fill in all fields.');
            }
            return;
        }

        // Show loading state
        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        submitButton.textContent = 'Logging in...';
        submitButton.disabled = true;

        try {
            // Check if auth object is available
            if (!window.auth) {
                throw new Error('Auth system not available');
            }

            // Attempt login
            const result = await window.auth.login(username.trim(), password, role);
            console.log('Login result:', result);

            if (result.success) {
                console.log('Login successful, redirecting...');
                
                if (typeof showSuccessModal === 'function') {
                    showSuccessModal(
                        'Login Successful',
                        `Welcome, ${result.user.username}!`,
                        [{
                            text: 'Continue',
                            class: 'btn-primary',
                            action: () => {
                                this.redirectAfterLogin(result.user.role);
                            }
                        }]
                    );
                } else {
                    // Fallback: direct redirect
                    alert(`Welcome, ${result.user.username}!`);
                    setTimeout(() => this.redirectAfterLogin(result.user.role), 500);
                }
            } else {
                console.log('Login failed:', result.message);
                if (typeof showErrorModal === 'function') {
                    showErrorModal('Login Failed', result.message);
                } else {
                    alert('Login Failed: ' + result.message);
                }
            }

        } catch (error) {
            console.error('Login error:', error);
            if (typeof showErrorModal === 'function') {
                showErrorModal('Login Error', 'An unexpected error occurred. Please try again.');
            } else {
                alert('Login Error: An unexpected error occurred. Please try again.');
            }
        } finally {
            // Reset button state
            submitButton.textContent = originalText;
            submitButton.disabled = false;
        }
    }

    // Redirect user after successful login
    redirectAfterLogin(role) {
        if (role === 'admin') {
            window.location.href = 'pages/admin.html';
        } else {
            window.location.href = 'pages/tracking.html';
        }
    }

    // Setup registration handlers
    setupRegistrationHandlers() {
        const registerLink = document.getElementById('registerLink');
        const registerModal = document.getElementById('registerModal');
        const registerForm = document.getElementById('registerForm');
        const cancelRegisterBtn = document.getElementById('cancelRegister');

        // Show registration modal
        if (registerLink) {
            registerLink.addEventListener('click', (e) => {
                e.preventDefault();
                showModal('registerModal');
            });
        }

        // Handle registration form submission
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegistration(e));
        }

        // Cancel registration
        if (cancelRegisterBtn) {
            cancelRegisterBtn.addEventListener('click', () => {
                closeModal('registerModal');
            });
        }
    }

    // Handle user registration
    async handleRegistration(event) {
        event.preventDefault();

        const form = event.target;
        const formData = new FormData(form);

        const userData = {
            username: formData.get('username'),
            email: formData.get('email'),
            password: formData.get('password'),
            company: formData.get('company')
        };

        // Client-side validation
        const validation = this.validateRegistrationData(userData);
        if (!validation.isValid) {
            if (typeof window.showErrorModal === 'function') {
                window.showErrorModal('Validation Error', validation.errors.join('\n'));
            } else {
                alert('Validation Error: ' + validation.errors.join('\n'));
            }
            return;
        }

        // Show loading state
        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        submitButton.textContent = 'Creating Account...';
        submitButton.disabled = true;

        try {
            // Attempt registration
            const result = await auth.register(userData);

            if (result.success) {
                if (typeof window.closeModal === 'function') {
                    window.closeModal('registerModal');
                }
                
                if (typeof window.showSuccessModal === 'function') {
                    window.showSuccessModal(
                        'Registration Successful',
                        `Account created successfully for ${result.user.username}. You can now log in.`,
                        [{
                            text: 'OK',
                            class: 'btn-primary',
                            action: () => {
                                // Pre-fill login form
                                document.getElementById('username').value = userData.username;
                                document.getElementById('role').value = 'user';
                            }
                        }]
                    );
                } else {
                    alert(`Registration Successful: Account created for ${result.user.username}. You can now log in.`);
                    document.getElementById('username').value = userData.username;
                    document.getElementById('role').value = 'user';
                }
            } else {
                if (typeof window.showErrorModal === 'function') {
                    window.showErrorModal('Registration Failed', result.message);
                } else {
                    alert('Registration Failed: ' + result.message);
                }
            }

        } catch (error) {
            console.error('Registration error:', error);
            if (typeof window.showErrorModal === 'function') {
                window.showErrorModal('Registration Error', 'An unexpected error occurred. Please try again.');
            } else {
                alert('Registration Error: An unexpected error occurred. Please try again.');
            }
        } finally {
            // Reset button state
            submitButton.textContent = originalText;
            submitButton.disabled = false;
        }
    }

    // Validate registration data
    validateRegistrationData(userData) {
        const errors = [];

        // Username validation
        if (!userData.username || userData.username.length < 3) {
            errors.push('Username must be at least 3 characters long');
        }

        // Email validation
        if (!userData.email) {
            errors.push('Email is required');
        } else {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(userData.email)) {
                errors.push('Please enter a valid email address');
            }
        }

        // Password validation
        if (!userData.password) {
            errors.push('Password is required');
        } else if (userData.password.length < 6) {
            errors.push('Password must be at least 6 characters long');
        }

        // Company validation
        if (!userData.company || userData.company.length < 2) {
            errors.push('Company name must be at least 2 characters long');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    // Setup modal handlers
    setupModalHandlers() {
        // Close modals when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                closeModal(e.target.id);
            }
        });

        // Close button handlers
        document.querySelectorAll('.modal .close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    closeModal(modal.id);
                }
            });
        });

        // Message modal OK button
        const messageOkBtn = document.getElementById('messageOk');
        if (messageOkBtn) {
            messageOkBtn.addEventListener('click', () => {
                closeModal('messageModal');
            });
        }
    }

    // Setup keyboard handlers
    setupKeyboardHandlers() {
        // Enter key on login form
        document.getElementById('loginForm')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const submitButton = document.querySelector('#loginForm button[type="submit"]');
                if (submitButton && !submitButton.disabled) {
                    submitButton.click();
                }
            }
        });

        // Enter key on registration form
        document.getElementById('registerForm')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const submitButton = document.querySelector('#registerForm button[type="submit"]');
                if (submitButton && !submitButton.disabled) {
                    submitButton.click();
                }
            }
        });

        // ESC key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const openModals = document.querySelectorAll('.modal[style*="block"]');
                if (openModals.length > 0) {
                    closeModal(openModals[openModals.length - 1].id);
                }
            }
        });
    }

    // Show demo credentials helper
    showDemoCredentials() {
        if (typeof window.showInfoModal === 'function') {
            window.showInfoModal(
                'Demo Credentials',
                `You can use these demo credentials to test the system:
                
                Admin Access:
                Username: admin
                Password: admin123
                Role: Admin
                
                User Access:
                Username: user
                Password: user123
                Role: User
                
                Or create a new account using the registration form.`,
            [{
                text: 'Use Admin Demo',
                class: 'btn-secondary',
                action: () => {
                    document.getElementById('username').value = 'admin';
                    document.getElementById('password').value = 'admin123';
                    document.getElementById('role').value = 'admin';
                }
            },
            {
                text: 'Use User Demo',
                class: 'btn-secondary',
                action: () => {
                    document.getElementById('username').value = 'user';
                    document.getElementById('password').value = 'user123';
                    document.getElementById('role').value = 'user';
                }
            },
            {
                text: 'Close',
                class: 'btn-primary',
                action: () => {}
            }]
        );
        } else {
            alert(`Demo Credentials:
            
Admin Access: admin/admin123 (Role: Admin)
User Access: user/user123 (Role: User)`);
        }
    }

    // Handle forgot password (placeholder for future implementation)
    handleForgotPassword() {
        if (typeof window.showInfoModal === 'function') {
            window.showInfoModal(
                'Password Reset',
                'Password reset functionality will be available in a future update. Please contact your administrator for assistance.',
                [{
                    text: 'OK',
                    class: 'btn-primary',
                    action: () => {}
                }]
            );
        } else {
            alert('Password Reset: Password reset functionality will be available in a future update. Please contact your administrator for assistance.');
        }
    }

    // Toggle password visibility
    togglePasswordVisibility(inputId) {
        const passwordInput = document.getElementById(inputId);
        const toggleButton = passwordInput.nextElementSibling;

        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            toggleButton.textContent = '👁️';
        } else {
            passwordInput.type = 'password';
            toggleButton.textContent = '👁️‍🗨️';
        }
    }

    // Form field focus effects
    setupFormEnhancements() {
        const formInputs = document.querySelectorAll('.form-group input, .form-group select');
        
        formInputs.forEach(input => {
            // Add focus effects
            input.addEventListener('focus', () => {
                input.parentElement.classList.add('focused');
            });

            input.addEventListener('blur', () => {
                input.parentElement.classList.remove('focused');
                
                // Add validation feedback
                if (input.hasAttribute('required') && !input.value.trim()) {
                    input.parentElement.classList.add('error');
                } else {
                    input.parentElement.classList.remove('error');
                    if (input.value.trim()) {
                        input.parentElement.classList.add('success');
                    }
                }
            });

            // Real-time validation for email
            if (input.type === 'email') {
                input.addEventListener('input', () => {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (input.value && !emailRegex.test(input.value)) {
                        input.parentElement.classList.add('error');
                        input.parentElement.classList.remove('success');
                    } else if (input.value) {
                        input.parentElement.classList.remove('error');
                        input.parentElement.classList.add('success');
                    }
                });
            }
        });
    }

    // Handle connection status
    handleConnectionStatus() {
        window.addEventListener('online', () => {
            if (typeof window.showSuccessModal === 'function') {
                window.showSuccessModal('Connection Restored', 'You are now online.');
            }
        });

        window.addEventListener('offline', () => {
            showWarningModal('Connection Lost', 'You are now offline. Some features may not be available.');
        });
    }
}

// Initialize login page
const loginPage = new LoginPage();

// Add demo credentials button for development
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    document.addEventListener('DOMContentLoaded', () => {
        const loginForm = document.querySelector('.login-form');
        if (loginForm) {
            const demoButton = document.createElement('button');
            demoButton.type = 'button';
            demoButton.textContent = 'Show Demo Credentials';
            demoButton.className = 'btn-secondary';
            demoButton.style.width = '100%';
            demoButton.style.marginTop = '10px';
            demoButton.addEventListener('click', () => loginPage.showDemoCredentials());
            
            loginForm.appendChild(demoButton);
        }
    });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoginPage;
}