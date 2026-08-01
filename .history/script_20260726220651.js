const moduleOptions = [
  "Unleash Your Life",
  "First Step",
  "Alpha Series",
  "Foundations",
  "Growing Deep",
];

const initialPeople = [
  {
    id: crypto.randomUUID(),
    name: "Melchor Cavero",
    discipler: "",
    role: "Pastor",
    modules: ["Unleash Your Life"],
    children: [],
  },
  {
    id: crypto.randomUUID(),
    name: "John Doe",
    discipler: "Melchor Cavero",
    role: "Disciple",
    modules: ["First Step"],
    children: [],
  },
];

let people = initialPeople;
const positions = new Map();
let viewOffset = { x: 0, y: 0 };
let interactionState = null;

function getDefaultRootName() {
  return people.find((person) => !person.discipler)?.name || "Melchor Cavero";
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

  const rootPeople = people.filter((person) => !person.discipler);

  people.forEach((person) => {
    if (!person.discipler) {
      return;
    }

    const parent = findPersonByName(person.discipler);
    if (parent) {
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
  node.className = `tree-node${!person.discipler ? " is-root" : ""}`;
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
  person.modules.forEach((moduleName) => {
    const pill = document.createElement("span");
    pill.className = "module-pill";
    pill.textContent = moduleName;
    modules.appendChild(pill);
  });

  node.appendChild(title);
  node.appendChild(meta);
  node.appendChild(modules);
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

function renderModuleOptions() {
  const container = document.getElementById("moduleOptions");
  container.innerHTML = "";

  moduleOptions.forEach((moduleName) => {
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" name="modules" value="${moduleName}" /> ${moduleName}`;
    container.appendChild(label);
  });
}

function openModal() {
  document.getElementById("modal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
  document.getElementById("personForm").reset();
  populateDisciplerOptions();
}

function handleSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const data = new FormData(form);
  const selectedModules = data.getAll("modules");
  const personName = data.get("name").toString().trim();
  const disciplerName =
    data.get("discipler").toString().trim() || getDefaultRootName();
  const discipleNames = data
    .get("disciple")
    .toString()
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  if (!personName) {
    return;
  }

  const newPerson = {
    id: crypto.randomUUID(),
    name: personName,
    discipler: disciplerName,
    role: "Disciple",
    modules: selectedModules,
    children: [],
  };

  people = [...people, newPerson];

  discipleNames.forEach((discipleName) => {
    people = [
      ...people,
      {
        id: crypto.randomUUID(),
        name: discipleName,
        discipler: personName,
        role: "Disciple",
        modules: [],
        children: [],
      },
    ];
  });

  populateDisciplerOptions();
  renderTree();
  closeModal();
}

function handlePointerDown(event) {
  const card = event.currentTarget;
  const person = findPersonById(card.dataset.id);
  if (!person) {
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

function initialize() {
  renderModuleOptions();
  populateDisciplerOptions();
  renderTree();
  openModal();

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
}

initialize();
