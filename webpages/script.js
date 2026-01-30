// ========== Connection to server.js (Node/Express backend) ==========
// This script connects to the API provided by server.js (port 3000).
// - When the page is served by server.js at http://localhost:3000, API calls use the same origin ('').
// - When the page is from file:// or another port (e.g. Live Server 5500), API calls go to http://localhost:3000.
var API_BASE = (function(){
	if (typeof window === 'undefined' || !window.location) return 'http://localhost:3000';
	if (window.location.protocol === 'file:') return 'http://localhost:3000';
	if (window.location.port === '3000') return '';
	if (window.location.hostname === 'localhost' && !window.location.port) return 'http://localhost:3000';
	return 'http://localhost:3000';
})();

// Current user from API (no localStorage) — set on login and on page load from /api/profile
var currentUser = null;

function getAuthHeaders(){
	var token = sessionStorage.getItem('authToken');
	return token ? { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

// Auth modals: init after DOM is ready (migration-guide pattern)
(function(){
	function openRegister(){
		var loginFormWrap = document.getElementById('login-form');
		var regFormWrap = document.getElementById('register-form');
		var backdrop = document.getElementById('modal-backdrop');
		if(!regFormWrap) return;
		if(loginFormWrap){ loginFormWrap.classList.add('hidden'); loginFormWrap.classList.remove('show'); loginFormWrap.style.display = 'none'; }
		if(backdrop){ backdrop.classList.remove('hidden'); backdrop.style.display = 'block'; }
		regFormWrap.classList.remove('hidden');
		regFormWrap.style.display = 'block';
		regFormWrap.style.visibility = 'visible';
		regFormWrap.style.opacity = '1';
		regFormWrap.classList.add('show');
		regFormWrap.setAttribute('aria-hidden', 'false');
	}

	function openLogin(){
		var regFormWrap = document.getElementById('register-form');
		var loginFormWrap = document.getElementById('login-form');
		var backdrop = document.getElementById('modal-backdrop');
		if(!loginFormWrap) return;
		if(regFormWrap){ regFormWrap.classList.add('hidden'); regFormWrap.classList.remove('show'); regFormWrap.style.display = 'none'; }
		if(backdrop){ backdrop.classList.remove('hidden'); backdrop.style.display = 'block'; }
		loginFormWrap.classList.remove('hidden');
		loginFormWrap.style.display = 'block';
		loginFormWrap.style.visibility = 'visible';
		loginFormWrap.style.opacity = '1';
		loginFormWrap.classList.add('show');
		loginFormWrap.setAttribute('aria-hidden', 'false');
	}

	function clearAllAuthForms(){
		var inputs = document.querySelectorAll('#register-form .form-row input, #login-form .form-row input');
		for(var i = 0; i < inputs.length; i++){ inputs[i].value = ''; inputs[i].classList.remove('filled'); }
	}

	function closeAll(){
		var backdrop = document.getElementById('modal-backdrop');
		var regFormWrap = document.getElementById('register-form');
		var loginFormWrap = document.getElementById('login-form');
		if(backdrop){ backdrop.classList.add('hidden'); backdrop.style.display = 'none'; }
		if(regFormWrap){ regFormWrap.classList.remove('show'); regFormWrap.classList.add('hidden'); regFormWrap.style.display = 'none'; regFormWrap.style.visibility = ''; regFormWrap.style.opacity = ''; regFormWrap.setAttribute('aria-hidden', 'true'); }
		if(loginFormWrap){ loginFormWrap.classList.remove('show'); loginFormWrap.classList.add('hidden'); loginFormWrap.style.display = 'none'; loginFormWrap.style.visibility = ''; loginFormWrap.style.opacity = ''; loginFormWrap.setAttribute('aria-hidden', 'true'); }
		clearAllAuthForms();
	}

	function initAuthModals(){
		var loginLink = document.getElementById('login-link');
		var registerLink = document.getElementById('register-link');
		var getStartedBtn = document.getElementById('get-started-btn');
		var closeRegBtn = document.getElementById('close-register');
		var closeLoginBtn = document.getElementById('close-login');
		var backdrop = document.getElementById('modal-backdrop');

		if(loginLink){
			loginLink.addEventListener('click', function(e){ e.preventDefault(); openLogin(); });
		}
		if(registerLink){
			registerLink.addEventListener('click', function(e){ e.preventDefault(); openRegister(); });
		}
		if(getStartedBtn){
			getStartedBtn.addEventListener('click', function(e){ e.preventDefault(); openLogin(); });
		}
		if(closeRegBtn){ closeRegBtn.addEventListener('click', closeAll); }
		if(closeLoginBtn){ closeLoginBtn.addEventListener('click', closeAll); }
		if(backdrop){ backdrop.addEventListener('click', closeAll); }
	}

	if(document.readyState === 'loading'){
		document.addEventListener('DOMContentLoaded', initAuthModals);
	} else {
		initAuthModals();
	}

	// Login form submit (API-based)
	var loginForm = document.getElementById('loginForm');
	if(loginForm){
		loginForm.addEventListener('submit', async function(e){
			e.preventDefault();
			var email = (document.getElementById('login-email').value || '').trim().toLowerCase();
			var password = document.getElementById('login-password').value || '';

			try {
				var response = await fetch(API_BASE + '/api/login', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ username: email, password: password })
				});
				var data = await response.json().catch(function(){ return {}; });
				if(response.ok){
					sessionStorage.setItem('authToken', data.token);
					currentUser = data.user;
					updateUIForLoggedInUser(data.user);
					alert('Logged in as ' + (data.user.email || data.user.username || 'User'));
					closeAll();
				} else {
					alert('Login failed: ' + (data.error || 'Unknown error'));
				}
			} catch(err) {
				alert('Network error. Is the server running?');
			}
		});
	}

	// Register form submit: call API only 
	const form = document.getElementById('registerForm');
	if(form){
		form.addEventListener('submit', async function(e){
			e.preventDefault();
			const email = document.getElementById('email').value.trim().toLowerCase();
			const password = document.getElementById('password').value;
			if(!email || !password){ alert('Email and password required.'); return; }
			try {
				const response = await fetch(API_BASE + '/api/register', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ username: email, password, role: 'user' })
				});
				const data = await response.json().catch(() => ({}));
				if(response.ok){
					closeAll();
					setTimeout(function(){ showVerificationModal(email); }, 500);
				} else if(response.status === 409){
					alert('An account with that email already exists.');
				} else {
					alert(data.error || 'Registration failed.');
				}
			} catch(err){
				alert('Network error. Is the server running?');
			}
		});
	}
	// mark autofilled or prefilled inputs as filled so CSS can style them
	function markFilledInputs(){
		const inputs = document.querySelectorAll('#register-form .form-row input, #register-form .form-row select, #login-form .form-row input');
		inputs.forEach(input => {
			const v = (input.value || '').toString();
			if(v && v.trim() !== ''){ input.classList.add('filled'); } else { input.classList.remove('filled'); }
		});
	}

	// run on load and shortly after to catch browser autofill
	document.addEventListener('DOMContentLoaded', function(){
		markFilledInputs();
		// some browsers fill after load; re-check shortly after
		setTimeout(markFilledInputs, 200);
		setTimeout(markFilledInputs, 800);
	});

	// also update on input/change
	document.addEventListener('input', function(e){ if(e.target && e.target.matches('#register-form .form-row input, #register-form .form-row select, #login-form .form-row input')) markFilledInputs(); });

	// Clear form button
	const clearBtn = document.getElementById('clear-form');
	if(clearBtn){
		clearBtn.addEventListener('click', function(){
			const inputs = document.querySelectorAll('#register-form .form-row input, #register-form .form-row select');
			inputs.forEach(i => { i.value = ''; i.classList.remove('filled'); });
			const first = document.querySelector('#register-form .form-row input'); if(first) first.focus();
		});
	}

	// Clear login button
	const clearLogin = document.getElementById('clear-login');
	if(clearLogin){
		clearLogin.addEventListener('click', function(){
			const inputs = document.querySelectorAll('#login-form .form-row input');
			inputs.forEach(i => { i.value = ''; i.classList.remove('filled'); });
			const first = document.querySelector('#login-form .form-row input'); if(first) first.focus();
		});
	}



	// Function to update UI when user logs in
	function updateUIForLoggedInUser(user){
		document.body.classList.add('logged-in');
		
		// Add admin class if user is admin
		if(user.role === 'admin'){
			document.body.classList.add('is-admin');
		} else {
			document.body.classList.remove('is-admin');
		}
		
		// Hide all content pages first
		document.querySelectorAll('.logged-in-content').forEach(content => {
			content.classList.add('hidden');
		});
		
		// Show profile page by default
		const profileContent = document.getElementById('profile-content');
		if(profileContent){
			profileContent.classList.remove('hidden');
		}
		
		// Update dropdown display name (server returns username/role; may not have firstname/lastname)
		const displayName = document.getElementById('user-display-name');
		if(displayName){
			const name = ((user.firstname || '') + ' ' + (user.lastname || '')).trim();
			displayName.textContent = name || user.username || user.email || user.role || 'User';
		}

		// Update profile info
		const profileName = document.getElementById('profile-name');
		const profileEmail = document.getElementById('profile-email');
		const profileRole = document.getElementById('profile-role');

		if(profileName){
			const fullName = ((user.firstname || '') + ' ' + (user.lastname || '')).trim();
			profileName.textContent = fullName || user.username || user.email || 'User';
		}
		if(profileEmail) profileEmail.textContent = user.email || user.username || '';
		if(profileRole) profileRole.textContent = user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User';
	
	// Hide auth links and show user dropdown when logged in
	const authLinks = document.querySelector('.auth-links');
	const userDropdownContainer = document.querySelector('.user-dropdown-container');
	const loginLinkEl = document.getElementById('login-link');
	const registerLinkEl = document.getElementById('register-link');
	if(authLinks){ authLinks.classList.add('hidden'); authLinks.setAttribute('aria-hidden','true'); }
	if(userDropdownContainer){ userDropdownContainer.classList.remove('hidden'); userDropdownContainer.setAttribute('aria-hidden','false'); }
	// Disable individual auth links (make non-clickable)
	if(loginLinkEl){ loginLinkEl.classList.add('disabled'); loginLinkEl.setAttribute('aria-disabled','true'); loginLinkEl.removeAttribute('href'); loginLinkEl.tabIndex = -1; }
	if(registerLinkEl){ registerLinkEl.classList.add('disabled'); registerLinkEl.setAttribute('aria-disabled','true'); registerLinkEl.removeAttribute('href'); registerLinkEl.tabIndex = -1; }
	}

async function loadAdminDashboard(){
	const res = await fetch(API_BASE + '/api/admin/dashboard', { headers: getAuthHeaders() });
	
	if (res.ok) {
		const data = await res.json();
		document.getElementById('content').innerText = data.message;
	} else {
		document.getElementById('content').innerText = 'Access Denied!'
	}	  


	// On page load: check sessionStorage.authToken, get role via /api/profile, show/hide UI by role
	document.addEventListener('DOMContentLoaded', async function(){
		try{
			const token = sessionStorage.getItem('authToken');
			if(token){
				const resp = await fetch(API_BASE + '/api/profile', {
					headers: { 'Authorization': 'Bearer ' + token }
				});
				if(resp.ok){
					const data = await resp.json();
					currentUser = data.user;
					updateUIForLoggedInUser(currentUser);
				} else {
					sessionStorage.removeItem('authToken');
					currentUser = null;
				}
			}
		}catch(e){}

	// Ensure auth links / dropdown visibility when not logged in
	const authLinksInit = document.querySelector('.auth-links');
	const userDropdownInit = document.querySelector('.user-dropdown-container');
	const loginLinkInit = document.getElementById('login-link');
	const registerLinkInit = document.getElementById('register-link');
	if(!currentUser){
		if(authLinksInit){ authLinksInit.classList.remove('hidden'); authLinksInit.setAttribute('aria-hidden','false'); }
		if(userDropdownInit){ userDropdownInit.classList.add('hidden'); userDropdownInit.setAttribute('aria-hidden','true'); }
		// Ensure links are enabled
		if(loginLinkInit){ loginLinkInit.classList.remove('disabled'); loginLinkInit.setAttribute('href','#'); loginLinkInit.setAttribute('aria-disabled','false'); loginLinkInit.tabIndex = 0; }
		if(registerLinkInit){ registerLinkInit.classList.remove('disabled'); registerLinkInit.setAttribute('href','#'); registerLinkInit.setAttribute('aria-disabled','false'); registerLinkInit.tabIndex = 0; }
	}
	});
}
	// Dropdown toggle functionality
	const dropdownBtn = document.getElementById('user-dropdown-btn');
	const dropdownMenu = document.getElementById('user-dropdown-menu');
	
	if(dropdownBtn && dropdownMenu){
		dropdownBtn.addEventListener('click', function(e){
			e.stopPropagation();
			dropdownMenu.classList.toggle('hidden');
			dropdownBtn.classList.toggle('active');
		});
		
		// Close dropdown when clicking outside
		document.addEventListener('click', function(e){
			if(!dropdownBtn.contains(e.target) && !dropdownMenu.contains(e.target)){
				dropdownMenu.classList.add('hidden');
				dropdownBtn.classList.remove('active');
			}
		});
		
		// Handle dropdown menu item clicks
		const dropdownLinks = dropdownMenu.querySelectorAll('a');
		dropdownLinks.forEach(link => {
			link.addEventListener('click', function(e){
				e.preventDefault();
				const page = this.getAttribute('data-page');
				
				// Hide all content pages
				document.querySelectorAll('.logged-in-content').forEach(content => {
					content.classList.add('hidden');
				});
				
				// Show selected page
				if(page === 'profile'){
					document.getElementById('profile-content').classList.remove('hidden');
				} else if(page === 'employees'){
					document.getElementById('employees-content').classList.remove('hidden');
					loadEmployees();
					updateEmployeeDepartmentDropdown();
				} else if(page === 'accounts'){
					if(!currentUser || currentUser.role !== 'admin'){
						alert('Access denied. Admin only.');
						return;
					}
					document.getElementById('accounts-content').classList.remove('hidden');
					loadAccounts();
				} else if(page === 'departments'){
					document.getElementById('departments-content').classList.remove('hidden');
					loadDepartments();
				} else if(page === 'requests'){
					document.getElementById('requests-content').classList.remove('hidden');
					loadRequests();
				}
				
				dropdownMenu.classList.add('hidden');
				dropdownBtn.classList.remove('active');
			});
		});
	}

	// Logout functionality
	const logoutLink = document.getElementById('logout-link');
	if(logoutLink){
		logoutLink.addEventListener('click', function(e){
			e.preventDefault();
			sessionStorage.removeItem('authToken');
			currentUser = null;
			// Remove logged-in/admin state
			document.body.classList.remove('logged-in');
			document.body.classList.remove('is-admin');

			// Hide all logged-in content and show the welcome content
			document.querySelectorAll('.logged-in-content').forEach(function(c){ c.classList.add('hidden'); });
			var welcome = document.getElementById('welcome-content'); if(welcome) welcome.classList.remove('hidden');

			// Reset forms
			clearAllAuthForms();

			// Close dropdown if open
			if(dropdownMenu) dropdownMenu.classList.add('hidden');
			if(dropdownBtn) dropdownBtn.classList.remove('active');

			// Show auth links and hide user dropdown container
			var authLinksEl = document.querySelector('.auth-links');
			var userDropdownContainer = document.querySelector('.user-dropdown-container');
			if(authLinksEl){ authLinksEl.classList.remove('hidden'); authLinksEl.setAttribute('aria-hidden','false'); }
			if(userDropdownContainer){ userDropdownContainer.classList.add('hidden'); userDropdownContainer.setAttribute('aria-hidden','true'); }

			// Re-enable login/register links
			const loginLinkEl = document.getElementById('login-link');
			const registerLinkEl = document.getElementById('register-link');
			if(loginLinkEl){ loginLinkEl.classList.remove('disabled'); loginLinkEl.setAttribute('href','#'); loginLinkEl.setAttribute('aria-disabled','false'); loginLinkEl.tabIndex = 0; }
			if(registerLinkEl){ registerLinkEl.classList.remove('disabled'); registerLinkEl.setAttribute('href','#'); registerLinkEl.setAttribute('aria-disabled','false'); registerLinkEl.tabIndex = 0; }
			alert('Logged out successfully');
		});
	}

	// Employee management (API only)
	let editingEmployeeId = null;

	function saveEmployee(employee){
		var method = editingEmployeeId ? 'PUT' : 'POST';
		var url = editingEmployeeId ? API_BASE + '/api/employees/' + editingEmployeeId : API_BASE + '/api/employees';
		fetch(url, { method: method, headers: getAuthHeaders(), body: JSON.stringify(employee) })
			.then(function(res){ if(res.ok || res.status === 204){ loadEmployees(); resetEmployeeForm(); alert(editingEmployeeId ? 'Employee updated!' : 'Employee added!'); } else { res.json().then(function(d){ alert(d.error || 'Failed'); }); } })
			.catch(function(){ alert('Network error'); });
	}

	function deleteEmployee(id){
		if(!confirm('Are you sure you want to delete this employee?')) return;
		fetch(API_BASE + '/api/employees/' + id, { method: 'DELETE', headers: getAuthHeaders() })
			.then(function(res){ if(res.ok || res.status === 204){ loadEmployees(); } else { alert('Failed to delete'); } })
			.catch(function(){ alert('Network error'); });
	}

	function editEmployee(id){
		fetch(API_BASE + '/api/employees', { headers: getAuthHeaders() })
			.then(function(r){ return r.json(); })
			.then(function(employees){
				var employee = employees.find(function(e){ return e.id === id; });
				if(employee){
					editingEmployeeId = id;
					document.getElementById('employee-id').value = employee.employeeId || '';
					document.getElementById('employee-email').value = employee.userEmail || '';
					document.getElementById('employee-position').value = employee.position || '';
					var deptSelect = document.getElementById('employee-department');
					if(deptSelect) deptSelect.value = employee.department || '';
					document.getElementById('employee-hire-date').value = employee.hireDate || '';
					markEmployeeFormFields();
					showEmployeeForm();
				}
			})
			.catch(function(){ alert('Network error'); });
	}

	function resetEmployeeForm(){
		editingEmployeeId = null;
		document.getElementById('employee-form').reset();
		const deptSelect = document.getElementById('employee-department');
		deptSelect.value = '';
		markEmployeeFormFields();
		hideEmployeeForm();
	}

	function showEmployeeForm(){
		const formContainer = document.querySelector('.employee-form-container');
		if(formContainer){
			formContainer.classList.add('show');
			formContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		}
	}

	function hideEmployeeForm(){
		const formContainer = document.querySelector('.employee-form-container');
		if(formContainer){
			formContainer.classList.remove('show');
		}
	}

	function loadEmployees(){
		var tbody = document.getElementById('employees-table-body');
		if(!tbody) return;
		fetch(API_BASE + '/api/employees', { headers: getAuthHeaders() })
			.then(function(r){ return r.json(); })
			.then(function(employees){
				if(!employees || employees.length === 0){
					tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No employees.</td></tr>';
					return;
				}
				tbody.innerHTML = employees.map(function(emp){
					return '<tr><td>' + (emp.employeeId || emp.id) + '</td><td>' + (emp.userEmail || '') + '</td><td>' + (emp.position || '') + '</td><td>' + (emp.department || '') + '</td><td><div class="action-buttons"><button class="action-btn edit-action-btn" onclick="window.editEmployee(' + emp.id + ')">Edit</button><button class="action-btn delete-action-btn" onclick="window.deleteEmployee(' + emp.id + ')">Delete</button></div></td></tr>';
				}).join('');
			})
			.catch(function(){ tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Error loading employees.</td></tr>'; });
	}

	// Expose functions globally for onclick handlers
	window.editEmployee = editEmployee;
	window.deleteEmployee = deleteEmployee;

	// Employee form submission
	var employeeForm = document.getElementById('employee-form');
	if(employeeForm){
		employeeForm.addEventListener('submit', function(e){
			e.preventDefault();
			var employeeData = {
				employeeId: document.getElementById('employee-id').value.trim(),
				userEmail: document.getElementById('employee-email').value.trim().toLowerCase(),
				position: document.getElementById('employee-position').value.trim(),
				department: document.getElementById('employee-department').value.trim(),
				hireDate: document.getElementById('employee-hire-date').value
			};
			saveEmployee(employeeData);
		});
	}

	// Add employee button
	const addEmployeeBtn = document.getElementById('add-employee-btn');
	if(addEmployeeBtn){
		addEmployeeBtn.addEventListener('click', function(){
			editingEmployeeId = null;
			document.getElementById('employee-form').reset();
			const deptSelect = document.getElementById('employee-department');
			deptSelect.value = '';
			markEmployeeFormFields();
			showEmployeeForm();
		});
	}

	// Cancel employee form
	const cancelEmployeeBtn = document.getElementById('cancel-employee-btn');
	if(cancelEmployeeBtn){
		cancelEmployeeBtn.addEventListener('click', function(){
			resetEmployeeForm();
		});
	}

	// Mark employee form fields with values as filled
	function markEmployeeFormFields(){
		const inputs = document.querySelectorAll('#employee-form input, #employee-form select');
		inputs.forEach(input => {
			if(input.value && input.value.trim() !== ''){
				input.classList.add('filled');
			} else {
				input.classList.remove('filled');
			}
		});
	}

	// Check employee form fields on load and input
	document.addEventListener('DOMContentLoaded', function(){
		setTimeout(markEmployeeFormFields, 100);
	});

	const employeeFormInputs = document.querySelectorAll('#employee-form input, #employee-form select');
	employeeFormInputs.forEach(input => {
		input.addEventListener('input', markEmployeeFormFields);
		input.addEventListener('change', markEmployeeFormFields);
	});

	// Department management (API only)
	var editingDepartmentId = null;

	function saveDepartment(department){
		var method = editingDepartmentId ? 'PUT' : 'POST';
		var url = editingDepartmentId ? API_BASE + '/api/departments/' + editingDepartmentId : API_BASE + '/api/departments';
		fetch(url, { method: method, headers: getAuthHeaders(), body: JSON.stringify(department) })
			.then(function(res){ if(res.ok || res.status === 204){ loadDepartments(); updateEmployeeDepartmentDropdown(); resetDepartmentForm(); alert(editingDepartmentId ? 'Department updated!' : 'Department added!'); } else { res.json().then(function(d){ alert(d.error || 'Failed'); }); } })
			.catch(function(){ alert('Network error'); });
	}

	function deleteDepartment(id){
		if(!confirm('Are you sure you want to delete this department?')) return;
		fetch(API_BASE + '/api/departments/' + id, { method: 'DELETE', headers: getAuthHeaders() })
			.then(function(res){ if(res.ok || res.status === 204){ loadDepartments(); updateEmployeeDepartmentDropdown(); } else { alert('Failed to delete'); } })
			.catch(function(){ alert('Network error'); });
	}

	function editDepartment(id){
		fetch(API_BASE + '/api/departments', { headers: getAuthHeaders() })
			.then(function(r){ return r.json(); })
			.then(function(departments){
				var department = departments.find(function(d){ return d.id === id; });
				if(department){
					editingDepartmentId = id;
					document.getElementById('department-name').value = department.name || '';
					document.getElementById('department-description').value = department.description || '';
					showDepartmentForm();
				}
			})
			.catch(function(){ alert('Network error'); });
	}

	function resetDepartmentForm(){
		editingDepartmentId = null;
		document.getElementById('department-form').reset();
		hideDepartmentForm();
	}

	function showDepartmentForm(){
		const formContainer = document.getElementById('department-form-container');
		if(formContainer){
			formContainer.classList.add('show');
			formContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		}
	}

	function hideDepartmentForm(){
		const formContainer = document.getElementById('department-form-container');
		if(formContainer){
			formContainer.classList.remove('show');
		}
	}

	function loadDepartments(){
		var tbody = document.getElementById('departments-table-body');
		if(!tbody) return;
		fetch(API_BASE + '/api/departments', { headers: getAuthHeaders() })
			.then(function(r){ return r.json(); })
			.then(function(departments){
				if(!departments || departments.length === 0){
					tbody.innerHTML = '<tr class="empty-row"><td colspan="3">No departments.</td></tr>';
					return;
				}
				tbody.innerHTML = departments.map(function(dept){
					return '<tr><td>' + (dept.name || '') + '</td><td>' + (dept.description || '') + '</td><td><div class="action-buttons"><button class="action-btn edit-action-btn" onclick="window.editDepartment(' + dept.id + ')">Edit</button><button class="action-btn delete-action-btn" onclick="window.deleteDepartment(' + dept.id + ')">Delete</button></div></td></tr>';
				}).join('');
			})
			.catch(function(){ tbody.innerHTML = '<tr class="empty-row"><td colspan="3">Error loading departments.</td></tr>'; });
	}

	function updateEmployeeDepartmentDropdown(){
		var deptSelect = document.getElementById('employee-department');
		if(!deptSelect) return;
		var currentValue = deptSelect.value;
		fetch(API_BASE + '/api/departments', { headers: getAuthHeaders() })
			.then(function(r){ return r.json(); })
			.then(function(departments){
				deptSelect.innerHTML = '<option value="" disabled selected hidden></option>';
				(departments || []).forEach(function(dept){
					var option = document.createElement('option');
					option.value = dept.name;
					option.textContent = dept.name;
					deptSelect.appendChild(option);
				});
				if(currentValue && (departments || []).find(function(d){ return d.name === currentValue; })){ deptSelect.value = currentValue; }
			})
			.catch(function(){});
	}

	// Expose department functions globally
	window.editDepartment = editDepartment;
	window.deleteDepartment = deleteDepartment;

	// Department form submission
	var departmentForm = document.getElementById('department-form');
	if(departmentForm){
		departmentForm.addEventListener('submit', function(e){
			e.preventDefault();
			var departmentData = {
				name: document.getElementById('department-name').value.trim(),
				description: document.getElementById('department-description').value.trim()
			};
			saveDepartment(departmentData);
		});
	}

	// Add department button
	const addDepartmentBtn = document.getElementById('add-department-btn');
	if(addDepartmentBtn){
		addDepartmentBtn.addEventListener('click', function(){
			editingDepartmentId = null;
			document.getElementById('department-form').reset();
			showDepartmentForm();
		});
	}


	const cancelDepartmentBtn = document.getElementById('cancel-department-btn');
	if(cancelDepartmentBtn){
		cancelDepartmentBtn.addEventListener('click', function(){
			resetDepartmentForm();
		});
	}


	document.addEventListener('DOMContentLoaded', function(){
		updateEmployeeDepartmentDropdown();
	});

	function showVerificationModal(email){
		var verifyModal = document.getElementById('verify-email-form');
		var verifyEmailAddress = document.getElementById('verify-email-address');
		var bd = document.getElementById('modal-backdrop');
		if(verifyEmailAddress) verifyEmailAddress.textContent = email;
		if(bd) bd.classList.remove('hidden');
		if(verifyModal){
			verifyModal.classList.remove('hidden');
			verifyModal.setAttribute('aria-hidden','false');
			requestAnimationFrame(function(){ verifyModal.classList.add('show'); });
		}
	}

	function closeVerificationModal(){
		var verifyModal = document.getElementById('verify-email-form');
		var bd = document.getElementById('modal-backdrop');
		if(bd) bd.classList.add('hidden');
		if(verifyModal){
			verifyModal.classList.remove('show');
			setTimeout(function(){ verifyModal.classList.add('hidden'); verifyModal.setAttribute('aria-hidden','true'); }, 500);
		}
	}

	var simulateVerifyBtn = document.getElementById('simulate-verify-btn');
	if(simulateVerifyBtn){
		simulateVerifyBtn.addEventListener('click', function(){
			alert('Email verified! You can now login.');
			closeVerificationModal();
			openLogin();
		});
	}

	const goToLoginBtn = document.getElementById('go-to-login-btn');
	if(goToLoginBtn){
		goToLoginBtn.addEventListener('click', function(){
			closeVerificationModal();
			openLogin();
		});
	}

	const closeVerifyBtn = document.getElementById('close-verify');
	if(closeVerifyBtn){
		closeVerifyBtn.addEventListener('click', function(){
			closeVerificationModal();
		});
	}


	var editingAccountId = null;
	var accountToDelete = null;

	function saveAccountToDB(account){
		var username = (account.email || account.username || '').trim().toLowerCase();
		var password = account.password;
		var role = account.role || 'user';
		if(!username){ alert('Username required.'); return; }
		if(!editingAccountId && (!password || password.length < 6)){ alert('Password must be at least 6 characters.'); return; }
		var method = editingAccountId ? 'PUT' : 'POST';
		var url = editingAccountId ? API_BASE + '/api/users/' + editingAccountId : API_BASE + '/api/users';
		var body = editingAccountId ? { username: username, role: role } : { username: username, password: password, role: role };
		if(editingAccountId && password && password.length >= 6) body.password = password;
		fetch(url, { method: method, headers: getAuthHeaders(), body: JSON.stringify(body) })
			.then(function(res){ return res.ok ? Promise.resolve() : res.json().then(function(d){ return Promise.reject(d); }); })
			.then(function(){ loadAccounts(); resetAccountForm(); alert(editingAccountId ? 'Account updated!' : 'Account added!'); })
			.catch(function(d){ alert(d.error || 'Failed'); });
	}

	function deleteAccount(id){
		fetch(API_BASE + '/api/users', { headers: getAuthHeaders() })
			.then(function(r){ return r.json(); })
			.then(function(accounts){
				var account = accounts.find(function(a){ return a.id === id; });
				if(!account){ alert('Account not found.'); return; }
				accountToDelete = account;
				showDeleteAccountModal(account.username);
			})
			.catch(function(){ alert('Network error'); });
	}

	function confirmDeleteAccount(){
		if(!accountToDelete) return;
		var id = accountToDelete.id;
		fetch(API_BASE + '/api/users/' + id, { method: 'DELETE', headers: getAuthHeaders() })
			.then(function(res){ if(res.ok || res.status === 204){ loadAccounts(); closeDeleteAccountModal(); accountToDelete = null; } else { return res.json().then(function(d){ alert(d.error || 'Failed'); }); } })
			.catch(function(d){ alert(d && d.error ? d.error : 'Network error'); });
	}

	function showDeleteAccountModal(username){
		var deleteModal = document.getElementById('delete-account-modal');
		var deleteEmailSpan = document.getElementById('delete-account-email');
		var bd = document.getElementById('modal-backdrop');
		if(deleteEmailSpan) deleteEmailSpan.textContent = username || '';
		if(bd) bd.classList.remove('hidden');
		if(deleteModal){ deleteModal.classList.remove('hidden'); deleteModal.setAttribute('aria-hidden','false'); requestAnimationFrame(function(){ deleteModal.classList.add('show'); }); }
	}

	function closeDeleteAccountModal(){
		var deleteModal = document.getElementById('delete-account-modal');
		var bd = document.getElementById('modal-backdrop');
		if(bd) bd.classList.add('hidden');
		if(deleteModal){ deleteModal.classList.remove('show'); setTimeout(function(){ deleteModal.classList.add('hidden'); deleteModal.setAttribute('aria-hidden','true'); }, 500); }
		accountToDelete = null;
	}

	function editAccount(id){
		fetch(API_BASE + '/api/users', { headers: getAuthHeaders() })
			.then(function(r){ return r.json(); })
			.then(function(accounts){
				var account = accounts.find(function(a){ return a.id === id; });
				if(account){
					editingAccountId = id;
					document.getElementById('account-email').value = account.username || '';
					document.getElementById('account-password').value = '';
					document.getElementById('account-role').value = account.role || 'user';
					showAccountForm();
				}
			})
			.catch(function(){ alert('Network error'); });
	}

	function resetPassword(id){
		var newPassword = prompt('Enter new password (min 6 characters):');
		if(!newPassword || newPassword.length < 6){ if(newPassword) alert('Password must be at least 6 characters.'); return; }
		fetch(API_BASE + '/api/users/' + id, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ password: newPassword }) })
			.then(function(res){ if(res.ok){ alert('Password reset successfully.'); loadAccounts(); } else { return res.json().then(function(d){ alert(d.error || 'Failed'); }); } })
			.catch(function(){ alert('Network error'); });
	}

	function resetAccountForm(){
		editingAccountId = null;
		document.getElementById('account-form').reset();
		hideAccountForm();
	}

	function showAccountForm(){
		var formContainer = document.getElementById('account-form-container');
		if(formContainer){ formContainer.classList.add('show'); formContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
	}

	function hideAccountForm(){
		var formContainer = document.getElementById('account-form-container');
		if(formContainer) formContainer.classList.remove('show');
	}

	function loadAccounts(){
		var tbody = document.getElementById('accounts-table-body');
		if(!tbody) return;
		fetch(API_BASE + '/api/users', { headers: getAuthHeaders() })
			.then(function(r){ return r.json(); })
			.then(function(accounts){
				if(!accounts || accounts.length === 0){ tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No accounts.</td></tr>'; return; }
				tbody.innerHTML = accounts.map(function(acc){
					var roleStr = acc.role ? acc.role.charAt(0).toUpperCase() + acc.role.slice(1) : 'User';
					return '<tr><td>' + (acc.username || '') + '</td><td>' + (acc.username || '') + '</td><td>' + roleStr + '</td><td>—</td><td><div class="action-buttons"><button class="action-btn edit-action-btn" onclick="window.editAccount(' + acc.id + ')">Edit</button><button class="action-btn edit-action-btn" onclick="window.resetPassword(' + acc.id + ')" style="background-color:#ff9800;">Reset PW</button><button class="action-btn delete-action-btn" onclick="window.deleteAccount(' + acc.id + ')">Delete</button></div></td></tr>';
				}).join('');
			})
			.catch(function(){ tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Error loading accounts.</td></tr>'; });
	}

	window.editAccount = editAccount;
	window.deleteAccount = deleteAccount;
	window.resetPassword = resetPassword;

	var accountForm = document.getElementById('account-form');
	if(accountForm){
		accountForm.addEventListener('submit', function(e){
			e.preventDefault();
			var accountData = {
				email: document.getElementById('account-email').value.trim().toLowerCase(),
				password: document.getElementById('account-password').value,
				role: document.getElementById('account-role').value
			};
			saveAccountToDB(accountData);
		});
	}

	var addAccountBtn = document.getElementById('add-account-btn');
	if(addAccountBtn){
		addAccountBtn.addEventListener('click', function(){
			editingAccountId = null;
			document.getElementById('account-form').reset();
			showAccountForm();
		});
	}

	const cancelAccountBtn = document.getElementById('cancel-account-btn');
	if(cancelAccountBtn){
		cancelAccountBtn.addEventListener('click', function(){
			resetAccountForm();
		});
	}

	// Delete Account Modal Event Handlers
	const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
	if(confirmDeleteBtn){
		confirmDeleteBtn.addEventListener('click', function(){
			confirmDeleteAccount();
		});
	}

	const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
	if(cancelDeleteBtn){
		cancelDeleteBtn.addEventListener('click', function(){
			closeDeleteAccountModal();
		});
	}

	const closeDeleteModalBtn = document.getElementById('close-delete-modal');
	if(closeDeleteModalBtn){
		closeDeleteModalBtn.addEventListener('click', function(){
			closeDeleteAccountModal();
		});
	}

	// Requests Management (API only)
	var editingRequestId = null;

	function saveRequest(request){
		fetch(API_BASE + '/api/requests', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ type: request.type, items: request.items }) })
			.then(function(res){ if(res.ok || res.status === 201){ loadRequests(); resetRequestForm(); alert('Request submitted successfully!'); } else { res.json().then(function(d){ alert(d.error || 'Failed'); }); } })
			.catch(function(){ alert('Network error'); });
	}

	function deleteRequest(id){
		if(!confirm('Are you sure you want to delete this request?')) return;
		fetch(API_BASE + '/api/requests/' + id, { method: 'DELETE', headers: getAuthHeaders() })
			.then(function(res){ if(res.ok || res.status === 204){ loadRequests(); } else { alert('Failed to delete'); } })
			.catch(function(){ alert('Network error'); });
	}

	function resetRequestForm(){
		editingRequestId = null;
		document.getElementById('request-form').reset();
		document.getElementById('request-items-container').innerHTML = `
			<div class="request-item-row">
				<input type="text" class="item-name" placeholder="Item name" required>
				<input type="number" class="item-qty" placeholder="Qty" min="1" required>
				<button type="button" class="remove-item-btn">×</button>
			</div>
		`;
		setupRequestItemHandlers();
		hideRequestForm();
	}

	function showRequestForm(){
		const formContainer = document.getElementById('request-form-container');
		if(formContainer){
			formContainer.classList.add('show');
			formContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		}
	}

	function hideRequestForm(){
		const formContainer = document.getElementById('request-form-container');
		if(formContainer){
			formContainer.classList.remove('show');
		}
	}

	function setupRequestItemHandlers(){
		document.querySelectorAll('.remove-item-btn').forEach(btn => {
			btn.addEventListener('click', function(){
				if(document.querySelectorAll('.request-item-row').length > 1){
					this.closest('.request-item-row').remove();
				} else {
					alert('At least one item is required.');
				}
			});
		});
	}

	function loadRequests(){
		var tbody = document.getElementById('requests-table-body');
		if(!tbody) return;
		fetch(API_BASE + '/api/requests', { headers: getAuthHeaders() })
			.then(function(r){ return r.json(); })
			.then(function(requests){
				if(!requests || requests.length === 0){ tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No requests.</td></tr>'; return; }
				var statusClass = function(s){ return s === 'Approved' ? 'badge-success' : s === 'Rejected' ? 'badge-danger' : 'badge-warning'; };
				tbody.innerHTML = requests.map(function(req){
					var itemsText = req.items && req.items.length ? req.items.map(function(i){ return i.name + ' (' + (i.qty || 0) + ')'; }).join(', ') : '';
					return '<tr><td>' + (req.type || '') + '</td><td>' + itemsText + '</td><td>' + (req.date || '') + '</td><td><span class="badge ' + statusClass(req.status || 'Pending') + '">' + (req.status || 'Pending') + '</span></td><td><div class="action-buttons"><button class="action-btn delete-action-btn" onclick="window.deleteRequest(' + req.id + ')">Delete</button></div></td></tr>';
				}).join('');
			})
			.catch(function(){ tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Error loading requests.</td></tr>'; });
	}

	window.deleteRequest = deleteRequest;

	const requestForm = document.getElementById('request-form');
	if(requestForm){
		requestForm.addEventListener('submit', function(e){
			e.preventDefault();
			const type = document.getElementById('request-type').value;
			const itemRows = document.querySelectorAll('.request-item-row');
			const items = [];
			
			itemRows.forEach(row => {
				const name = row.querySelector('.item-name').value.trim();
				const qty = parseInt(row.querySelector('.item-qty').value);
				if(name && qty > 0){
					items.push({ name, qty });
				}
			});
			
			if(items.length === 0){
				alert('Please add at least one item.');
				return;
			}
			
			saveRequest({ type: type, items: items });
		});
	}

	const addRequestBtn = document.getElementById('add-request-btn');
	if(addRequestBtn){
		addRequestBtn.addEventListener('click', function(){
			resetRequestForm();
			showRequestForm();
		});
	}

	const addItemBtn = document.getElementById('add-item-btn');
	if(addItemBtn){
		addItemBtn.addEventListener('click', function(){
			const container = document.getElementById('request-items-container');
			const newRow = document.createElement('div');
			newRow.className = 'request-item-row';
			newRow.innerHTML = `
				<input type="text" class="item-name" placeholder="Item name" required>
				<input type="number" class="item-qty" placeholder="Qty" min="1" required>
				<button type="button" class="remove-item-btn">×</button>
			`;
			container.appendChild(newRow);
			setupRequestItemHandlers();
		});
	}

	const cancelRequestBtn = document.getElementById('cancel-request-btn');
	if(cancelRequestBtn){
		cancelRequestBtn.addEventListener('click', function(){
			resetRequestForm();
		});
	}

	document.addEventListener('DOMContentLoaded', function(){
		setupRequestItemHandlers();
	});

})();
