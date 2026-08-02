let people = [];

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

function renderModuleOptions(container) {
  container.innerHTML = "";

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

async function fetchPeople() {
  const res = await fetch("/api/people");
  people = await res.json();
  renderTree();
}

const positions = new Map();
let viewOffset = { x: 0, y: 0 };
let interactionState = null;

function getDefaultRootName() {
  return people.find((p) => !p.discipler && p.name !== 'National Office')?.name || "Melchor Cavero";
}

function findPersonByName(name) {
  return people.find((person) => person.name === name) || null;
}

function findPersonById(id) {
  return people.find((person) => person.id === id) || null;
}

function getDepth(person) {
  let depth = 0;
  let current = person;

  while (current.discipler) {
    const parent = findPersonByName(current.discipler);
    if (!parent || parent.id === current.id) {
      break;
    }

    current = parent;
    depth += 1;
  }

  return depth;
}

function getSiblingIndex(person) {
  const siblings = people.filter(
    (candidate) => candidate.discipler === person.discipler,
  );
  return siblings.findIndex((candidate) => candidate.id === person.id);
}

function getPosition(person) {
  const existing = positions.get(person.id);
  if (existing) {
    return existing;
  }

  const depth = getDepth(person);
  const siblingIndex = getSiblingIndex(person);
  const nextPosition = {
    x: 80 + siblingIndex * 280,
    y: 80 + depth * 220,
  };

  positions.set(person.id, nextPosition);
  return nextPosition;
}

function buildTree() {
  people.forEach((person) => {
    person.children = [];
  });

  const rootPeople = people.filter((person) => {
    if (!person.discipler) {
      return true;
    }
    const parent = findPersonByName(person.discipler);
    return !parent || parent.id === person.id;
  });

  people.forEach((person) => {
    if (!person.discipler) {
      return;
    }

    const parent = findPersonByName(person.discipler);
    if (parent && parent.id !== person.id) {
      parent.children.push(person);
    }
  });

  return rootPeople;
}

function drawConnections(canvas, svg) {
  svg.innerHTML = "";
  const width = canvas.clientWidth || 900;
  const height = canvas.clientHeight || 700;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));

  const traverse = (person) => {
    const parentPosition = getPosition(person);
    person.children.forEach((child) => {
      const childPosition = getPosition(child);
      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line",
      );
      const parentX = parentPosition.x + 120 + viewOffset.x;
      const parentY = parentPosition.y + 140 + viewOffset.y;
      const childX = childPosition.x + 120 + viewOffset.x;
      const childY = childPosition.y + 40 + viewOffset.y;
      line.setAttribute("x1", String(parentX));
      line.setAttribute("y1", String(parentY));
      line.setAttribute("x2", String(childX));
      line.setAttribute("y2", String(childY));
      line.setAttribute("stroke", "#c8d3e3");
      line.setAttribute("stroke-width", "2");
      svg.appendChild(line);
      traverse(child);
    });
  };

  buildTree().forEach(traverse);
}

function applyViewportTransform(content) {
  content.style.transform = `translate(${viewOffset.x}px, ${viewOffset.y}px)`;
}

function renderTree() {
  const canvas = document.getElementById("treeCanvas");
  canvas.innerHTML = "";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("tree-lines");
  canvas.appendChild(svg);

  const content = document.createElement("div");
  content.className = "tree-content";
  applyViewportTransform(content);
  canvas.appendChild(content);

  const roots = buildTree();

  roots.forEach((person) => {
    renderPerson(person, content);
  });

  drawConnections(canvas, svg);
}

function renderPerson(person, parent) {
  const node = document.createElement("article");
  const isNO = person.name === 'National Office';
  node.className = `tree-node${!person.discipler ? " is-root" : ""}${isNO ? " is-national-office" : ""}`;
  node.dataset.id = person.id;

  const position = getPosition(person);
  node.style.left = `${position.x}px`;
  node.style.top = `${position.y}px`;

  const title = document.createElement("h3");
  title.textContent = person.name;

  const meta = document.createElement("div");
  meta.className = "card-meta";

  const rolePill = document.createElement("span");
  rolePill.className = "meta-pill";
  rolePill.textContent =
    person.role || (person.discipler ? "Disciple" : "Pastor");
  meta.appendChild(rolePill);

  if (person.discipler) {
    const disciplerPill = document.createElement("span");
    disciplerPill.className = "meta-pill";
    disciplerPill.textContent = `Discipler: ${person.discipler}`;
    meta.appendChild(disciplerPill);
  }

  const modules = document.createElement("div");
  modules.className = "card-modules";
  const moduleNames = Array.isArray(person.modules)
    ? person.modules
    : Object.keys(person.modules || {});
  moduleNames.forEach((moduleName) => {
    const pill = document.createElement("span");
    pill.className = "module-pill";
    const entry = !Array.isArray(person.modules)
      ? person.modules[moduleName] || {}
      : {};
    const date = entry.dateCompleted || entry.dateAttended;
    pill.textContent = date ? `${moduleName} (${date})` : moduleName;
    modules.appendChild(pill);
  });

  node.appendChild(title);
  node.appendChild(meta);
  node.appendChild(modules);

  if (isNO) {
    const badge = document.createElement('span');
    badge.className = 'no-badge';
    badge.textContent = 'Fixed';
    node.appendChild(badge);
  }

  node.addEventListener("pointerdown", handlePointerDown);
  parent.appendChild(node);

  person.children.forEach((child) => renderPerson(child, parent));
}

function populateDisciplerOptions() {
  const select = document.getElementById("disciplerInput");
  select.innerHTML = "";

  const defaultRootName = getDefaultRootName();
  const option = document.createElement("option");
  option.value = "";
  option.textContent = "Pastor / no discipler";
  select.appendChild(option);

  people.forEach((person) => {
    const optionItem = document.createElement("option");
    optionItem.value = person.name;
    optionItem.textContent = person.name;
    select.appendChild(optionItem);
  });

  select.value = defaultRootName;
}

function openModal() {
  document.getElementById("modal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
  document.getElementById("personForm").reset();
  resetModuleOptions(document.getElementById("moduleOptions"));
  populateDisciplerOptions();
}

async function handleSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const data = new FormData(form);
  const personName = data.get("name").toString().trim();

  if (!personName) {
    return;
  }

  const payload = {
    name: personName,
    address: data.get("address").toString().trim(),
    bday: data.get("bday").toString(),
    age: data.get("age").toString().trim(),
    civilStatus: data.get("civilStatus").toString(),
    mobileNumber: data.get("mobileNumber").toString().trim(),
    lccFileNo: data.get("lccFileNo").toString().trim(),
    series: data.get("series").toString().trim(),
    discipler:
      data.get("discipler").toString().trim() || getDefaultRootName(),
    role: "Disciple",
    modules: collectModules(document.getElementById("moduleOptions")),
  };

  const res = await fetch("/api/people", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    showToast("Something went wrong. Please try again.", "error");
    return;
  }

  const discipleNames = data
    .get("disciple")
    .toString()
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  for (const discipleName of discipleNames) {
    await fetch("/api/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: discipleName,
        discipler: personName,
        role: "Disciple",
        modules: {},
      }),
    });
  }

  showToast("Thank you! Your details have been submitted and are pending approval by the admin.");
  await fetchPeople();
  populateDisciplerOptions();
  closeModal();
}

function handlePointerDown(event) {
  const card = event.currentTarget;
  const person = findPersonById(card.dataset.id);
  if (!person || person.name === 'National Office') {
    return;
  }

  interactionState = {
    type: "card",
    id: person.id,
    startX: event.clientX,
    startY: event.clientY,
    startLeft: getPosition(person).x,
    startTop: getPosition(person).y,
  };

  card.setPointerCapture(event.pointerId);
}

function handleCanvasPointerDown(event) {
  if (event.target.closest(".tree-node")) {
    return;
  }

  interactionState = {
    type: "pan",
    startX: event.clientX,
    startY: event.clientY,
    startOffsetX: viewOffset.x,
    startOffsetY: viewOffset.y,
  };

  const canvas = event.currentTarget;
  canvas.classList.add("is-panning");
  canvas.setPointerCapture(event.pointerId);
}

function handlePointerMove(event) {
  if (!interactionState) {
    return;
  }

  if (interactionState.type === "card") {
    const nextPosition = {
      x: interactionState.startLeft + (event.clientX - interactionState.startX),
      y: interactionState.startTop + (event.clientY - interactionState.startY),
    };

    positions.set(interactionState.id, nextPosition);
    const card = document.querySelector(`[data-id="${interactionState.id}"]`);
    if (card) {
      card.style.left = `${nextPosition.x}px`;
      card.style.top = `${nextPosition.y}px`;
    }

    const canvas = document.getElementById("treeCanvas");
    const svg = canvas.querySelector(".tree-lines");
    if (svg) {
      drawConnections(canvas, svg);
    }
  } else {
    viewOffset = {
      x:
        interactionState.startOffsetX +
        (event.clientX - interactionState.startX),
      y:
        interactionState.startOffsetY +
        (event.clientY - interactionState.startY),
    };

    const canvas = document.getElementById("treeCanvas");
    const content = canvas.querySelector(".tree-content");
    const svg = canvas.querySelector(".tree-lines");

    if (content) {
      applyViewportTransform(content);
    }

    if (svg) {
      drawConnections(canvas, svg);
    }
  }
}

function handlePointerUp(event) {
  if (interactionState?.type === "pan") {
    event.currentTarget?.classList?.remove("is-panning");
  }

  interactionState = null;
}

async function initialize() {
  renderModuleOptions(document.getElementById("moduleOptions"));
  document
    .getElementById("moduleOptions")
    .addEventListener("change", handleModuleToggle);
  await fetchPeople();
  populateDisciplerOptions();

  document.getElementById("openFormBtn").addEventListener("click", openModal);
  document
    .getElementById("closeModalBtn")
    .addEventListener("click", closeModal);
  document.getElementById("cancelBtn").addEventListener("click", closeModal);
  document.getElementById("modal").addEventListener("click", (event) => {
    if (event.target.id === "modal") {
      closeModal();
    }
  });
  document
    .getElementById("personForm")
    .addEventListener("submit", handleSubmit);
  const canvas = document.getElementById("treeCanvas");
  canvas.addEventListener("pointerdown", handleCanvasPointerDown);
  canvas.addEventListener("pointerup", handlePointerUp);
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerUp);

  setInterval(() => {
    const modal = document.getElementById("modal");
    if (interactionState || (modal && !modal.classList.contains("hidden"))) {
      return;
    }
    fetchPeople().catch(() => {});
  }, 10000);
}

initialize().catch(console.error);
