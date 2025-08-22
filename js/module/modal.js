// Modal System
class ModalManager {
    constructor() {
        this.activeModals = new Set();
        this.init();
    }

    init() {
        // Handle ESC key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeModals.size > 0) {
                this.closeTopModal();
            }
        });

        // Handle click outside modal to close
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
        });

        // Initialize existing modal close buttons
        this.initializeCloseButtons();
    }

    initializeCloseButtons() {
        document.querySelectorAll('.modal .close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    this.closeModal(modal.id);
                }
            });
        });
    }

    // Show modal
    showModal(modalId, data = null) {
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.error(`Modal with ID ${modalId} not found`);
            return false;
        }

        // Populate modal data if provided
        if (data) {
            this.populateModalData(modal, data);
        }

        // Show modal
        modal.style.display = 'block';
        this.activeModals.add(modalId);

        // Focus on first input or button
        setTimeout(() => {
            const firstFocusable = modal.querySelector('input, button, select, textarea');
            if (firstFocusable) {
                firstFocusable.focus();
            }
        }, 100);

        // Prevent body scroll
        if (this.activeModals.size === 1) {
            document.body.style.overflow = 'hidden';
        }

        return true;
    }

    // Close modal
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return false;

        modal.style.display = 'none';
        this.activeModals.delete(modalId);

        // Restore body scroll if no modals are open
        if (this.activeModals.size === 0) {
            document.body.style.overflow = '';
        }

        // Clear form if it exists
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
            this.clearFormErrors(form);
        }

        return true;
    }

    // Close top modal (for ESC key)
    closeTopModal() {
        if (this.activeModals.size > 0) {
            const topModal = Array.from(this.activeModals).pop();
            this.closeModal(topModal);
        }
    }

    // Close all modals
    closeAllModals() {
        this.activeModals.forEach(modalId => {
            this.closeModal(modalId);
        });
    }

    // Populate modal with data
    populateModalData(modal, data) {
        Object.keys(data).forEach(key => {
            const element = modal.querySelector(`#${key}, [name="${key}"]`);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = data[key];
                } else if (element.type === 'radio') {
                    const radioButton = modal.querySelector(`input[name="${key}"][value="${data[key]}"]`);
                    if (radioButton) radioButton.checked = true;
                } else {
                    element.value = data[key];
                }
            }
        });

        // Handle text content
        Object.keys(data).forEach(key => {
            const element = modal.querySelector(`[data-field="${key}"]`);
            if (element) {
                element.textContent = data[key];
            }
        });
    }

    // Show loading modal
    showLoadingModal(message = 'Loading...') {
        const existingModal = document.getElementById('loadingModal');
        if (existingModal) {
            const messageElement = existingModal.querySelector('p');
            if (messageElement) {
                messageElement.textContent = message;
            }
            this.showModal('loadingModal');
            return;
        }

        // Create loading modal if it doesn't exist
        const loadingModal = this.createLoadingModal(message);
        document.body.appendChild(loadingModal);
        this.showModal('loadingModal');
    }

    // Hide loading modal
    hideLoadingModal() {
        this.closeModal('loadingModal');
    }

    // Create loading modal
    createLoadingModal(message) {
        const modal = document.createElement('div');
        modal.id = 'loadingModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="loading-spinner"></div>
                <p>${message}</p>
            </div>
        `;
        return modal;
    }

    // Show success modal
    showSuccessModal(title, message, actions = []) {
        this.showMessageModal('success', title, message, actions);
    }

    // Show error modal
    showErrorModal(title, message, actions = []) {
        this.showMessageModal('error', title, message, actions);
    }

    // Show info modal
    showInfoModal(title, message, actions = []) {
        this.showMessageModal('info', title, message, actions);
    }

    // Show warning modal
    showWarningModal(title, message, actions = []) {
        this.showMessageModal('warning', title, message, actions);
    }

    // Generic message modal
    showMessageModal(type, title, message, actions = []) {
        let modal = document.getElementById('messageModal');
        
        if (!modal) {
            modal = this.createMessageModal();
            document.body.appendChild(modal);
        }

        // Set content
        const titleElement = modal.querySelector('#messageTitle');
        const textElement = modal.querySelector('#messageText');
        const actionsContainer = modal.querySelector('.modal-actions');

        if (titleElement) titleElement.textContent = title;
        if (textElement) textElement.textContent = message;

        // Set modal type
        const modalContent = modal.querySelector('.modal-content');
        modalContent.className = `modal-content ${type}`;

        // Clear existing actions and add new ones
        actionsContainer.innerHTML = '';
        
        if (actions.length === 0) {
            // Default OK button
            actions = [{
                text: 'OK',
                class: 'btn-primary',
                action: () => this.closeModal('messageModal')
            }];
        }

        actions.forEach(action => {
            const button = document.createElement('button');
            button.textContent = action.text;
            button.className = action.class || 'btn-secondary';
            button.addEventListener('click', () => {
                if (action.action) action.action();
                if (action.closeModal !== false) {
                    this.closeModal('messageModal');
                }
            });
            actionsContainer.appendChild(button);
        });

        this.showModal('messageModal');
    }

    // Create message modal
    createMessageModal() {
        const modal = document.createElement('div');
        modal.id = 'messageModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3 id="messageTitle">Message</h3>
                <p id="messageText">Message content</p>
                <div class="modal-actions">
                    <!-- Actions will be added dynamically -->
                </div>
            </div>
        `;
        return modal;
    }

    // Show confirmation modal
    showConfirmModal(title, message, onConfirm, onCancel = null) {
        let modal = document.getElementById('confirmModal');
        
        if (!modal) {
            modal = this.createConfirmModal();
            document.body.appendChild(modal);
        }

        // Set content
        const titleElement = modal.querySelector('h3');
        const messageElement = modal.querySelector('#confirmMessage');

        if (titleElement) titleElement.textContent = title;
        if (messageElement) messageElement.textContent = message;

        // Set up action buttons
        const confirmBtn = modal.querySelector('#confirmOk');
        const cancelBtn = modal.querySelector('#confirmCancel');

        // Remove existing event listeners
        confirmBtn.replaceWith(confirmBtn.cloneNode(true));
        cancelBtn.replaceWith(cancelBtn.cloneNode(true));

        // Get new references
        const newConfirmBtn = modal.querySelector('#confirmOk');
        const newCancelBtn = modal.querySelector('#confirmCancel');

        newConfirmBtn.addEventListener('click', () => {
            if (onConfirm) onConfirm();
            this.closeModal('confirmModal');
        });

        newCancelBtn.addEventListener('click', () => {
            if (onCancel) onCancel();
            this.closeModal('confirmModal');
        });

        this.showModal('confirmModal');
    }

    // Create confirm modal
    createConfirmModal() {
        const modal = document.createElement('div');
        modal.id = 'confirmModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Confirm Action</h3>
                <p id="confirmMessage">Are you sure?</p>
                <div class="modal-actions">
                    <button type="button" class="btn-secondary" id="confirmCancel">Cancel</button>
                    <button type="button" class="btn-danger" id="confirmOk">Confirm</button>
                </div>
            </div>
        `;
        return modal;
    }

    // Form validation helpers
    validateForm(formElement) {
        const errors = [];
        const requiredFields = formElement.querySelectorAll('[required]');

        requiredFields.forEach(field => {
            const value = field.value.trim();
            if (!value) {
                errors.push(`${this.getFieldLabel(field)} is required`);
                this.markFieldError(field, `${this.getFieldLabel(field)} is required`);
            } else {
                this.markFieldSuccess(field);
            }
        });

        // Email validation
        const emailFields = formElement.querySelectorAll('input[type="email"]');
        emailFields.forEach(field => {
            if (field.value.trim()) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(field.value.trim())) {
                    errors.push('Invalid email format');
                    this.markFieldError(field, 'Invalid email format');
                }
            }
        });

        // Number validation
        const numberFields = formElement.querySelectorAll('input[type="number"]');
        numberFields.forEach(field => {
            if (field.value.trim()) {
                const value = parseFloat(field.value);
                if (isNaN(value)) {
                    errors.push(`${this.getFieldLabel(field)} must be a valid number`);
                    this.markFieldError(field, 'Must be a valid number');
                }
            }
        });

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    getFieldLabel(field) {
        const label = field.closest('.form-group')?.querySelector('label');
        return label ? label.textContent.replace(' *', '') : field.name || field.id || 'Field';
    }

    markFieldError(field, message) {
        const formGroup = field.closest('.form-group');
        if (formGroup) {
            formGroup.classList.remove('success');
            formGroup.classList.add('error');

            // Remove existing error message
            const existingError = formGroup.querySelector('.error-message');
            if (existingError) existingError.remove();

            // Add error message
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = message;
            formGroup.appendChild(errorDiv);
        }
    }

    markFieldSuccess(field) {
        const formGroup = field.closest('.form-group');
        if (formGroup) {
            formGroup.classList.remove('error');
            formGroup.classList.add('success');

            // Remove error message
            const errorMessage = formGroup.querySelector('.error-message');
            if (errorMessage) errorMessage.remove();
        }
    }

    clearFormErrors(form) {
        form.querySelectorAll('.form-group').forEach(group => {
            group.classList.remove('error', 'success');
            const errorMessage = group.querySelector('.error-message');
            if (errorMessage) errorMessage.remove();
        });
    }

    // Utility methods
    isModalOpen(modalId) {
        return this.activeModals.has(modalId);
    }

    getActiveModals() {
        return Array.from(this.activeModals);
    }

    // Modal content helpers
    setModalTitle(modalId, title) {
        const modal = document.getElementById(modalId);
        const titleElement = modal?.querySelector('h3, .modal-title');
        if (titleElement) {
            titleElement.textContent = title;
        }
    }

    setModalContent(modalId, content) {
        const modal = document.getElementById(modalId);
        const bodyElement = modal?.querySelector('.modal-body');
        if (bodyElement) {
            if (typeof content === 'string') {
                bodyElement.innerHTML = content;
            } else {
                bodyElement.innerHTML = '';
                bodyElement.appendChild(content);
            }
        }
    }
}

// Initialize modal manager
const modalManager = new ModalManager();

// Global helper functions for easier use
function showModal(modalId, data = null) {
    return modalManager.showModal(modalId, data);
}

function closeModal(modalId) {
    return modalManager.closeModal(modalId);
}

function showLoadingModal(message = 'Loading...') {
    return modalManager.showLoadingModal(message);
}

function hideLoadingModal() {
    return modalManager.hideLoadingModal();
}

function showSuccessModal(title, message, actions = []) {
    return modalManager.showSuccessModal(title, message, actions);
}

function showErrorModal(title, message, actions = []) {
    return modalManager.showErrorModal(title, message, actions);
}

function showConfirmModal(title, message, onConfirm, onCancel = null) {
    return modalManager.showConfirmModal(title, message, onConfirm, onCancel);
}

function validateForm(formElement) {
    return modalManager.validateForm(formElement);
}

// Make functions available globally
window.showModal = showModal;
window.closeModal = closeModal;
window.showLoadingModal = showLoadingModal;
window.hideLoadingModal = hideLoadingModal;
window.showSuccessModal = showSuccessModal;
window.showErrorModal = showErrorModal;
window.showConfirmModal = showConfirmModal;
window.validateForm = validateForm;

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModalManager;
}