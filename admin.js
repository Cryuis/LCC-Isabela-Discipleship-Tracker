const SEMINAR_NAME = "Walk in the Spirit Seminar";

const moduleGroups = [
  { label: "Starter", modules: ["Alpha Series"] },
  {
    label: "Faithfulness",
    modules: ["Unleash your Life", "New Beginnings", "First Step"],
  },
  { label: SEMINAR_NAME, modules: [SEMINAR_NAME], seminar: true },
  {
    label: "Fruitfulness",
    modules: ["Walk for Jesus", "Walk with Jesus", "Walk like Jesus"],
  },
];

function isSeminar(name) {
  return name === SEMINAR_NAME;
}

function normalizeModules(modules) {
  if (!modules) {
    return {};
  }
  if (Array.isArray(modules)) {
    const obj = {};
    modules.forEach((name) => {
      obj[name] = {};
    });
    return obj;
  }
  return modules;
}

function makeModuleField(labelText, type, dataAttr) {
  const label = document.createElement("label");
  const span = document.createElement("span");
  span.textContent = labelText;
  const input = document.createElement("input");
  input.type = type;
  input.setAttribute(`data-${dataAttr}`, "");
  label.appendChild(span);
  label.appendChild(input);
  return label;
}

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

function renderModuleOptions(container, selectedModules = {}) {
  container.innerHTML = "";
  const selected = normalizeModules(selectedModules);

  moduleGroups.forEach((group) => {
    const groupEl = document.createElement("div");
    groupEl.className = "module-group";

    const title = document.createElement("h4");
    title.className = "module-group-title";
    title.textContent = group.label;
    groupEl.appendChild(title);

    const itemsEl = document.createElement("div");
    itemsEl.className = "module-group-items";
    groupEl.appendChild(itemsEl);

    group.modules.forEach((moduleName) => {
      const item = document.createElement("div");
      item.className = "module-group-item";

      const chip = document.createElement("label");
      chip.className = "module-chip";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = moduleName;

      const span = document.createElement("span");
      span.textContent = moduleName;

      chip.appendChild(cb);
      chip.appendChild(span);
      item.appendChild(chip);

      const dates = document.createElement("div");
      dates.className = group.seminar
        ? "module-dates is-seminar hidden"
        : "module-dates hidden";
      if (group.seminar) {
        dates.appendChild(makeModuleField("Date Attended", "date", "attended"));
        dates.appendChild(makeModuleField("Venue", "text", "venue"));
        dates.appendChild(makeModuleField("Pastor", "text", "pastor"));
      } else {
        dates.appendChild(makeModuleField("Date Started", "date", "start"));
        dates.appendChild(makeModuleField("Date Completed", "date", "end"));
      }
      item.appendChild(dates);

      if (selected[moduleName]) {
        cb.checked = true;
        dates.classList.remove("hidden");
        const entry = selected[moduleName];
        if (isSeminar(moduleName)) {
          dates.querySelector("[data-attended]").value =
            entry.dateAttended || "";
          dates.querySelector("[data-venue]").value = entry.venue || "";
          dates.querySelector("[data-pastor]").value = entry.pastor || "";
        } else {
          dates.querySelector("[data-start]").value = entry.dateStarted || "";
          dates.querySelector("[data-end]").value = entry.dateCompleted || "";
        }
      }

      itemsEl.appendChild(item);
    });

    container.appendChild(groupEl);
  });
}

function resetModuleOptions(container) {
  container.querySelectorAll(".module-group-item").forEach((item) => {
    const cb = item.querySelector('input[type="checkbox"]');
    cb.checked = false;
    const panel = item.querySelector(".module-dates");
    panel.classList.add("hidden");
    panel.querySelectorAll("input").forEach((input) => {
      input.value = "";
    });
  });
}

function collectModules(container) {
  const modules = {};
  container.querySelectorAll(".module-group-item").forEach((item) => {
    const cb = item.querySelector('input[type="checkbox"]');
    if (!cb.checked) {
      return;
    }
    const name = cb.value;
    const panel = item.querySelector(".module-dates");
    const entry = {};
    if (isSeminar(name)) {
      entry.dateAttended = panel.querySelector("[data-attended]").value;
      entry.venue = panel.querySelector("[data-venue]").value.trim();
      entry.pastor = panel.querySelector("[data-pastor]").value.trim();
    } else {
      entry.dateStarted = panel.querySelector("[data-start]").value;
      entry.dateCompleted = panel.querySelector("[data-end]").value;
    }
    modules[name] = entry;
  });
  return modules;
}

function handleModuleToggle(event) {
  if (!event.target.matches('input[type="checkbox"]')) {
    return;
  }
  const item = event.target.closest(".module-group-item");
  if (!item) {
    return;
  }
  const panel = item.querySelector(".module-dates");
  panel.classList.toggle("hidden", !event.target.checked);
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
    const personModules = normalizeModules(person.modules);
    const moduleNames = Object.keys(personModules);
    if (moduleNames.length) {
      moduleNames.forEach((moduleName) => {
        const pill = document.createElement("span");
        pill.className = "module-pill";
        const entry = personModules[moduleName] || {};
        const date = entry.dateCompleted || entry.dateAttended;
        pill.textContent = date ? `${moduleName} (${date})` : moduleName;
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
  document.getElementById("editAddressInput").value = person.address || "";
  document.getElementById("editBdayInput").value = person.bday || "";
  document.getElementById("editAgeInput").value = person.age || "";
  document.getElementById("editCivilStatusInput").value =
    person.civilStatus || "";
  document.getElementById("editMobileInput").value =
    person.mobileNumber || "";
  document.getElementById("editLccInput").value = person.lccFileNo || "";
  document.getElementById("editSeriesInput").value = person.series || "";
  document.getElementById("editRoleInput").value =
    person.role || (person.discipler ? "Disciple" : "Pastor");
  populateDisciplerOptions(
    document.getElementById("editDisciplerInput"),
    person.name,
  );
  document.getElementById("editDisciplerInput").value = person.discipler || "";
  renderModuleOptions(
    document.getElementById("editModuleOptions"),
    person.modules,
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

function readForm(form, moduleContainer) {
  const data = new FormData(form);
  return {
    name: data.get("name").toString().trim(),
    address: data.get("address").toString().trim(),
    bday: data.get("bday").toString(),
    age: data.get("age").toString().trim(),
    civilStatus: data.get("civilStatus").toString(),
    mobileNumber: data.get("mobileNumber").toString().trim(),
    lccFileNo: data.get("lccFileNo").toString().trim(),
    series: data.get("series").toString().trim(),
    discipler: data.get("discipler").toString().trim(),
    role: data.get("role").toString() || "Disciple",
    modules: collectModules(moduleContainer),
  };
}

async function handleAddPerson(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const payload = readForm(form, document.getElementById("moduleOptions"));

  if (!payload.name) {
    return;
  }

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
  resetModuleOptions(document.getElementById("moduleOptions"));
  await loadPeople();
}

async function handleSaveEdit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const payload = readForm(form, document.getElementById("editModuleOptions"));

  if (!payload.name || !editingId) {
    return;
  }

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
  const moduleNames = Object.keys(normalizeModules(person.modules));
  const message = moduleNames.length
    ? `Delete "${person.name}"?\nModules: ${moduleNames.join(", ")}.`
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

  document
    .getElementById("moduleOptions")
    .addEventListener("change", handleModuleToggle);
  document
    .getElementById("editModuleOptions")
    .addEventListener("change", handleModuleToggle);

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
