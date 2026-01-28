// Lightweight Student Management System front-end
// Features:
// - Add / Edit / Delete students
// - Persist to localStorage ("sms_students")
// - Search, sort, simple pagination
// - Export / Import CSV
// - Form validation
//
// Expected HTML elements (IDs/classes used below):
// - form #student-form
// - table body #students-tbody
// - inputs: #student-name, #student-email, #student-roll, #student-class, #student-id (hidden for edit)
// - buttons: #student-submit, #export-csv, #import-csv, #clear-all
// - input #search
// - selects/buttons for sort/filter (optional): #sort-by
// - file input: #import-file
//
// This file is self-contained and has no external dependencies.
(function () {
  const STORAGE_KEY = "sms_students";
  const PAGE_SIZE = 10;

  // Utilities
  const qs = (sel, ctx = document) => ctx.querySelector(sel);
  const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const el = (tag, attrs = {}) => {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "text") e.textContent = v;
      else if (k === "html") e.innerHTML = v;
      else e.setAttribute(k, v);
    });
    return e;
  };

  // Simple validator
  function validateStudent({ name, email, roll, className }) {
    const errors = [];
    if (!name || name.trim().length < 2) errors.push("Name must be at least 2 characters.");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Email is invalid.");
    if (!roll || !/^[A-Za-z0-9\-]+$/.test(roll)) errors.push("Roll number is required (alphanumeric).");
    if (!className || className.trim().length < 1) errors.push("Class is required.");
    return errors;
  }

  // Storage
  function loadStudents() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch (e) {
      console.warn("Failed to parse students from storage:", e);
      return [];
    }
  }
  function saveStudents(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  // CSV helpers
  function toCSV(rows) {
    const esc = (v) => `"${String(v || "").replace(/"/g, '""')}`;
    const header = ["id", "name", "email", "roll", "class", "notes"];
    const lines = [header.join(",")];
    rows.forEach((r) => {
      lines.push([r.id, r.name, r.email, r.roll, r.className || "", r.notes || ""].map(esc).join(","));
    });
    return lines.join("\n");
  }
  function parseCSV(text) {
    // Very simple CSV parser (handles quoted fields)
    const rows = [];
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return rows;
    const parseLine = (line) => {
      const out = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === "," && !inQuotes) {
          out.push(cur);
          cur = "";
        } else {
          cur += ch;
        }
      }
      out.push(cur);
      return out;
    };
    const header = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
    for (let i = 1; i < lines.length; i++) {
      const vals = parseLine(lines[i]);
      if (vals.length === 0) continue;
      const obj = {};
      header.forEach((h, idx) => {
        obj[h] = vals[idx] ? vals[idx].trim() : "";
      });
      rows.push(obj);
    }
    return rows;
  }

  // App State
  let students = loadStudents();
  let filtered = students.slice();
  let currentPage = 1;
  let currentSort = { by: "name", dir: "asc" };

  // DOM refs
  const form = qs("#student-form");
  const tBody = qs("#students-tbody");
  const inputName = qs("#student-name");
  const inputEmail = qs("#student-email");
  const inputRoll = qs("#student-roll");
  const inputClass = qs("#student-class");
  const inputNotes = qs("#student-notes");
  const inputId = qs("#student-id"); // hidden input for edit
  const submitBtn = qs("#student-submit");
  const searchInput = qs("#search");
  const exportBtn = qs("#export-csv");
  const importFileInput = qs("#import-file");
  const importBtn = qs("#import-csv");
  const clearAllBtn = qs("#clear-all");
  const sortSelect = qs("#sort-by");
  const paginationContainer = qs("#pagination");

  // Core actions
  function generateId() {
    return "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function addStudent(data) {
    const student = {
      id: generateId(),
      name: data.name.trim(),
      email: data.email.trim(),
      roll: data.roll.trim(),
      className: data.className.trim(),
      notes: data.notes ? data.notes.trim() : "",
      createdAt: new Date().toISOString(),
    };
    students.unshift(student);
    saveStudents(students);
    applyFiltersAndRender();
  }

  function updateStudent(id, data) {
    const idx = students.findIndex((s) => s.id === id);
    if (idx === -1) return;
    students[idx] = {
      ...students[idx],
      name: data.name.trim(),
      email: data.email.trim(),
      roll: data.roll.trim(),
      className: data.className.trim(),
      notes: data.notes ? data.notes.trim() : "",
      updatedAt: new Date().toISOString(),
    };
    saveStudents(students);
    applyFiltersAndRender();
  }

  function deleteStudent(id) {
    students = students.filter((s) => s.id !== id);
    saveStudents(students);
    applyFiltersAndRender();
  }

  function clearAll() {
    if (!confirm("Delete ALL students? This cannot be undone.")) return;
    students = [];
    saveStudents(students);
    applyFiltersAndRender();
  }

  // Rendering
  function renderTable(list) {
    tBody.innerHTML = "";
    if (!list.length) {
      const row = el("tr");
      row.appendChild(el("td", { colspan: 6, text: "No students found." }));
      tBody.appendChild(row);
      return;
    }
    list.forEach((s) => {
      const tr = el("tr");
      tr.appendChild(el("td", { text: s.name }));
      tr.appendChild(el("td", { text: s.email }));
      tr.appendChild(el("td", { text: s.roll }));
      tr.appendChild(el("td", { text: s.className }));
      tr.appendChild(el("td", { text: (s.notes || "") }));
      const actionsTd = el("td");
      const editBtn = el("button", { text: "Edit", type: "button" });
      editBtn.classList.add("btn-edit");
      editBtn.dataset.id = s.id;
      const delBtn = el("button", { text: "Delete", type: "button" });
      delBtn.classList.add("btn-delete");
      delBtn.dataset.id = s.id;
      actionsTd.appendChild(editBtn);
      actionsTd.appendChild(el("span", { html: "&nbsp;" }));
      actionsTd.appendChild(delBtn);
      tr.appendChild(actionsTd);
      tBody.appendChild(tr);
    });
  }

  function renderPagination(totalItems) {
    if (!paginationContainer) return;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    paginationContainer.innerHTML = "";
    for (let p = 1; p <= totalPages; p++) {
      const btn = el("button", { text: String(p) });
      if (p === currentPage) btn.disabled = true;
      btn.addEventListener("click", () => {
        currentPage = p;
        applyFiltersAndRender();
      });
      paginationContainer.appendChild(btn);
    }
  }

  // Filtering/Sorting/Pagination
  function applyFiltersAndRender() {
    const q = (searchInput && searchInput.value || "").trim().toLowerCase();
    filtered = students.filter((s) => {
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.roll.toLowerCase().includes(q) ||
        (s.className || "").toLowerCase().includes(q)
      );
    });

    // Sorting
    const by = (sortSelect && sortSelect.value) || currentSort.by;
    const dir = currentSort.dir || "asc";
    filtered.sort((a, b) => {
      const va = (a[by] || "").toString().toLowerCase();
      const vb = (b[by] || "").toString().toLowerCase();
      if (va < vb) return dir === "asc" ? -1 : 1;
      if (va > vb) return dir === "asc" ? 1 : -1;
      return 0;
    });

    // Pagination
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(start, start + PAGE_SIZE);

    renderTable(pageItems);
    renderPagination(total);
  }

  // Event handlers
  function attachFormHandler() {
    if (!form) return;
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const payload = {
        name: inputName.value,
        email: inputEmail.value,
        roll: inputRoll.value,
        className: inputClass.value,
        notes: inputNotes ? inputNotes.value : "",
      };
      const errors = validateStudent(payload);
      if (errors.length) {
        alert("Validation error:\n" + errors.join("\n"));
        return;
      }
      const id = inputId && inputId.value;
      if (id) {
        updateStudent(id, payload);
        form.reset();
        if (inputId) inputId.value = "";
        submitBtn.textContent = "Add Student";
      } else {
        addStudent(payload);
        form.reset();
      }
    });
  }

  function attachTableHandlers() {
    if (!tBody) return;
    tBody.addEventListener("click", (ev) => {
      const btn = ev.target.closest("button");
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.classList.contains("btn-edit")) {
        const student = students.find((s) => s.id === id);
        if (!student) return;
        // populate form
        if (inputId) inputId.value = student.id;
        inputName.value = student.name;
        inputEmail.value = student.email;
        inputRoll.value = student.roll;
        inputClass.value = student.className;
        if (inputNotes) inputNotes.value = student.notes || "";
        submitBtn.textContent = "Update Student";
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (btn.classList.contains("btn-delete")) {
        if (confirm("Delete this student?")) deleteStudent(id);
      }
    });
  }

  function attachSearchSortHandlers() {
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        currentPage = 1;
        applyFiltersAndRender();
      });
    }
    if (sortSelect) {
      sortSelect.addEventListener("change", () => {
        currentSort.by = sortSelect.value;
        currentPage = 1;
        applyFiltersAndRender();
      });
    }
    // Toggle sort direction on header click or another control (optional)
    // Quick keyboard shortcut: press 's' to toggle sort direction
    document.addEventListener("keydown", (e) => {
      if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
        currentSort.dir = currentSort.dir === "asc" ? "desc" : "asc";
        applyFiltersAndRender();
      }
    });
  }

  function attachExportImportHandlers() {
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        if (!students.length) return alert("No students to export.");
        const csv = toCSV(students);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = el("a", { href: url, download: "students_export.csv" });
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      });
    }
    if (importBtn && importFileInput) {
      importBtn.addEventListener("click", () => {
        importFileInput.click();
      });
      importFileInput.addEventListener("change", (ev) => {
        const f = ev.target.files && ev.target.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const parsed = parseCSV(e.target.result);
            // Map CSV headers to our fields. Try to support id/name/email/roll/class/notes
            const toAdd = parsed.map((r) => ({
              id: r.id || generateId(),
              name: r.name || `${r.first || ""} ${r.last || ""}`.trim() || "Unnamed",
              email: r.email || "",
              roll: r.roll || r.roll_no || r.rollno || "",
              className: r.class || r.classname || r.course || "",
              notes: r.notes || "",
              createdAt: new Date().toISOString(),
            }));
            // Append but avoid duplicates by roll+email
            const existingKeys = new Set(students.map((s) => `${s.roll}::${s.email}`));
            const merged = students.slice();
            toAdd.forEach((t) => {
              const key = `${t.roll}::${t.email}`;
              if (!existingKeys.has(key)) {
                merged.push(t);
                existingKeys.add(key);
              }
            });
            students = merged;
            saveStudents(students);
            applyFiltersAndRender();
            alert("Import complete. Imported " + toAdd.length + " rows (duplicates skipped).");
          } catch (err) {
            console.error(err);
            alert("Failed to import CSV: " + err.message);
          } finally {
            importFileInput.value = "";
          }
        };
        reader.readAsText(f);
      });
    }
  }

  // Init
  function init() {
    attachFormHandler();
    attachTableHandlers();
    attachSearchSortHandlers();
    attachExportImportHandlers();
    if (clearAllBtn) {
      clearAllBtn.addEventListener("click", clearAll);
    }
    // If sort select exists, set default
    if (sortSelect && sortSelect.value) currentSort.by = sortSelect.value;
    applyFiltersAndRender();
  }

  // Auto init on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Expose for debugging
  window.SMS = {
    addStudent,
    updateStudent,
    deleteStudent,
    getAll: () => students.slice(),
    clearAll,
  };
})();