(() => {
  const toggle = document.getElementById("toggle");
  const gap = document.getElementById("gap");
  const gapValue = document.getElementById("gapValue");
  const status = document.getElementById("status");

  const renderStatus = (enabled, editorPercent) => {
    if (status) {
      status.textContent = enabled
        ? `Enabled. Editor width: ${editorPercent}%.`
        : "Disabled.";
    }
    if (gap) gap.disabled = !enabled;
  };

  chrome.storage.sync.get({ enabled: true, editorPercent: 50 }, (data) => {
    const enabled = Boolean(data.enabled);
    const editorPercent = Number(data.editorPercent);

    toggle.checked = enabled;
    if (gap) gap.value = String(editorPercent);
    if (gapValue) gapValue.textContent = `${editorPercent}%`;
    renderStatus(enabled, editorPercent);
  });

  toggle.addEventListener("change", () => {
    const enabled = toggle.checked;
    chrome.storage.sync.set({ enabled }, () => {
      const editorPercent = gap ? Number(gap.value) : 50;
      renderStatus(enabled, editorPercent);
    });
  });

  if (gap) {
    gap.addEventListener("input", () => {
      const editorPercent = Number(gap.value);
      if (gapValue) gapValue.textContent = `${editorPercent}%`;
    });

    gap.addEventListener("change", () => {
      const editorPercent = Number(gap.value);
      chrome.storage.sync.set({ editorPercent }, () => {
        const enabled = toggle.checked;
        renderStatus(enabled, editorPercent);
      });
    });
  }
})();
