class DynamicForm {
    constructor() {
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateTableVisibility();
        this.enableColumnResizing();
        this.enableRowResizing();
        this.enableResponsiveFonts();
        this.enableCellResizing();
        
    // Test row injection removed for production
    }

    enableResponsiveFonts() {
        console.log('enableResponsiveFonts called');
        
        // Function to adjust font sizes based on table width
        const adjustFontSizes = () => {
            console.log('adjustFontSizes called');
            document.querySelectorAll('.form-table').forEach((table, index) => {
                if (!table) {
                    console.log(`No table found at index ${index}`);
                    return;
                }
                
                const width = table.offsetWidth;
                console.log(`Table ${index} width: ${width}px`);
                
                // Remove existing responsive classes
                table.classList.remove('table-small', 'table-medium', 'table-large');
                
                // Apply appropriate responsive class based on width
                if (width <= 400) {
                    table.classList.add('table-small');
                } else if (width <= 600) {
                    table.classList.add('table-medium');
                } else if (width <= 800) {
                    table.classList.add('table-large');
                }
                // For widths > 800px, no class is added, uses default CSS styling
                
                console.log(`Applied responsive class to table ${index} (width: ${width}px)`);
            });
        };
        
        // Run immediately and on events
        adjustFontSizes();
        window.addEventListener('resize', adjustFontSizes);
        
        // Use ResizeObserver if available for more precise detection
        if (window.ResizeObserver) {
            const resizeObserver = new ResizeObserver(adjustFontSizes);
            document.querySelectorAll('.form-table').forEach(table => {
                resizeObserver.observe(table);
            });
        }
    }

    enableColumnResizing() {
        // Enable column resizing functionality - attach to headers and existing rows
        console.log('Column resizing enabled');

        // Attach to headers first (provides a consistent place to resize)
        document.querySelectorAll('.form-table').forEach(table => {
            this.attachResizingToHeader(table);
        });

        // Initialize existing body rows
        document.querySelectorAll('.form-table tbody tr').forEach(row => {
            this.attachResizingToRow(row);
        });
    }

    attachResizingToHeader(table) {
        const headerRow = table.querySelector('thead tr');
        if (!headerRow) return;

        const ths = headerRow.querySelectorAll('th');
        ths.forEach((th, index) => {
            if (index < ths.length - 1 && !th.querySelector('.resize-handle.left')) {
                this.makeDirectionalResizable(th, table);
            }
        });
    }

    attachResizingToRow(row) {
        // Attach resizing functionality to all cells in a row
        const table = row.closest('.form-table');
        const cells = row.querySelectorAll('td');
        
        cells.forEach((cell, index) => {
            // Don't attach to last column (Actions) and prevent duplicates
            if (index < cells.length - 1 && !cell.querySelector('.resize-handle.left')) { 
                this.makeDirectionalResizable(cell, table);
            }
        });
    }

    makeDirectionalResizable(cell, table) {
        // Create left and right resize handles at column boundaries
        const ensurePositioned = (el) => {
            if (getComputedStyle(el).position === 'static') {
                el.style.position = 'relative';
            }
        };

        ensurePositioned(cell);

        const leftHandle = document.createElement('div');
        leftHandle.className = 'resize-handle left';
        const rightHandle = document.createElement('div');
        rightHandle.className = 'resize-handle right';

        // Avoid duplicates
        if (!cell.querySelector('.resize-handle.left')) cell.appendChild(leftHandle);
        if (!cell.querySelector('.resize-handle.right')) cell.appendChild(rightHandle);

        const startState = {
            active: false,
            startX: 0,
            colA: -1,
            colB: -1,
            startWidthA: 0,
            startWidthB: 0,
            pairTotalPx: 0,
            tableWidth: 0,
        };

        const onMouseDown = (e, edge) => {
            const parentRow = cell.parentNode;
            const idx = Array.from(parentRow.children).indexOf(cell);
            const lastIndex = parentRow.children.length - 1;

            // Determine which two columns are affected (pairwise at boundary)
            let a = -1, b = -1; // a: primary, b: adjacent on dragged edge
            const totalCols = table.querySelectorAll('thead th').length || parentRow.children.length;
            const lastResizableIndex = Math.max(0, totalCols - 2); // exclude last Actions column

            if (edge === 'left') {
                if (idx - 1 < 0) return; // no left neighbor
                a = idx - 1; // left column
                b = idx;     // current column
            } else {
                if (idx + 1 > lastResizableIndex) return; // avoid Actions column
                a = idx;     // current column
                b = idx + 1; // right neighbor
            }

            // Resolve reference header for measurements
            const thA = table.querySelector(`thead th:nth-child(${a + 1})`);
            const thB = table.querySelector(`thead th:nth-child(${b + 1})`);
            const refA = thA || table.querySelector(`tbody tr:first-child td:nth-child(${a + 1})`);
            const refB = thB || table.querySelector(`tbody tr:first-child td:nth-child(${b + 1})`);
            if (!refA || !refB) return;

            startState.active = true;
            startState.startX = e.clientX;
            startState.colA = a;
            startState.colB = b;
            startState.startWidthA = refA.offsetWidth;
            startState.startWidthB = refB.offsetWidth;
            startState.pairTotalPx = startState.startWidthA + startState.startWidthB;
            startState.tableWidth = table.offsetWidth || 1;

            // Visual/UX: disable selection while dragging
            cell.classList.add('resizing');

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            e.preventDefault();
            e.stopPropagation();
        };

        const onMouseMove = (e) => {
            if (!startState.active) return;
            const deltaX = e.clientX - startState.startX;
            const minPx = 30;

            // New proposed width for A; clamp within pair
            let newA = startState.startWidthA + deltaX;
            newA = Math.max(minPx, Math.min(startState.pairTotalPx - minPx, newA));
            const newB = startState.pairTotalPx - newA;

            const pctA = (newA / startState.tableWidth) * 100;
            const pctB = (newB / startState.tableWidth) * 100;

            // Apply only to the two columns at the boundary
            this.updateColumnWidth(table, startState.colA, pctA);
            this.updateColumnWidth(table, startState.colB, pctB);
        };

        const onMouseUp = () => {
            if (!startState.active) return;
            startState.active = false;
            cell.classList.remove('resizing');
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        leftHandle.addEventListener('mousedown', (e) => onMouseDown(e, 'left'));
        rightHandle.addEventListener('mousedown', (e) => onMouseDown(e, 'right'));
    }

    updateColumnWidth(table, columnIndex, newPercentage) {
        // Update header width (use !important to override CSS rules that use !important)
        const header = table.querySelector(`th:nth-child(${columnIndex + 1})`);
        if (header) {
            header.style.setProperty('width', newPercentage + '%', 'important');
        }
        
        // Update all cells in this column
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
            const cell = row.children[columnIndex];
            if (cell) {
                cell.style.setProperty('width', newPercentage + '%', 'important');
            }
        });
    }

    enableRowResizing() {
        // Add row resizing functionality
        document.addEventListener('click', (e) => {
            const tbody = e.target.closest('tbody');
            if (tbody) {
                this.attachRowResizers(tbody);
            }
        });
        
        // Initialize existing rows
        document.querySelectorAll('tbody').forEach(tbody => {
            this.attachRowResizers(tbody);
        });
    }

    attachRowResizers(tbody) {
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            if (!row.hasAttribute('data-resizer-attached')) {
                this.makeRowResizable(row);
                row.setAttribute('data-resizer-attached', 'true');
            }
        });
    }

    makeRowResizable(row) {
        let isResizing = false;
        let startY, startHeight;

        const handleMouseDown = (e) => {
            if (e.target === row || row.contains(e.target)) {
                const rect = row.getBoundingClientRect();
                const bottomEdge = rect.bottom;
                
                // Check if click is near bottom edge (within 10px)
                if (Math.abs(e.clientY - bottomEdge) <= 10) {
                    isResizing = true;
                    startY = e.clientY;
                    startHeight = row.offsetHeight;
                    
                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                    e.preventDefault();
                }
            }
        };

        const handleMouseMove = (e) => {
            if (!isResizing) return;
            
            const newHeight = startHeight + (e.clientY - startY);
            const minHeight = 40; // Minimum row height
            const maxHeight = 200; // Maximum row height
            
            if (newHeight >= minHeight && newHeight <= maxHeight) {
                row.style.height = newHeight + 'px';
                
                // Adjust textarea height if exists
                const textarea = row.querySelector('textarea');
                if (textarea) {
                    textarea.style.height = Math.max(newHeight - 20, 30) + 'px';
                }
            }
        };

        const handleMouseUp = () => {
            isResizing = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        row.addEventListener('mousedown', handleMouseDown);
        
        // Add visual indicator for resizable rows
        row.style.cursor = 'default';
        row.addEventListener('mousemove', (e) => {
            if (!isResizing) {
                const rect = row.getBoundingClientRect();
                const bottomEdge = rect.bottom;
                
                if (Math.abs(e.clientY - bottomEdge) <= 10) {
                    row.style.cursor = 'row-resize';
                } else {
                    row.style.cursor = 'default';
                }
            }
        });
    }

    bindEvents() {
        console.log('🔧 bindEvents called');
        
        // Add schedule item button
        const addScheduleBtn = document.getElementById('addScheduleItem');
        console.log('🔧 addScheduleBtn found:', addScheduleBtn);
        if (addScheduleBtn) {
            addScheduleBtn.addEventListener('click', () => {
                console.log('🔧 Add Schedule Item button clicked!');
                this.addScheduleItem();
            });
        }

        // Add scope item button
        const addScopeBtn = document.getElementById('addScopeItem');
        if (addScopeBtn) {
            addScopeBtn.addEventListener('click', () => this.addScopeItem());
        }
    }

    addScheduleItem(data = null) {
        console.log('🔧 addScheduleItem called with data:', data);
        const tbody = document.getElementById('scheduleItems');
        const itemId = `schedule-${Date.now()}`;
        
        const scheduleRow = document.createElement('tr');
        scheduleRow.id = itemId;
        scheduleRow.innerHTML = `
            <td><input type="text" name="primeLine" required value="${data?.primeLine || ''}" placeholder="Enter prime line"></td>
            <td><input type="text" name="budgetCode" required value="${data?.budgetCode || ''}" placeholder="Enter budget code"></td>
            <td><textarea name="description" required placeholder="Enter description">${data?.description || ''}</textarea></td>
            <td><input type="number" name="qty" required value="${data?.qty || ''}" placeholder="0" step="0.01"></td>
            <td><input type="number" name="unit" required value="${data?.unit || ''}" placeholder="0.00" step="0.01"></td>
            <td><input type="number" name="totalCost" required value="${data?.totalCost || ''}" placeholder="0.00" step="0.01"></td>
            <td><input type="number" name="scheduled" required value="${data?.scheduled || ''}" placeholder="0.00" step="0.01"></td>
            <td><input type="number" name="apexContractValue" required value="${data?.apexContractValue || ''}" placeholder="0.00" step="0.01"></td>
            <td><input type="number" name="profit" required value="${data?.profit || ''}" placeholder="0.00" step="0.01"></td>
                <td><button type="button" class="btn-icon btn-danger" data-item-id="${itemId}" title="Remove" style="width:18px;height:18px;padding:0;margin:1px;border-radius:3px;background:#ff4444;color:white;border:1px solid #ff4444;font-size:12px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;">✕</button></td>
        `;
        
        console.log('🔧 Created row HTML:', scheduleRow.innerHTML);

        tbody.appendChild(scheduleRow);
        
        // Add event listener to the remove button
        const removeBtn = scheduleRow.querySelector('.btn-icon');
        console.log('🔧 Remove button found:', removeBtn);
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                console.log('🔧 Remove button clicked for item:', itemId);
                this.removeItem(itemId);
            });
        }
        this.updateTableVisibility();
        this.updateFormValidation();
        
        // Enable row resizing for the new row
        this.makeRowResizable(scheduleRow);
        
        // Enable column resizing for the new row
        this.attachResizingToRow(scheduleRow);
    }

    addScopeItem(data = null) {
        const tbody = document.getElementById('scopeItems');
        const itemId = `scope-${Date.now()}`;
        
        const scopeRow = document.createElement('tr');
        scopeRow.id = itemId;
        scopeRow.innerHTML = `
            <td><input type="text" name="item" required value="${data?.item || ''}" placeholder="Enter item number"></td>
            <td><textarea name="description" required placeholder="Enter description">${data?.description || ''}</textarea></td>
            <td>
                <div class="status-container">
                    <label class="status-option included">
                        <input type="radio" name="status_${itemId}" value="included" ${!data || data.included ? 'checked' : ''}> 
                        Included
                    </label>
                    <label class="status-option excluded">
                        <input type="radio" name="status_${itemId}" value="excluded" ${data?.excluded ? 'checked' : ''}> 
                        Excluded
                    </label>
                </div>
            </td>
                <td><button type="button" class="btn-icon btn-danger" data-item-id="${itemId}" title="Remove" style="width:18px;height:18px;padding:0;margin:1px;border-radius:3px;background:#ff4444;color:white;border:1px solid #ff4444;font-size:12px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;">✕</button></td>
        `;

        tbody.appendChild(scopeRow);
        
        // Add event listener to the remove button
        const removeBtn = scopeRow.querySelector('.btn-icon');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                this.removeItem(itemId);
            });
        }
        this.updateTableVisibility();
        this.updateFormValidation();
        
        // Enable row resizing for the new row
        this.makeRowResizable(scopeRow);
        
        // Enable column resizing for the new row
        this.attachResizingToRow(scopeRow);
        
        // Add event listeners for radio button background changes
        this.setupStatusOptions(scopeRow);
    }

    setupStatusOptions(row) {
        // Add event listeners to radio buttons for visual feedback
        const radioButtons = row.querySelectorAll('input[type="radio"]');
        const statusOptions = row.querySelectorAll('.status-option');
        
        radioButtons.forEach(radio => {
            radio.addEventListener('change', () => {
                // Remove background from all options in this row
                statusOptions.forEach(option => {
                    option.style.backgroundColor = 'white';
                });
                
                // Add background to the selected option
                const selectedOption = radio.closest('.status-option');
                if (selectedOption) {
                    if (selectedOption.classList.contains('included')) {
                        selectedOption.style.backgroundColor = '#d4edda';
                    } else if (selectedOption.classList.contains('excluded')) {
                        selectedOption.style.backgroundColor = '#f8d7da';
                    }
                }
            });
            
            // Trigger initial setup for pre-selected options
            if (radio.checked) {
                radio.dispatchEvent(new Event('change'));
            }
        });
    }

    removeItem(itemId) {
        const item = document.getElementById(itemId);
        if (item) {
            item.remove();
            this.updateTableVisibility();
            this.updateFormValidation();
        }
    }

    updateTableVisibility() {
        // Update schedule table visibility
        const scheduleTable = document.querySelector('#scheduleTable');
        const noScheduleItems = document.getElementById('noScheduleItems');
        const scheduleRows = document.querySelectorAll('#scheduleItems tr');
        
        if (scheduleRows.length > 0) {
            if (scheduleTable) {
                scheduleTable.style.display = 'table';
            }
            if (noScheduleItems) {
                noScheduleItems.style.display = 'none';
            }
        } else {
            if (scheduleTable) {
                scheduleTable.style.display = 'none';
            }
            if (noScheduleItems) {
                noScheduleItems.style.display = 'block';
            }
        }

        // Update scope table visibility
        const scopeTable = document.querySelector('#scopeTable');
        const noScopeItems = document.getElementById('noScopeItems');
        const scopeRows = document.querySelectorAll('#scopeItems tr');
        
        if (scopeRows.length > 0) {
            if (scopeTable) {
                scopeTable.style.display = 'table';
            }
            if (noScopeItems) {
                noScopeItems.style.display = 'none';
            }
        } else {
            if (scopeTable) {
                scopeTable.style.display = 'none';
            }
            if (noScopeItems) {
                noScopeItems.style.display = 'block';
            }
        }
    }

    updateFormValidation() {
        // Add any custom validation logic here
        const form = document.getElementById('poForm');
        if (form) {
            form.checkValidity();
        }
    }

    getScheduleItems() {
        const items = [];
        document.querySelectorAll('#scheduleItems tr').forEach(row => {
            const scheduleItem = {};
            row.querySelectorAll('[name]').forEach(input => {
                if (input.type === 'number') {
                    scheduleItem[input.name] = Number(input.value) || 0;
                } else {
                    scheduleItem[input.name] = input.value;
                }
            });
            items.push(scheduleItem);
        });
        return items;
    }

    getScopeItems() {
        const items = [];
        document.querySelectorAll('#scopeItems tr').forEach(row => {
            const itemId = row.id;
            const scopeItem = {
                item: row.querySelector('[name="item"]').value,
                description: row.querySelector('[name="description"]').value,
                included: row.querySelector(`[name="status_${itemId}"][value="included"]`).checked,
                excluded: row.querySelector(`[name="status_${itemId}"][value="excluded"]`).checked
            };
            items.push(scopeItem);
        });
        return items;
    }

    // Method to load existing data into the tables
    loadScheduleData(scheduleData) {
        if (Array.isArray(scheduleData)) {
            scheduleData.forEach(item => this.addScheduleItem(item));
        }
    }

    loadScopeData(scopeData) {
        if (Array.isArray(scopeData)) {
            scopeData.forEach(item => this.addScopeItem(item));
        }
    }

    // Clear all items
    clearAllItems() {
        const scheduleItems = document.getElementById('scheduleItems');
        const scopeItems = document.getElementById('scopeItems');
        
        if (scheduleItems) {
            scheduleItems.innerHTML = '';
        }
        if (scopeItems) {
            scopeItems.innerHTML = '';
        }
        
        this.updateTableVisibility();
    }

    enableCellResizing() {
        // Add cell-level resizing functionality
        document.addEventListener('click', (e) => {
            const tbody = e.target.closest('tbody');
            if (tbody) {
                this.attachCellResizers(tbody);
            }
        });
        
        // Initialize existing cells
        document.querySelectorAll('tbody').forEach(tbody => {
            this.attachCellResizers(tbody);
        });
    }

    attachCellResizers(tbody) {
        // Use the new directional resizing for all rows in the tbody
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            this.attachResizingToRow(row);
        });
    }

}

// Initialize the form handler and make it globally accessible
const dynamicForm = new DynamicForm();
window.dynamicForm = dynamicForm;

// Force font adjustment on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => dynamicForm.enableResponsiveFonts(), 100);
    });
} else {
    setTimeout(() => dynamicForm.enableResponsiveFonts(), 100);
}
