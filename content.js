(() => {
  const CLASS_NAME = "ado-md-side-preview";
  const root = document.documentElement;

  const applyState = (enabled, editorPercent) => {
    root.classList.toggle(CLASS_NAME, Boolean(enabled));
    if (enabled && typeof editorPercent === "number") {
      root.style.setProperty("--ado-md-editor", `${editorPercent}%`);
    } else {
      root.style.removeProperty("--ado-md-editor");
    }
  };

  const loadState = () => {
    if (!chrome?.storage?.sync) {
      applyState(true, 5);
      return;
    }

    chrome.storage.sync.get({ enabled: true, editorPercent: 50 }, (data) => {
      applyState(data.enabled, data.editorPercent);
    });
  };

  loadState();

  if (chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      if (changes.enabled || changes.editorPercent) {
        const enabled = changes.enabled
          ? changes.enabled.newValue
          : undefined;
        const editorPercent = changes.editorPercent
          ? changes.editorPercent.newValue
          : undefined;
        chrome.storage.sync.get(
          { enabled: true, editorPercent: 50 },
          (data) => {
            applyState(
              enabled ?? data.enabled,
              editorPercent ?? data.editorPercent
            );
          }
        );
      }
    });
  }
})();
