const moduleOptions = [
  "Unleash Your Life",
  "First Step",
  "Alpha Series",
  "Foundations",
  "Growing Deep",
];

const people = [
  {
    id: crypto.randomUUID(),
    name: "Moses",
    discipler: "",
    disciple: "Daniel",
    modules: ["Unleash Your Life", "Alpha Series"],
    children: [],
  },
  {
    id: crypto.randomUUID(),
    name: "Daniel",
    discipler: "Moses",
    disciple: "Sarah",
    modules: ["First Step", "Foundations"],
    children: [],
  },
  {
    id: crypto.randomUUID(),
    name: "Sarah",
    discipler: "Daniel",
    disciple: "",
    modules: ["Alpha Series"],
    children: [],
  },
];

let nextPeople = people;

function createPersonNode(person) {
  const li = document.createElement("li");
  li.className = "tree-item";

  const card = document.createElement("div");
  card.className = "tree-card-node";

  const title = document.createElement("h3");
  title.textContent = person.name;

  const meta = document.createElement("div");
  meta.className = "card-meta";

  if (person.discipler) {
    const disciplerPill = document.createElement("span");
    disciplerPill.className = "meta-pill";
    disciplerPill.textContent = `Discipler: ${person.discipler}`;
    meta.appendChild(disciplerPill);
  }

  if (person.disciple) {
    const disciplePill = document.createElement("span");
    disciplePill.className = "meta-pill";
    disciplePill.textContent = `Disciple: ${person.disciple}`;
    meta.appendChild(disciplePill);
  }

  const modules = document.createElement("div");
  modules.className = "card-modules";
  person.modules.forEach((moduleName) => {
    const pill = document.createElement("span");
    pill.className = "module-pill";
    pill.textContent = moduleName;
    modules.appendChild(pill);
  });

  card.appendChild(title);
  card.appendChild(meta);
  card.appendChild(modules);

  li.appendChild(card);

  if (person.children.length) {
    const childList = document.createElement("ul");
    childList.className = "tree-children";
    person.children.forEach((child) =>
      childList.appendChild(createPersonNode(child)),
    );
    li.appendChild(childList);
  }

  return li;
}

function buildTree() {
  const lookup = new Map(nextPeople.map((person) => [person.id, person]));
  const rootPeople = nextPeople.filter((person) => !person.discipler);

  const attachChildren = (person) => {
    const children = nextPeople.filter(
      (candidate) => candidate.discipler === person.name,
    );
    person.children = children;
    children.forEach(attachChildren);
  };

  rootPeople.forEach(attachChildren);
  return rootPeople;
}

function renderTree() {
  const root = document.getElementById("treeRoot");
  root.innerHTML = "";
  const tree = buildTree();
  const treeList = document.createElement("ul");
  tree.forEach((person) => treeList.appendChild(createPersonNode(person)));
  root.appendChild(treeList);
}

function populateDisciplerOptions() {
  const select = document.getElementById("disciplerInput");
  select.innerHTML = "<option value=''>No discipler yet</option>";

  nextPeople.forEach((person) => {
    const option = document.createElement("option");
    option.value = person.name;
    option.textContent = person.name;
    select.appendChild(option);
  });
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
}

function handleSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const data = new FormData(form);
  const selectedModules = data.getAll("modules");

  const newPerson = {
    id: crypto.randomUUID(),
    name: data.get("name").toString().trim(),
    discipler: data.get("discipler").toString().trim(),
    disciple: data.get("disciple").toString().trim(),
    modules: selectedModules,
    children: [],
  };

  nextPeople = [...nextPeople, newPerson];
  populateDisciplerOptions();
  renderTree();
  closeModal();
}

function initialize() {
  renderModuleOptions();
  populateDisciplerOptions();
  renderTree();

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
}

initialize();
