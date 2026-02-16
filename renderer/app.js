const dropZone = document.getElementById('drop-zone');
const btnFolder = document.getElementById('btn-folder');
const btnReset = document.getElementById('btn-reset');
const resultsSection = document.getElementById('results');
const resultsTitle = document.getElementById('results-title');
const resultsList = document.getElementById('results-list');
const resultsSummary = document.getElementById('results-summary');
const processing = document.getElementById('processing');

// Settings panel
const btnSettings = document.getElementById('btn-settings');
const btnSettingsClose = document.getElementById('btn-settings-close');
const settingsPanel = document.getElementById('settings-panel');
const settingsOverlay = document.getElementById('settings-overlay');
const btnResetSettings = document.getElementById('btn-reset-settings');

btnSettings.addEventListener('click', () => {
  settingsPanel.classList.add('open');
  settingsOverlay.classList.add('open');
});

function closeSettings() {
  settingsPanel.classList.remove('open');
  settingsOverlay.classList.remove('open');
}

btnSettingsClose.addEventListener('click', closeSettings);
settingsOverlay.addEventListener('click', closeSettings);

// Range value display
document.querySelectorAll('.setting-range input[type="range"]').forEach((range) => {
  const display = document.querySelector(`.range-value[data-for="${range.name}"]`);
  if (display) {
    range.addEventListener('input', () => { display.textContent = range.value; });
  }
});

// Reset settings to defaults
btnResetSettings.addEventListener('click', () => {
  settingsPanel.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.checked = cb.hasAttribute('checked');
  });
  settingsPanel.querySelectorAll('input[type="range"]').forEach((range) => {
    range.value = range.getAttribute('value');
    const display = document.querySelector(`.range-value[data-for="${range.name}"]`);
    if (display) display.textContent = range.value;
  });
});

function getSettings() {
  const settings = { plugins: {} };
  settings.multipass = settingsPanel.querySelector('input[name="multipass"]').checked;
  settings.floatPrecision = Number(settingsPanel.querySelector('input[name="floatPrecision"]').value);
  settings.transformPrecision = Number(settingsPanel.querySelector('input[name="transformPrecision"]').value);

  settingsPanel.querySelectorAll('.settings-section:last-of-type input[type="checkbox"]').forEach((cb) => {
    settings.plugins[cb.name] = cb.checked;
  });

  return settings;
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function showProcessing() {
  dropZone.classList.add('hidden');
  resultsSection.classList.add('hidden');
  processing.classList.remove('hidden');
}

function showResults(data) {
  processing.classList.add('hidden');
  dropZone.classList.add('hidden');
  resultsSection.classList.remove('hidden');

  if (data.error) {
    resultsTitle.textContent = data.error;
    resultsList.innerHTML = '';
    resultsSummary.innerHTML = '';
    return;
  }

  const { results, outputDir } = data;
  resultsTitle.textContent = `${results.length} file${results.length !== 1 ? 's' : ''} optimized`;

  resultsList.innerHTML = results
    .map((r) => {
      if (r.error) {
        return `<div class="result-row">
          <span class="result-name">${r.name}</span>
          <span class="result-error">${r.error}</span>
        </div>`;
      }
      const pct = r.originalSize > 0 ? ((r.saved / r.originalSize) * 100).toFixed(1) : 0;
      return `<div class="result-row">
        <span class="result-name">${r.name}</span>
        <span class="result-sizes">${formatBytes(r.originalSize)} → ${formatBytes(r.optimizedSize)}</span>
        <span class="result-saved">-${pct}%</span>
      </div>`;
    })
    .join('');

  const successResults = results.filter((r) => !r.error);
  const totalOriginal = successResults.reduce((s, r) => s + r.originalSize, 0);
  const totalSaved = successResults.reduce((s, r) => s + r.saved, 0);
  const totalPct = totalOriginal > 0 ? ((totalSaved / totalOriginal) * 100).toFixed(1) : 0;

  resultsSummary.innerHTML = `
    <span class="summary-label">Total saved</span>
    <span class="summary-value">${formatBytes(totalSaved)} (${totalPct}%)</span>
  `;
}

function showDropZone() {
  resultsSection.classList.add('hidden');
  processing.classList.add('hidden');
  dropZone.classList.remove('hidden');
}

// Drag and drop
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.remove('drag-over');

  const files = Array.from(e.dataTransfer.files);
  const svgPaths = files
    .filter((f) => f.name.toLowerCase().endsWith('.svg'))
    .map((f) => window.api.getFilePath(f));

  if (svgPaths.length === 0) return;

  showProcessing();
  const result = await window.api.optimizeFiles(svgPaths, getSettings());
  if (!result) {
    showDropZone();
    return;
  }
  showResults(result);
});

// Prevent default drag behavior on the window
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());

// Folder picker
btnFolder.addEventListener('click', async () => {
  showProcessing();
  const result = await window.api.selectFolder(getSettings());
  if (!result) {
    showDropZone();
    return;
  }
  showResults(result);
});

// Reset
btnReset.addEventListener('click', showDropZone);
