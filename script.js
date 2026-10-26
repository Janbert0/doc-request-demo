// ----- DEMO DATA -----
// Edit fees and document names here. These are sample values only.
const DOCUMENTS = [
  { name: "Certificate of Enrollment", fee: 50 },
  { name: "Certificate of Grades", fee: 30 },
  { name: "Official Transcript of Records (TOR)", fee: 100 },
  { name: "Certificate of Good Moral Character", fee: 40 },
  { name: "Certificate of Graduation", fee: 60 },
  { name: "Diploma Request", fee: 150 },
  { name: "Honorable Dismissal / Transfer Credentials", fee: 120 },
  { name: "Certificate of Units Earned", fee: 30 },
  { name: "Other Registrar Documents", fee: 50 }
];

// Allowed status changes. Anything not listed here is blocked.
const TRANSITIONS = {
  "Pending": ["Under Review", "Cancelled"],
  "Under Review": ["Approved", "For Correction", "Rejected"],
  "For Correction": ["Under Review", "Cancelled"],
  "Approved": ["Processing"],
  "Processing": ["Ready for Pickup"],
  "Ready for Pickup": ["Released"],
  "Released": ["Completed"],
  "Rejected": [],
  "Cancelled": [],
  "Completed": []
};

const STORAGE_KEY = "docRequestDemo";

// ----- STATE -----
let state = { session: null, requests: [] };

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) state = saved;
  } catch (e) {
    // If saved data is corrupted, start fresh
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ----- HELPERS -----
function $(id) { return document.getElementById(id); }

function badgeClass(status) {
  if (status === "Completed" || status === "Released") return "badge done";
  if (status === "Rejected" || status === "Cancelled") return "badge bad";
  if (status === "Pending" || status === "For Correction") return "badge progress";
  return "badge";
}

function makeCell(content) {
  const td = document.createElement("td");
  if (content instanceof Node) {
    td.appendChild(content);
  } else {
    td.textContent = content;
  }
  return td;
}

function makeBadge(status) {
  const span = document.createElement("span");
  span.className = badgeClass(status);
  span.textContent = status;
  return span;
}

function makeEmptyRow(colspan, message) {
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = colspan;
  td.className = "empty";
  td.textContent = message;
  tr.appendChild(td);
  return tr;
}

function newReference() {
  return "REQ-" + Date.now().toString().slice(-7);
}

// ----- VIEWS -----
function render() {
  const s = state.session;
  $("loginView").classList.toggle("hidden", !!s);
  $("studentView").classList.toggle("hidden", !s || s.role !== "student");
  $("registrarView").classList.toggle("hidden", !s || s.role !== "registrar");
  $("logoutBtn").classList.toggle("hidden", !s);

  if (s && s.role === "student") renderStudent();
  if (s && s.role === "registrar") renderRegistrar();
}

// ----- LOGIN -----
function handleLogin(event) {
  event.preventDefault();
  const name = $("loginName").value.trim();
  const role = $("loginRole").value;
  const number = $("loginNumber").value.trim();

  if (!name) {
    alert("Please enter your name.");
    return;
  }
  if (role === "student" && !number) {
    alert("Students must enter a student number.");
    return;
  }

  state.session = { name: name, role: role, number: role === "student" ? number : "" };
  saveState();
  $("loginForm").reset();
  render();
}

function handleLogout() {
  state.session = null;
  saveState();
  render();
}

// ----- STUDENT -----
function populateDocumentSelect() {
  const select = $("docType");
  select.innerHTML = "";
  DOCUMENTS.forEach(function (doc, index) {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = doc.name + " (₱" + doc.fee + " per copy)";
    select.appendChild(option);
  });
  updateFeeText();
}

function updateFeeText() {
  const doc = DOCUMENTS[$("docType").value];
  const copies = parseInt($("copies").value, 10) || 0;
  $("feeText").textContent = "Estimated fee: ₱" + (doc.fee * copies);
}

function handleSubmitRequest(event) {
  event.preventDefault();
  const copies = parseInt($("copies").value, 10);
  const purpose = $("purpose").value.trim();
  const doc = DOCUMENTS[$("docType").value];

  if (!copies || copies < 1 || copies > 10) {
    alert("Copies must be between 1 and 10.");
    return;
  }
  if (!purpose) {
    alert("Please enter a purpose.");
    return;
  }
  if (!confirm("Submit this request for " + copies + " copy/copies of " + doc.name + "?")) {
    return;
  }

  state.requests.push({
    ref: newReference(),
    studentName: state.session.name,
    studentNumber: state.session.number,
    document: doc.name,
    copies: copies,
    purpose: purpose,
    fee: doc.fee * copies,
    status: "Pending",
    remarks: "",
    submittedAt: new Date().toLocaleString(),
    history: [{ status: "Pending", by: "Student", at: new Date().toLocaleString(), remarks: "" }]
  });

  saveState();
  $("requestForm").reset();
  $("copies").value = 1;
  updateFeeText();
  render();
}

function applyStatusChange(request, newStatus, remarks, byWho) {
  const allowed = TRANSITIONS[request.status] || [];
  if (allowed.indexOf(newStatus) === -1) {
    alert("Status change from " + request.status + " to " + newStatus + " is not allowed.");
    return false;
  }
  request.status = newStatus;
  if (remarks) request.remarks = remarks;
  request.history.push({
    status: newStatus,
    by: byWho,
    at: new Date().toLocaleString(),
    remarks: remarks || ""
  });
  return true;
}

function renderStudent() {
  populateIfEmpty();
  const body = $("myRequests");
  body.innerHTML = "";

  const mine = state.requests.filter(function (r) {
    return r.studentNumber === state.session.number;
  });

  if (mine.length === 0) {
    body.appendChild(makeEmptyRow(7, "You have no requests yet."));
    return;
  }

  mine.forEach(function (r) {
    const tr = document.createElement("tr");
    tr.appendChild(makeCell(r.ref));
    tr.appendChild(makeCell(r.document));
    tr.appendChild(makeCell(String(r.copies)));
    tr.appendChild(makeCell("₱" + r.fee));
    tr.appendChild(makeCell(makeBadge(r.status)));
    tr.appendChild(makeCell(r.remarks || "-"));

    const actions = document.createElement("td");
    if (r.status === "Pending") {
      const btn = document.createElement("button");
      btn.className = "small";
      btn.textContent = "Cancel";
      btn.addEventListener("click", function () {
        if (confirm("Cancel request " + r.ref + "?")) {
          applyStatusChange(r, "Cancelled", "Cancelled by student", "Student");
          saveState();
          render();
        }
      });
      actions.appendChild(btn);
    }
    tr.appendChild(actions);
    body.appendChild(tr);
  });
}

function populateIfEmpty() {
  if ($("docType").options.length === 0) populateDocumentSelect();
}

// ----- REGISTRAR -----
function renderRegistrar() {
  const body = $("allRequests");
  body.innerHTML = "";

  if (state.requests.length === 0) {
    body.appendChild(makeEmptyRow(8, "No requests have been submitted yet."));
    return;
  }

  state.requests.forEach(function (r) {
    const tr = document.createElement("tr");
    tr.appendChild(makeCell(r.ref));
    tr.appendChild(makeCell(r.studentName + " (" + r.studentNumber + ")"));
    tr.appendChild(makeCell(r.document));
    tr.appendChild(makeCell(String(r.copies)));
    tr.appendChild(makeCell(makeBadge(r.status)));

    // Status dropdown: only the allowed next statuses
    const select = document.createElement("select");
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose...";
    select.appendChild(placeholder);
    (TRANSITIONS[r.status] || []).forEach(function (next) {
      const opt = document.createElement("option");
      opt.value = next;
      opt.textContent = next;
      select.appendChild(opt);
    });
    const actionCell = document.createElement("td");
    actionCell.className = "row-actions";
    actionCell.appendChild(select);
    tr.appendChild(actionCell);

    const remarksInput = document.createElement("input");
    remarksInput.placeholder = "Remarks";
    remarksInput.value = "";
    tr.appendChild(makeCell(remarksInput));

    const btn = document.createElement("button");
    btn.className = "small";
    btn.textContent = "Update";
    btn.addEventListener("click", function () {
      const newStatus = select.value;
      const remarks = remarksInput.value.trim();
      if (!newStatus) {
        alert("Choose a new status first.");
        return;
      }
      if ((newStatus === "For Correction" || newStatus === "Rejected") && !remarks) {
        alert("Please add remarks when returning for correction or rejecting.");
        return;
      }
      if (applyStatusChange(r, newStatus, remarks, state.session.name)) {
        saveState();
        render();
      }
    });
    tr.appendChild(makeCell(btn));

    body.appendChild(tr);
  });
}

// ----- INIT -----
function init() {
  loadState();
  populateDocumentSelect();

  $("loginForm").addEventListener("submit", handleLogin);
  $("logoutBtn").addEventListener("click", handleLogout);
  $("requestForm").addEventListener("submit", handleSubmitRequest);
  $("docType").addEventListener("change", updateFeeText);
  $("copies").addEventListener("input", updateFeeText);
  $("loginRole").addEventListener("change", function () {
    $("loginNumber").disabled = $("loginRole").value !== "student";
  });

  render();
}

document.addEventListener("DOMContentLoaded", init);
