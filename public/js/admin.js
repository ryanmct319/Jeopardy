// =========================================
//   ADMIN PANEL - QUESTION EDITOR
// =========================================

let allCategories = [];
let activeCatId = null;
let editingQuestionId = null;

async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    allCategories = await res.json();
    renderCategoryList();
    if (activeCatId) {
      const still = allCategories.find(c => c.id === activeCatId);
      if (still) openCategory(activeCatId);
      else closeQuestionsPanel();
    }
  } catch (e) {
    showStatus('Error loading data', 'error');
  }
}

function renderCategoryList() {
  const list = document.getElementById('category-list');
  const countEl = document.getElementById('category-count');
  countEl.textContent = `${allCategories.length} / 8`;

  document.getElementById('btn-new-cat').style.display = allCategories.length >= 8 ? 'none' : '';

  list.innerHTML = '';
  allCategories.forEach(cat => {
    const item = document.createElement('div');
    item.className = 'cat-item' + (cat.id === activeCatId ? ' active' : '');
    item.style.setProperty('--cat-color', cat.color);
    item.innerHTML = `
      <span class="cat-item-icon">${cat.icon}</span>
      <span class="cat-item-name">${cat.name}</span>
      <span class="cat-item-count">${cat.questions.length}/8</span>
    `;
    item.onclick = () => openCategory(cat.id);
    list.appendChild(item);
  });
}

function openCategory(catId) {
  activeCatId = catId;
  renderCategoryList();

  const cat = allCategories.find(c => c.id === catId);
  if (!cat) return;

  document.getElementById('welcome-msg').style.display = 'none';
  document.getElementById('questions-panel').classList.remove('hidden');
  hideEditCategoryForm();

  // Category info header
  const info = document.getElementById('questions-cat-info');
  info.innerHTML = `
    <span class="qci-icon">${cat.icon}</span>
    <div>
      <div class="qci-name" style="color: ${cat.color}">${cat.name}</div>
      <div class="qci-count">${cat.questions.length} / 8 questions</div>
    </div>
  `;

  renderQuestionList(cat);

  // Show/hide add form based on count
  document.getElementById('add-question-section').style.display =
    cat.questions.length >= 8 ? 'none' : '';
}

function closeQuestionsPanel() {
  activeCatId = null;
  document.getElementById('welcome-msg').style.display = '';
  document.getElementById('questions-panel').classList.add('hidden');
  renderCategoryList();
}

function renderQuestionList(cat) {
  const list = document.getElementById('question-list');
  list.innerHTML = '';

  if (cat.questions.length === 0) {
    list.innerHTML = '<p style="color:rgba(255,255,255,0.4); text-align:center; padding:20px;">No questions yet. Add some below!</p>';
    return;
  }

  cat.questions.forEach((q, idx) => {
    const item = document.createElement('div');
    item.className = 'question-item';
    item.innerHTML = `
      <div class="q-points-badge">$${q.points}</div>
      <div class="q-content">
        <div class="q-question">${escapeHtml(q.question)}</div>
        <div class="q-answer">✅ ${escapeHtml(q.answer)}</div>
        ${q.hint ? `<div class="q-hint">💡 ${escapeHtml(q.hint)}</div>` : ''}
      </div>
      <div class="q-actions">
        <button class="btn-q-edit" onclick="openEditQuestion('${q.id}')" title="Edit">✏️</button>
        <button class="btn-q-delete" onclick="deleteQuestion('${q.id}')" title="Delete">🗑️</button>
      </div>
    `;
    list.appendChild(item);
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ======= CATEGORY CRUD =======
function showNewCategoryForm() {
  document.getElementById('new-cat-form').classList.remove('hidden');
  document.getElementById('new-cat-name').focus();
}
function hideNewCategoryForm() {
  document.getElementById('new-cat-form').classList.add('hidden');
  document.getElementById('new-cat-name').value = '';
  document.getElementById('new-cat-icon').value = '';
}

async function createCategory() {
  const name = document.getElementById('new-cat-name').value.trim();
  const icon = document.getElementById('new-cat-icon').value.trim() || '⭐';
  const color = document.getElementById('new-cat-color').value;

  if (!name) { alert('Please enter a category name'); return; }

  showStatus('Saving...', 'saving');
  try {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, icon, color })
    });
    const cat = await res.json();
    hideNewCategoryForm();
    await loadCategories();
    openCategory(cat.id);
    showStatus('✅ Saved');
  } catch (e) {
    showStatus('Error saving', 'error');
  }
}

function editCategory() {
  const cat = allCategories.find(c => c.id === activeCatId);
  if (!cat) return;
  document.getElementById('edit-cat-name').value = cat.name;
  document.getElementById('edit-cat-icon').value = cat.icon;
  document.getElementById('edit-cat-color').value = cat.color;
  document.getElementById('edit-cat-form').classList.remove('hidden');
}
function hideEditCategoryForm() {
  document.getElementById('edit-cat-form').classList.add('hidden');
}

async function saveCategoryEdit() {
  const name = document.getElementById('edit-cat-name').value.trim();
  const icon = document.getElementById('edit-cat-icon').value.trim();
  const color = document.getElementById('edit-cat-color').value;

  if (!name) { alert('Category name required'); return; }

  showStatus('Saving...', 'saving');
  try {
    await fetch(`/api/categories/${activeCatId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, icon, color })
    });
    hideEditCategoryForm();
    await loadCategories();
    showStatus('✅ Saved');
  } catch (e) {
    showStatus('Error saving', 'error');
  }
}

async function deleteCategory() {
  const cat = allCategories.find(c => c.id === activeCatId);
  if (!cat) return;
  if (!confirm(`Delete category "${cat.name}" and all its questions?`)) return;

  showStatus('Deleting...', 'saving');
  try {
    await fetch(`/api/categories/${activeCatId}`, { method: 'DELETE' });
    closeQuestionsPanel();
    await loadCategories();
    showStatus('✅ Deleted');
  } catch (e) {
    showStatus('Error deleting', 'error');
  }
}

// ======= QUESTION CRUD =======
async function addQuestion() {
  const question = document.getElementById('new-q-text').value.trim();
  const answer = document.getElementById('new-q-answer').value.trim();
  const hint = document.getElementById('new-q-hint').value.trim();

  if (!question || !answer) { alert('Question and answer are required'); return; }

  showStatus('Saving...', 'saving');
  try {
    await fetch(`/api/categories/${activeCatId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, answer, hint })
    });
    document.getElementById('new-q-text').value = '';
    document.getElementById('new-q-answer').value = '';
    document.getElementById('new-q-hint').value = '';
    await loadCategories();
    showStatus('✅ Saved');
  } catch (e) {
    showStatus('Error saving', 'error');
  }
}

function openEditQuestion(qid) {
  const cat = allCategories.find(c => c.id === activeCatId);
  if (!cat) return;
  const q = cat.questions.find(q => q.id === qid);
  if (!q) return;

  editingQuestionId = qid;
  document.getElementById('modal-q-text').value = q.question;
  document.getElementById('modal-q-answer').value = q.answer;
  document.getElementById('modal-q-hint').value = q.hint || '';
  document.getElementById('edit-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('edit-modal').classList.add('hidden');
  editingQuestionId = null;
}

async function saveQuestionEdit() {
  const question = document.getElementById('modal-q-text').value.trim();
  const answer = document.getElementById('modal-q-answer').value.trim();
  const hint = document.getElementById('modal-q-hint').value.trim();

  if (!question || !answer) { alert('Question and answer are required'); return; }

  showStatus('Saving...', 'saving');
  try {
    await fetch(`/api/questions/${editingQuestionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, answer, hint })
    });
    closeModal();
    await loadCategories();
    showStatus('✅ Saved');
  } catch (e) {
    showStatus('Error saving', 'error');
  }
}

async function deleteQuestion(qid) {
  if (!confirm('Delete this question?')) return;

  showStatus('Deleting...', 'saving');
  try {
    await fetch(`/api/questions/${qid}`, { method: 'DELETE' });
    await loadCategories();
    showStatus('✅ Deleted');
  } catch (e) {
    showStatus('Error deleting', 'error');
  }
}

// ======= EXPORT =======
function exportQuestions() {
  // Trigger the server's download endpoint directly
  const a = document.createElement('a');
  a.href = '/api/export';
  a.download = '';
  document.body.appendChild(a);
  a.click();
  a.remove();
  showStatus('📥 Downloading...');
  setTimeout(() => showStatus('✅ Saved'), 1500);
}

// ======= IMPORT =======
async function importQuestions(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Reset the input so the same file can be re-selected if needed
  event.target.value = '';

  let parsed;
  try {
    const text = await file.text();
    parsed = JSON.parse(text);
  } catch (e) {
    alert('❌ Could not read file — make sure it is a valid JSON file exported from this app.');
    return;
  }

  const catCount = parsed?.categories?.length ?? '?';
  if (!confirm(`Import "${file.name}"?\n\nThis will replace all current categories and questions with ${catCount} categories from the file.\n\nA backup of your current data will be saved automatically.`)) return;

  showStatus('Importing...', 'saving');
  try {
    const res = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed)
    });
    const result = await res.json();
    if (!res.ok) {
      showStatus('Import failed', 'error');
      alert(`❌ Import failed:\n${result.error}`);
      return;
    }
    await loadCategories();
    closeQuestionsPanel();
    showStatus(`✅ Imported ${result.categories} categories`);
  } catch (e) {
    showStatus('Import error', 'error');
    alert('❌ Could not connect to server.');
  }
}

// ======= STATUS =======
let statusTimer = null;
function showStatus(msg, type = '') {
  const badge = document.getElementById('status-badge');
  badge.textContent = msg;
  badge.className = 'status-badge' + (type ? ' ' + type : '');
  clearTimeout(statusTimer);
  if (type !== 'saving') {
    statusTimer = setTimeout(() => {
      badge.textContent = '✅ Saved';
      badge.className = 'status-badge';
    }, 3000);
  }
}

// ======= INIT =======
document.addEventListener('DOMContentLoaded', loadCategories);

// Close modal on overlay click
document.getElementById('edit-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('edit-modal')) closeModal();
});
