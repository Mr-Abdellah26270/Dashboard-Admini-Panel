document.addEventListener('DOMContentLoaded', function() {
    // --- THEME TOGGLE --- //
    const themeToggle = document.getElementById('theme-toggle');
    const applyTheme = (theme) => {
        const isDark = theme === 'dark';
        document.body.classList.toggle('dark-mode', isDark);

        if (themeToggle) {
            themeToggle.setAttribute('aria-pressed', isDark ? 'true' : 'false');
            if (window.i18n && typeof window.i18n.t === 'function') {
                themeToggle.setAttribute('aria-label', isDark ? window.i18n.t('theme.to_light') : window.i18n.t('theme.to_dark'));
            } else {
                themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
            }
            const iconEl = themeToggle.querySelector('i');
            if (iconEl) {
                iconEl.classList.remove('bx-sun', 'bx-moon', 'bxs-sun', 'bxs-moon');
                iconEl.classList.add(isDark ? 'bxs-sun' : 'bxs-moon');
            }
        }
        updateChartColors();
    };

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const newTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
            applyTheme(newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }

    // --- UI STATE (localStorage) --- //
    const UI_STATE_KEY = 'ui_state_v1';
    const loadUIState = () => {
        try { return JSON.parse(localStorage.getItem(UI_STATE_KEY) || '{}'); } 
        catch { return {}; } 
    };
    const saveUIState = (patch) => {
        const prev = loadUIState();
        localStorage.setItem(UI_STATE_KEY, JSON.stringify({ ...prev, ...patch }));
    };

    const navToggle = document.getElementById('nav-toggle');
    const uiStateAtStart = loadUIState();
    if (navToggle) {
        if (typeof uiStateAtStart.sidebarCollapsed === 'boolean') {
            navToggle.checked = uiStateAtStart.sidebarCollapsed;
        }
        navToggle.addEventListener('change', () => {
            saveUIState({ sidebarCollapsed: navToggle.checked });
        });
    }

    // --- DYNAMIC NOTIFICATIONS --- //
    const notificationsBtn = document.getElementById('notifications-btn');
    const notificationsDropdown = document.querySelector('.notifications-dropdown');
    const notificationsList = notificationsDropdown.querySelector('.notifications-list');
    const notificationBadge = notificationsBtn.querySelector('.badge');
    let notificationsData = [];
    let notificationsFetched = false;

    const renderNotifications = () => {
        const unreadCount = notificationsData.filter(n => !n.read).length;
        if (notificationBadge) {
            notificationBadge.textContent = unreadCount;
            notificationBadge.style.display = unreadCount > 0 ? 'block' : 'none';
        }

        if (!notificationsList) return;
        notificationsList.innerHTML = '';

        if (notificationsData.length === 0) {
            notificationsList.innerHTML = `<div class="notification-item">لا توجد إشعارات</div>`;
            return;
        }

        const tpl = document.getElementById('tpl-notification-item');
        notificationsData.forEach(item => {
            if (tpl && tpl.content) {
                const fragment = tpl.content.cloneNode(true);
                const itemEl = fragment.querySelector('.notification-item');
                const textEl = fragment.querySelector('.notification-text');
                const markReadBtn = fragment.querySelector('.mark-as-read');

                itemEl.dataset.id = item.id;
                textEl.textContent = item.body;

                if (item.read) {
                    itemEl.classList.add('read');
                }

                markReadBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    markNotificationAsRead(item.id);
                });

                notificationsList.appendChild(fragment);
            }
        });
    };

    const markNotificationAsRead = (id) => {
        const notification = notificationsData.find(n => n.id === id);
        if (notification && !notification.read) {
            notification.read = true;
            renderNotifications(); // Re-render to update the UI
        }
    };

    const fetchAndRenderNotifications = async () => {
        notificationsFetched = true;
        if(notificationsList) notificationsList.innerHTML = `<div class="notification-item" style="display:flex; justify-content:center; padding:0.75rem 0;"><i class="bx bx-loader-alt bx-spin" aria-hidden="true" style="font-size: 1.4rem;"></i></div>`;

        try {
            const response = await fetch('https://jsonplaceholder.typicode.com/comments?_limit=5');
            if (!response.ok) throw new Error('Failed to fetch notifications');
            const comments = await response.json();

            notificationsData = comments.map(comment => ({
                id: comment.id,
                body: comment.name, // Using comment name as notification body
                read: false
            }));

            renderNotifications();

        } catch (error) {
            console.error("Fetch notifications error:", error);
            if(notificationsList) notificationsList.innerHTML = `<div class="notification-item">فشل تحميل الإشعارات</div>`;
        }
    };

    const setNotificationsState = (open) => {
        if (!notificationsBtn || !notificationsDropdown) return;
        notificationsBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        notificationsDropdown.setAttribute('aria-hidden', open ? 'false' : 'true');
        notificationsDropdown.classList.toggle('active', open);
    };

    if (notificationsBtn) {
        notificationsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!notificationsFetched) {
                fetchAndRenderNotifications();
            }
            const isOpen = notificationsDropdown.classList.contains('active');
            setNotificationsState(!isOpen);
        });
    }

    window.addEventListener('click', () => {
        if (notificationsDropdown && notificationsDropdown.classList.contains('active')) {
            setNotificationsState(false);
        }
    });
    if (notificationsDropdown) {
        notificationsDropdown.addEventListener('click', (e) => e.stopPropagation());
    }

    // --- TOASTS / SNACKBARS --- //
    const ensureToastContainer = () => {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.setAttribute('aria-live', 'polite');
            container.setAttribute('aria-atomic', 'true');
            document.body.appendChild(container);
        }
        return container;
    };

    const showToast = (message, type = 'success', opts = {}) => {
        const { duration = 3000 } = opts;
        const container = ensureToastContainer();
        const toast = document.createElement('div');
        toast.className = `toast toast-${type} fade-in`;
        toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
        toast.innerHTML = `<span class="bx ${type === 'error' ? 'bx-x-circle' : 'bx-check-circle'} icon" aria-hidden="true"></span><span>${message}</span>`;
        
        const hide = () => {
            toast.classList.add('toast-hide');
            toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        };

        const timer = setTimeout(hide, duration);

        toast.addEventListener('click', () => {
            clearTimeout(timer);
            hide();
        });

        container.appendChild(toast);
    };

    // --- NAVIGATION --- //
    const navLinks = document.querySelectorAll('.sidebar ul li a');
    const pages = document.querySelectorAll('.page');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            navLinks.forEach(nav => {
                nav.classList.remove('active');
                nav.removeAttribute('aria-current');
            });
            this.classList.add('active');
            this.setAttribute('aria-current', 'page');

            const pageId = this.getAttribute('data-page');
            pages.forEach(page => {
                page.classList.toggle('active', page.id === pageId);
            });

            if (pageId === 'users-page' && !usersFetched) {
                fetchAndRenderUsers();
            }
            if (pageId === 'products-page' && !productsFetched) {
                fetchAndRenderProducts();
            }
            if (pageId === 'reports-page' && !reportsFetched) {
                generateReports();
            }
        });
    });

    // --- USERS PAGE --- //
    const addUserBtn = document.getElementById('add-user-btn');
    let usersData = [];
    let usersFetched = false;
    const usersTbody = document.getElementById('users-tbody');

    const openUserModal = () => {
        const existing = document.getElementById('add-user-modal-overlay');
        if (existing) {
            const firstFocusable = existing.querySelector('input, select, textarea, button, [href]');
            if (firstFocusable) firstFocusable.focus();
            return;
        }
        lastFocusedElement = document.activeElement;

        const tpl = document.getElementById('tpl-add-user-modal');
        if (!tpl) return;
        const fragment = tpl.content.cloneNode(true);
        document.body.appendChild(fragment);

        const overlay = document.getElementById('add-user-modal-overlay');
        const closeModalBtn = document.getElementById('close-modal-btn');
        const cancelModalBtn = document.getElementById('cancel-modal-btn');

        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');

        const saveBtn = overlay.querySelector('.modal-footer .btn-primary');
        const nameInput = overlay.querySelector('#username');
        const emailInput = overlay.querySelector('#email');
        const roleSelect = overlay.querySelector('#role');

        // Instant validation
        const validate = () => {
            let valid = true;
            // Name
            if (!nameInput.value.trim()) {
                nameInput.parentElement.classList.add('error');
                nameInput.parentElement.querySelector('small').innerText = 'الاسم مطلوب';
                valid = false;
            } else {
                nameInput.parentElement.classList.remove('error');
            }
            // Email
            const emailVal = emailInput.value.trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailVal) {
                emailInput.parentElement.classList.add('error');
                emailInput.parentElement.querySelector('small').innerText = 'البريد الإلكتروني مطلوب';
                valid = false;
            } else if (!emailRegex.test(emailVal)) {
                emailInput.parentElement.classList.add('error');
                emailInput.parentElement.querySelector('small').innerText = 'البريد الإلكتروني غير صالح';
                valid = false;
            } else {
                emailInput.parentElement.classList.remove('error');
            }
            return valid;
        };
        nameInput.addEventListener('input', validate);
        emailInput.addEventListener('input', validate);

        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                if (!validate()) return;
                const name = nameInput.value.trim();
                const email = emailInput.value.trim();
                const role = roleSelect ? roleSelect.value : 'viewer';
                saveBtn.disabled = true;
                const originalButtonText = saveBtn.innerHTML;
                saveBtn.innerHTML = `جاري الحفظ... <i class="bx bx-loader-alt bx-spin"></i>`;
                try {
                    const response = await fetch('https://jsonplaceholder.typicode.com/users', {
                        method: 'POST',
                        body: JSON.stringify({ name, email, role }),
                        headers: { 'Content-type': 'application/json; charset=UTF-8' },
                    });
                    if (!response.ok) throw new Error('Network response was not ok.');
                    const newUser = await response.json();
                    newUser.role = role;
                    usersData.unshift(newUser);
                    renderUsersTable(usersData);
                    close();
                    showToast('تم إضافة المستخدم بنجاح', 'success');
                } catch (error) {
                    console.error('Failed to add user:', error);
                    showToast('فشل في إضافة المستخدم', 'error');
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = originalButtonText;
                }
            });
        }

        const firstFocusable = overlay.querySelector('input, select, textarea, button, [href]');
        if (firstFocusable) firstFocusable.focus();

        // Fade out modal on close (with animation)
        const close = () => {
            overlay.classList.remove('active');
            overlay.classList.add('modal-fade-out');
            overlay.addEventListener('animationend', () => {
                overlay.remove();
            }, { once: true });
        };
        closeModalBtn && closeModalBtn.addEventListener('click', close);
        cancelModalBtn && cancelModalBtn.addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
    };

    if (addUserBtn) addUserBtn.addEventListener('click', openUserModal);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const userModal = document.getElementById('add-user-modal-overlay');
            if (userModal) userModal.querySelector('#close-modal-btn')?.click();

            const productModal = document.getElementById('add-product-modal-overlay');
            if (productModal) productModal.querySelector('#close-product-modal-btn')?.click();

            setNotificationsState(false);
        }
    });

    const renderUsersTable = (data) => {
        if (!usersTbody) return;
        usersTbody.innerHTML = '';
        if (data.length === 0) {
            usersTbody.innerHTML = `<tr><td colspan="4">لا يوجد مستخدمون لعرضهم.</td></tr>`;
            return;
        }
        const tpl = document.getElementById('tpl-user-row');
        data.forEach(item => {
            if (tpl && tpl.content) {
                const fragment = tpl.content.cloneNode(true);
                const nameCell = fragment.querySelector('[data-cell="name"]');
                const emailCell = fragment.querySelector('[data-cell="email"]');
                const roleCell = fragment.querySelector('[data-cell="role"]');

                if (nameCell) nameCell.textContent = item.name;
                if (emailCell) emailCell.textContent = item.email;
                if (roleCell) roleCell.textContent = item.role;
                
                usersTbody.appendChild(fragment);
            }
        });
    };

    const fetchAndRenderUsers = async () => {
        if (!usersTbody) return;
        usersFetched = true;
        usersTbody.innerHTML = `<tr><td colspan="4" class="text-center"><div class="bx bx-loader-alt bx-spin" style="font-size: 2rem; margin: 1rem 0;"></div></td></tr>`;

        try {
            const response = await fetch('https://jsonplaceholder.typicode.com/users');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const users = await response.json();

            const roles = ['مدير', 'محرر', 'مشاهد'];
            usersData = users.map(user => ({
                id: user.id,
                name: user.name,
                email: user.email,
                role: roles[Math.floor(Math.random() * roles.length)]
            }));

            renderUsersTable(usersData);

        } catch (error) {
            console.error("Fetch error:", error);
            showToast('فشل في جلب بيانات المستخدمين', 'error');
            if (usersTbody) {
                usersTbody.innerHTML = `<tr><td colspan="4">حدث خطأ أثناء تحميل البيانات.</td></tr>`;
            }
        }
    };

    // --- PROJECTS TABLE --- //
    let projectsData = [];
    const projectsTbody = document.getElementById('projects-tbody');
    const projectSearch = document.getElementById('project-search');
    const statusFilter = document.getElementById('project-status-filter');
    const tableHeaders = document.querySelectorAll('th[data-column]');
    let currentSort = (uiStateAtStart.projectSort && uiStateAtStart.projectSort.column)
        ? uiStateAtStart.projectSort
        : { column: 'name', direction: 'asc' };

    if (projectSearch && typeof uiStateAtStart.projectSearchTerm === 'string') {
        projectSearch.value = uiStateAtStart.projectSearchTerm;
    }
    if (statusFilter && typeof uiStateAtStart.projectStatusFilter === 'string') {
        statusFilter.value = uiStateAtStart.projectStatusFilter;
    }

    const fetchAndRenderProjects = async () => {
        if (!projectsTbody) return;
        projectsTbody.innerHTML = Array(5).fill('').map(() => document.getElementById('tpl-project-row').innerHTML.replace(/<td/g, '<td class="skeleton-row"')).join('');

        try {
            const response = await fetch('https://jsonplaceholder.typicode.com/users');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const users = await response.json();

            const statuses = [
                { text: 'مراجعة', color: 'purple' },
                { text: 'قيد التنفيذ', color: 'pink' },
                { text: 'في الانتظار', color: 'orange' },
                { text: 'مكتمل', color: 'green' },
            ];
            projectsData = users.map(user => {
                const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
                return {
                    id: user.id.toString(),
                    name: user.name,
                    department: user.company.name,
                    status: randomStatus.text,
                    statusColor: randomStatus.color,
                };
            });

            renderTable(getCurrentTableData());
            updateSortIndicators();

        } catch (error) {
            console.error("Fetch error:", error);
            showToast('فشل في جلب بيانات المشاريع', 'error');
            if (projectsTbody) {
                projectsTbody.innerHTML = `<tr><td colspan="3">حدث خطأ أثناء تحميل البيانات.</td></tr>`;
            }
        }
    };

    const getFilteredData = () => {
        const searchTerm = projectSearch ? projectSearch.value.toLowerCase() : '';
        const currentStatus = statusFilter ? statusFilter.value : 'all';

        return projectsData.filter(item => {
            const matchesSearch = !searchTerm || item.name.toLowerCase().includes(searchTerm) ||
                                item.department.toLowerCase().includes(searchTerm);
            const matchesStatus = currentStatus === 'all' || item.status === currentStatus;
            return matchesSearch && matchesStatus;
        });
    };
    const getCurrentTableData = () => sortData(getFilteredData(), currentSort.column, currentSort.direction);

    const toCSV = (rows, columns, filename) => {
        const escape = (txt) => {
            const s = String(txt ?? '');
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const header = columns.map(c => c.label);
        const lines = [header.map(escape).join(',')];
        rows.forEach(row => {
            const line = columns.map(col => escape(row[col.key]));
            lines.push(line.join(','));
        });
        return '\uFEFF' + lines.join('\n');
    };
    const downloadCSV = (filename, csv) => {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    const projectsHeader = document.querySelector('#dashboard-page .projects .card-header');
    if (projectsHeader) {
        const exportBtn = document.createElement('button');
        exportBtn.id = 'export-csv-btn';
        exportBtn.type = 'button';
        exportBtn.textContent = 'تصدير CSV';
        projectsHeader.appendChild(exportBtn);
        exportBtn.addEventListener('click', () => {
            const data = getCurrentTableData();
            const columns = [
                { label: 'اسم المشروع', key: 'name' },
                { label: 'القسم', key: 'department' },
                { label: 'الحالة', key: 'status' },
            ];
            const csv = toCSV(data, columns);
            downloadCSV('recent-projects.csv', csv);
            showToast('تم تصدير المشاريع إلى CSV', 'success');
        });
    }

    let draggingId = null;
    const onDragStart = (e) => {
        const tr = e.currentTarget;
        draggingId = tr.dataset.id;
        tr.classList.add('dragging');
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', draggingId);
        }
    };
    const onDragOver = (e) => {
        e.preventDefault();
        const tr = e.currentTarget;
        const rect = tr.getBoundingClientRect();
        const isTopHalf = e.clientY < rect.top + rect.height / 2;
        tr.classList.toggle('drag-over-top', isTopHalf);
        tr.classList.toggle('drag-over-bottom', !isTopHalf);
    };
    const onDragLeave = (e) => {
        const tr = e.currentTarget;
        tr.classList.remove('drag-over-top','drag-over-bottom');
    };
    const onDrop = (e) => {
        e.preventDefault();
        const targetTr = e.currentTarget;
        const targetId = targetTr.dataset.id;
        const rect = targetTr.getBoundingClientRect();
        const placeBefore = e.clientY < rect.top + rect.height / 2;

        if (!draggingId || draggingId === targetId) {
            targetTr.classList.remove('drag-over-top','drag-over-bottom');
            return;
        }

        const fromIdx = projectsData.findIndex(it => it.id === draggingId);
        const toIdxBase = projectsData.findIndex(it => it.id === targetId);
        if (fromIdx === -1 || toIdxBase === -1) return;

        const item = projectsData.splice(fromIdx, 1)[0];
        let toIdx = toIdxBase;
        if (!placeBefore && toIdxBase >= 0) toIdx = toIdxBase + (fromIdx < toIdxBase ? 0 : 1);
        if (placeBefore && fromIdx < toIdxBase) toIdx = toIdxBase - 1;

        projectsData.splice(Math.max(0, toIdx), 0, item);

        currentSort = { column: '__manual', direction: 'asc' };

        const filtered = getFilteredData();
        renderTable(filtered);
        updateSortIndicators();
    };
    const onDragEnd = (e) => {
        const tr = e.currentTarget;
        tr.classList.remove('dragging','drag-over-top','drag-over-bottom');
        draggingId = null;
    };

    const renderTable = (data) => {
        if (!projectsTbody) return;
        projectsTbody.innerHTML = '';
        if (data.length === 0) {
            projectsTbody.innerHTML = `<tr><td colspan="3">لا توجد نتائج</td></tr>`;
            return;
        }
        const tpl = document.getElementById('tpl-project-row');
        data.forEach(item => {
            if (tpl && tpl.content) {
                const fragment = tpl.content.cloneNode(true);
                const nameCell = fragment.querySelector('[data-cell="name"]');
                const deptCell = fragment.querySelector('[data-cell="department"]');
                const statusSpan = fragment.querySelector('.status');

                if (nameCell) nameCell.textContent = item.name;
                if (deptCell) deptCell.textContent = item.department;
                if (statusSpan) {
                    statusSpan.classList.add(item.statusColor);
                    statusSpan.textContent = item.status;
                }

                const rowEl = fragment.querySelector('tr');
                if (rowEl) {
                    rowEl.classList.add('fade-in');
                    rowEl.dataset.id = item.id;
                    rowEl.setAttribute('draggable', 'true');
                    rowEl.addEventListener('dragstart', onDragStart);
                    rowEl.addEventListener('dragover', onDragOver);
                    rowEl.addEventListener('dragleave', onDragLeave);
                    rowEl.addEventListener('drop', onDrop);
                    rowEl.addEventListener('dragend', onDragEnd);
                }
                
                projectsTbody.appendChild(fragment);
            }
        });
    };

    const sortData = (data, column, direction) => {
        if (column === '__manual') {
            const rank = new Map(projectsData.map((it, idx) => [it.id, idx]));
            return [...data].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
        }
        return [...data].sort((a, b) => {
            if (!a[column] || !b[column]) return 0;
            const valA = a[column].toLowerCase();
            const valB = b[column].toLowerCase();
            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const updateSortIndicators = () => {
        if (!tableHeaders) return;
        tableHeaders.forEach(header => {
            header.classList.remove('sort-asc', 'sort-desc');
            header.setAttribute('aria-sort', 'none');
            const iconEl = header.querySelector('.sort-icon');
            if (iconEl) iconEl.className = 'bx bx-sort sort-icon';
            if (header.dataset.column === currentSort.column) {
                header.classList.add(currentSort.direction === 'asc' ? 'sort-asc' : 'sort-desc');
                header.setAttribute('aria-sort', currentSort.direction === 'asc' ? 'ascending' : 'descending');
                if (iconEl) iconEl.className = `bx ${currentSort.direction === 'asc' ? 'bx-sort-up' : 'bx-sort-down'} sort-icon`;
            }
        });
    };

    const handleProjectFilterChange = () => {
        saveUIState({
            projectSearchTerm: projectSearch.value,
            projectStatusFilter: statusFilter.value 
        });
        renderTable(getCurrentTableData());
    };

    if(projectSearch) {
        projectSearch.addEventListener('input', handleProjectFilterChange);
    }
    if(statusFilter) {
        statusFilter.addEventListener('change', handleProjectFilterChange);
    }

    if(tableHeaders) {
        tableHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const column = header.dataset.column;
                const direction = (currentSort.column === column && currentSort.direction === 'asc') ? 'desc' : 'asc';
                currentSort = { column, direction };
                saveUIState({ projectSort: currentSort });
                renderTable(getCurrentTableData());
                updateSortIndicators();
            });
        });
    }

    // --- PRODUCTS PAGE --- //
    let productsData = [];
    let productsFetched = false;
    const productGrid = document.getElementById('product-grid');
    const addProductBtn = document.getElementById('add-product-btn');

    const renderProducts = () => {
        if (!productGrid) return;
        productGrid.innerHTML = '';
        if (productsData.length === 0) {
            productGrid.innerHTML = `<p>لا توجد منتجات لعرضها.</p>`;
            return;
        }
        const tpl = document.getElementById('tpl-product-card');
        productsData.forEach(product => {
            if (!tpl || !tpl.content) return;
            const fragment = tpl.content.cloneNode(true);
            const card = fragment.querySelector('.product-card');
            card.dataset.id = product.id;
            fragment.querySelector('.product-image img').src = product.image;
            fragment.querySelector('.product-image img').alt = product.title;
            fragment.querySelector('.product-title').textContent = product.title;
            fragment.querySelector('.product-category').textContent = product.category;
            fragment.querySelector('.product-price').textContent = `$${product.price}`;

            fragment.querySelector('.delete-product-btn').addEventListener('click', () => deleteProduct(product.id, card));
            fragment.querySelector('.edit-product-btn').addEventListener('click', () => openProductModal(product));

            productGrid.appendChild(fragment);
        });
    };

    const fetchAndRenderProducts = async () => {
        if (!productGrid) return;
        productsFetched = true;
        productGrid.innerHTML = `<div class="bx bx-loader-alt bx-spin" style="font-size: 2rem; margin: 1rem auto; display:block;"></div>`;

        try {
            const response = await fetch('https://fakestoreapi.com/products');
            if (!response.ok) throw new Error('Failed to fetch products');
            productsData = await response.json();
            renderProducts();
        } catch (error) {
            console.error("Fetch products error:", error);
            productGrid.innerHTML = `<p>فشل في تحميل المنتجات.</p>`;
            showToast('فشل في جلب بيانات المنتجات', 'error');
        }
    };

    const deleteProduct = async (id, cardElement) => {
        if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;

        cardElement.style.transition = 'opacity 0.3s ease';
        cardElement.style.opacity = '0.5';

        try {
            const response = await fetch(`https://fakestoreapi.com/products/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Deletion failed');
            
            productsData = productsData.filter(p => p.id !== id);
            cardElement.remove();
            showToast('تم حذف المنتج بنجاح', 'success');

        } catch (error) {
            console.error('Delete product error:', error);
            showToast('فشل حذف المنتج', 'error');
            cardElement.style.opacity = '1';
        }
    };

    const openProductModal = (product = null) => {
        const tpl = document.getElementById('tpl-add-product-modal');
        if (!tpl) return;
        const fragment = tpl.content.cloneNode(true);
        document.body.appendChild(fragment);

        const overlay = document.getElementById('add-product-modal-overlay');
        const form = document.getElementById('product-form');
        const modalTitle = document.getElementById('add-product-title');
        const productIdInput = document.getElementById('product-id');
        const titleInput = document.getElementById('product-title');
        const priceInput = document.getElementById('product-price');
        const categoryInput = document.getElementById('product-category');
        const imageInput = document.getElementById('product-image');
        const descriptionInput = document.getElementById('product-description');

        if (product) {
            modalTitle.textContent = 'تعديل المنتج';
            productIdInput.value = product.id;
            titleInput.value = product.title;
            priceInput.value = product.price;
            categoryInput.value = product.category;
            imageInput.value = product.image;
            descriptionInput.value = product.description;
        }

        const close = () => {
            overlay.classList.remove('active');
            overlay.classList.add('modal-fade-out');
            overlay.addEventListener('animationend', () => {
                overlay.remove();
            }, { once: true });
        };
        overlay.querySelector('#close-product-modal-btn').addEventListener('click', close);
        overlay.querySelector('#cancel-product-modal-btn').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        overlay.classList.add('active');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = productIdInput.value;
            const isEditing = !!id;
            const url = `https://fakestoreapi.com/products${isEditing ? `/${id}` : ''}`;
            const method = isEditing ? 'PUT' : 'POST';

            const productData = {
                title: titleInput.value,
                price: parseFloat(priceInput.value),
                description: descriptionInput.value,
                image: imageInput.value,
                category: categoryInput.value
            };

            const submitButton = form.parentElement.nextElementSibling.querySelector('.btn-primary');
            const originalButtonText = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.innerHTML = `جاري الحفظ... <i class="bx bx-loader-alt bx-spin"></i>`;
            try {
                const response = await fetch(url, { 
                    method, 
                    body: JSON.stringify(productData),
                    headers: { 'Content-Type': 'application/json' }
                });
                if (!response.ok) throw new Error('Save operation failed');
                const savedProduct = await response.json();

                if (isEditing) {
                    const index = productsData.findIndex(p => p.id == id);
                    productsData[index] = { ...productsData[index], ...savedProduct, id: parseInt(id) };
                } else {
                    productsData.unshift(savedProduct);
                }
                renderProducts();
                close();
                showToast(`تم ${isEditing ? 'تعديل' : 'إضافة'} المنتج بنجاح`, 'success');

            } catch (error) {
                console.error('Save product error:', error);
                showToast('فشلت عملية الحفظ', 'error');
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonText;
            }
        });
    };

    if (addProductBtn) addProductBtn.addEventListener('click', () => openProductModal());

    // --- REPORTS PAGE --- //
    let reportsFetched = false;
    let salesChart, categoryChart, topProductsChart;

    const generateReports = async () => {
        reportsFetched = true;
        showToast('جاري إعداد التقارير...', 'success', { duration: 1500 });

        try {
            // Use products data as the base for reports
            if (!productsFetched) await fetchAndRenderProducts();

            // --- Process data for charts ---
            const categoryData = productsData.reduce((acc, product) => {
                acc[product.category] = (acc[product.category] || 0) + 1;
                return acc;
            }, {});

            const topProducts = [...productsData]
                .sort((a, b) => (b.rating.count) - (a.rating.count)) // Fake sales based on review count
                .slice(0, 5);

            // --- Render charts ---
            const tickColor = getComputedStyle(document.documentElement).getPropertyValue('--main-text-color').trim();
            initSalesChart(tickColor);
            initCategoryChart(categoryData, tickColor);
            initTopProductsChart(topProducts, tickColor);

        } catch (error) {
            console.error("Reports error:", error);
            showToast('فشل في إعداد التقارير', 'error');
        }
    };

    const initSalesChart = (tickColor) => {
        const ctx = document.getElementById('sales-over-time-chart').getContext('2d');
        if (salesChart) salesChart.destroy();
        salesChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'],
                datasets: [{
                    label: 'الدخل',
                    data: [1200, 1900, 3000, 5000, 2300, 3200].sort(() => 0.5 - Math.random()), // Randomize for demo
                    borderColor: '#2B6CB0',
                    backgroundColor: '#2B6CB033',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: { responsive: true, scales: { y: { ticks: { color: tickColor } }, x: { ticks: { color: tickColor } } } }
        });
    };

    const initCategoryChart = (data, tickColor) => {
        const ctx = document.getElementById('category-breakdown-chart').getContext('2d');
        if (categoryChart) categoryChart.destroy();
        categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(data),
                datasets: [{
                    label: 'المنتجات',
                    data: Object.values(data),
                    backgroundColor: ['#3182CE', '#63B3ED', '#90CDF4', '#EBF8FF']
                }]
            },
            options: { responsive: true, plugins: { legend: { labels: { color: tickColor } } } }
        });
    };

    const initTopProductsChart = (data, tickColor) => {
        const ctx = document.getElementById('top-selling-chart').getContext('2d');
        if (topProductsChart) topProductsChart.destroy();
        topProductsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(p => p.title),
                datasets: [{
                    label: 'المبيعات (وحدة)',
                    data: data.map(p => p.rating.count),
                    backgroundColor: '#63B3ED'
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                scales: { y: { ticks: { color: tickColor } }, x: { ticks: { color: tickColor } } },
                plugins: { legend: { display: false } }
            }
        });
    };

    const exportReportToPDF = async () => {
        const reportContainer = document.getElementById('reports-container');
        const pdfButton = document.getElementById('export-pdf-btn');
        if (!reportContainer || !pdfButton) return;

        const originalText = pdfButton.innerHTML;
        pdfButton.innerHTML = `جاري التصدير... <i class="bx bx-loader-alt bx-spin"></i>`;
        pdfButton.disabled = true;

        try {
            const { jsPDF } = window.jspdf;
            const canvas = await html2canvas(reportContainer, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: 'a4'
            });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save("dashboard-report.pdf");
        } catch (error) {
            console.error("PDF Export Error:", error);
            showToast('فشل تصدير PDF', 'error');
        } finally {
            pdfButton.innerHTML = originalText;
            pdfButton.disabled = false;
        }
    };

    const exportReportToExcel = () => {
        const columns = [
            { label: 'ID', key: 'id' },
            { label: 'Title', key: 'title' },
            { label: 'Price', key: 'price' },
            { label: 'Category', key: 'category' },
            { label: 'Sales', key: 'sales' },
        ];
        const reportData = productsData.map(p => ({ ...p, sales: p.rating.count })); // Add fake sales data
        const csv = toCSV(reportData, columns);
        downloadCSV('products-report.csv', csv);
        showToast('تم تصدير التقرير بنجاح', 'success');
    };

    document.getElementById('export-pdf-btn')?.addEventListener('click', exportReportToPDF);
    document.getElementById('export-excel-btn')?.addEventListener('click', exportReportToExcel);


    // --- SETTINGS PAGE --- //
    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
        const usernameInput = document.getElementById('setting-username');
        const emailInput = document.getElementById('setting-email');
        
        // Pre-fill form with some dummy data
        usernameInput.value = 'Admin User';
        emailInput.value = 'admin@example.com';

        settingsForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const submitButton = settingsForm.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.innerHTML;

            // Basic validation
            if (usernameInput.value.trim() === '' || emailInput.value.trim() === '') {
                showToast('الرجاء ملء جميع الحقول المطلوبة', 'error');
                return;
            }

            submitButton.disabled = true;
            submitButton.innerHTML = `جاري الحفظ... <i class="bx bx-loader-alt bx-spin"></i>`;

            try {
                const response = await fetch('https://jsonplaceholder.typicode.com/users/1', {
                    method: 'PUT',
                    body: JSON.stringify({
                        name: usernameInput.value,
                        email: emailInput.value,
                    }),
                    headers: { 'Content-type': 'application/json; charset=UTF-8' },
                });

                if (!response.ok) throw new Error('Failed to save settings');

                const updatedUser = await response.json();
                console.log('Settings saved:', updatedUser);
                showToast('تم حفظ الإعدادات بنجاح!', 'success');

            } catch (error) {
                console.error('Save settings error:', error);
                showToast('فشل حفظ الإعدادات', 'error');
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonText;
            }
        });
    }
 
    // --- KEYBOARD SHORTCUTS --- //
    document.addEventListener('keydown', (e) => {
        const activeEl = document.activeElement;
        const typing = activeEl && (activeEl.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(activeEl.tagName));
        
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            // ... (existing shortcut logic)
        }
        if (!typing && !e.ctrlKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === 'n') {
            const usersPage = document.getElementById('users-page');
            if (usersPage && usersPage.classList.contains('active')) {
                e.preventDefault();
                openUserModal();
            }
        }
        // ... (existing shortcut logic)
    });

    // --- CHART --- //
    let myChart;
    const chartCanvas = document.getElementById('revenue-chart');
    const initChart = () => {
        if (!chartCanvas) return;
        const isDarkMode = document.body.classList.contains('dark-mode');
        const tickColor = getComputedStyle(document.documentElement).getPropertyValue('--main-text-color').trim() || (isDarkMode ? '#E2E8F0' : '#495057');
        const primary = getComputedStyle(document.documentElement).getPropertyValue('--main-color').trim() || '#5D9CEC';
        const bgPrimary = primary.length === 7 ? `${primary}33` : primary;

        const ctx = chartCanvas.getContext('2d');
        myChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'],
                datasets: [{
                    label: 'الدخل',
                    data: [1200, 1900, 3000, 5000, 2300, 3200],
                    backgroundColor: bgPrimary,
                    borderColor: primary,
                    borderWidth: 1,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true, ticks: { color: tickColor } }, x: { ticks: { color: tickColor } } },
                plugins: { legend: { labels: { color: tickColor } } }
            }
        });
    };

    const updateChartColors = () => {
        if (!myChart) return;
        const isDarkMode = document.body.classList.contains('dark-mode');
        const tickColor = getComputedStyle(document.documentElement).getPropertyValue('--main-text-color').trim() || (isDarkMode ? '#E2E8F0' : '#495057');
        myChart.options.scales.y.ticks.color = tickColor;
        myChart.options.scales.x.ticks.color = tickColor;
        myChart.options.plugins.legend.labels.color = tickColor;
        myChart.update();
    };

    // --- INITIAL LOAD --- //
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (themeToggle) applyTheme(savedTheme);

    fetchAndRenderProjects();
    initChart();

    // --- RIPPLE EFFECT --- //
    function createRipple(event) {
        const button = event.currentTarget;

        const circle = document.createElement("span");
        const diameter = Math.max(button.clientWidth, button.clientHeight);
        const radius = diameter / 2;

        circle.style.width = circle.style.height = `${diameter}px`;
        const rect = button.getBoundingClientRect();
        circle.style.left = `${event.clientX - rect.left - radius}px`;
        circle.style.top = `${event.clientY - rect.top - radius}px`;
        circle.classList.add("ripple");

        const ripple = button.getElementsByClassName("ripple")[0];

        if (ripple) {
            ripple.remove();
        }

        button.appendChild(circle);
    }

    const buttons = document.getElementsByTagName("button");
    for (const button of buttons) {
        button.addEventListener("click", createRipple);
    }
});