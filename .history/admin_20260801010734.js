const moduleOptions = [
  "Unleash Your Life",
  "First Step",
  "Alpha Series",
  "Foundations",
  "Growing Deep",
];

const TOKEN_KEY = "adminToken";

let people = [];
let editingId = null;

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(TOKEN_KEY);
  }
}

function authHeaders(extra = {}) {
  return {
    "Content-Type": "application/json",
    ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    ...extra,
  };
}

async function api(url, options = {}) {
  const res = await fetch(url, options);
  if (res.status === 401) {
    setToken(null);
    showLoginView();
    throw new Error("Session expired. Please sign in again.");
  }
  return res;
}

function showLoginView() {
  document.getElementById("panelView").classList.add("hidden");
  document.getElementById("loginView").classList.remove("hidden");
}

function showPanelView() {
  document.getElementById("loginView").classList.add("hidden");
  document.getElementById("panelView").classList.remove("hidden");
}

function showLoginError(message) {
  const error = document.getElementById("loginError");
  error.textContent = message;
  error.classList.remove("hidden");
}

function hideLoginError() {
  document.getElementById("loginError").classList.add("hidden");
}

function getDefaultRootName() {
  return (
    people.find((p) => !p.discipler && p.name !== "National Office")?.name || ""
  );
}

function populateDisciplerOptions(select, excludeName) {
  select.innerHTML = "";

  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "Pastor / no discipler";
  select.appendChild(empty);

  people.forEach((person) => {
    if (person.name === excludeName) {
      return;
    }
    const option = document.createElement("option");
    option.value = person.name;
    option.textContent = person.name;
    select.appendChild(option);
  });
}

function renderModuleOptions(container, selectedModules = []) {
  container.innerHTML = "";

  moduleOptions.forEach((moduleName) => {
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" name="modules" value="${moduleName}" /> ${moduleName}`;
    if (selectedModules.includes(moduleName)) {
      label.querySelector("input").checked = true;
    }
    container.appendChild(label);
  });
}

function renderTable() {
  const tbody = document.getElementById("peopleTableBody");
  tbody.innerHTML = "";

  document.getElementById("peopleCount").textContent =
    `${people.length} people`;

  people.forEach((person) => {
    const row = document.createElement("tr");

    const nameCell = document.createElement("td");
    nameCell.textContent = person.name;

    const roleCell = document.createElement("td");
    roleCell.textContent =
      person.role || (person.discipler ? "Disciple" : "Pastor");

    const disciplerCell = document.createElement("td");
    disciplerCell.textContent = person.discipler || "—";

    const modulesCell = document.createElement("td");
    if (person.modules?.length) {
      person.modules.forEach((moduleName) => {
        const pill = document.createElement("span");
        pill.className = "module-pill";
        pill.textContent = moduleName;
        modulesCell.appendChild(pill);
      });
    } else {
      modulesCell.textContent = "—";
    }

    const actionsCell = document.createElement("td");

    const editBtn = document.createElement("button");
    editBtn.className = "row-btn";
    editBtn.textContent = "Edit";
    editBtn.type = "button";
    editBtn.addEventListener("click", () => openEditModal(person));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "row-btn danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.type = "button";
    deleteBtn.addEventListener("click", () => handleDelete(person));

    actionsCell.appendChild(editBtn);
    actionsCell.appendChild(deleteBtn);

    row.appendChild(nameCell);
    row.appendChild(roleCell);
    row.appendChild(disciplerCell);
    row.appendChild(modulesCell);
    row.appendChild(actionsCell);

    tbody.appendChild(row);
  });
}

async function loadPeople() {
  const res = await api("/api/people");
  people = await res.json();
  renderTable();
  populateDisciplerOptions(document.getElementById("disciplerInput"));
  document.getElementById("disciplerInput").value = getDefaultRootName();
}

function openEditModal(person) {
  editingId = person.id;

  document.getElementById("editModalTitle").textContent = `Edit ${person.name}`;
  document.getElementById("editNameInput").value = person.name;
  document.getElementById("editRoleInput").value =
    person.role || (person.discipler ? "Disciple" : "Pastor");
  populateDisciplerOptions(
    document.getElementById("editDisciplerInput"),
    person.name,
  );
  document.getElementById("editDisciplerInput").value = person.discipler || "";
  renderModuleOptions(
    document.getElementById("editModuleOptions"),
    person.modules || [],
  );

  document.getElementById("editModal").classList.remove("hidden");
}

function closeEditModal() {
  document.getElementById("editModal").classList.add("hidden");
  editingId = null;
}

async function handleLogin(event) {
  event.preventDefault();
  hideLoginError();

  const form = event.currentTarget;
  const data = new FormData(form);

  const res = await api("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: data.get("username").toString().trim(),
      password: data.get("password").toString(),
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    showLoginError(body.error || "Invalid credentials");
    return;
  }

  const body = await res.json();
  setToken(body.token);
  form.reset();
  showPanelView();
  await loadPeople();
}

async function handleLogout() {
  await api("/api/logout", { method: "POST", headers: authHeaders() }).catch(
    () => {},
  );
  setToken(null);
  showLoginView();
}

async function handleAddPerson(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const data = new FormData(form);
  const name = data.get("name").toString().trim();

  if (!name) {
    return;
  }

  const payload = {
    name,
    discipler: data.get("discipler").toString().trim(),
    role: data.get("role").toString() || "Disciple",
    modules: data.getAll("modules"),
  };

  const res = await api("/api/people", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    alert(body.error || "Failed to add person");
    return;
  }

  form.reset();
  await loadPeople();
}

async function handleSaveEdit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const data = new FormData(form);
  const name = data.get("name").toString().trim();

  if (!name || !editingId) {
    return;
  }

  const payload = {
    name,
    discipler: data.get("discipler").toString().trim(),
    role: data.get("role").toString() || "Disciple",
    modules: data.getAll("modules"),
  };

  const res = await api(`/api/people/${editingId}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    alert(body.error || "Failed to save changes");
    return;
  }

  closeEditModal();
  await loadPeople();
}

async function handleDelete(person) {
  const message = person.modules?.length
    ? `Delete "${person.name}"?\nThey completed: ${person.modules.join(", ")}.`
    : `Delete "${person.name}"?`;

  if (!confirm(message)) {
    return;
  }

  const res = await api(`/api/people/${person.id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    alert(body.error || "Failed to delete person");
    return;
  }

  await loadPeople();
}

async function initialize() {
  renderModuleOptions(document.getElementById("moduleOptions"));
  renderModuleOptions(document.getElementById("editModuleOptions"));

  document.getElementById("loginForm").addEventListener("submit", handleLogin);
  document.getElementById("logoutBtn").addEventListener("click", handleLogout);
  document
    .getElementById("personForm")
    .addEventListener("submit", handleAddPerson);
  document
    .getElementById("editForm")
    .addEventListener("submit", handleSaveEdit);
  document
    .getElementById("closeEditModalBtn")
    .addEventListener("click", closeEditModal);
  document
    .getElementById("cancelEditBtn")
    .addEventListener("click", closeEditModal);
  document.getElementById("editModal").addEventListener("click", (event) => {
    if (event.target.id === "editModal") {
      closeEditModal();
    }
  });

  showLoginView();

  if (!getToken()) {
    return;
  }

  try {
    const res = await api("/api/me", { headers: authHeaders() });
    if (res.ok) {
      showPanelView();
      await loadPeople();
    }
  } catch {
    showLoginView();
  }
}

initialize().catch(console.error);
