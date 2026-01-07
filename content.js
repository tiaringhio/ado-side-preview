(() => {
  const CLASS_NAME = "ado-md-side-preview";
  const root = document.documentElement;
  const DEBUG = false; // Set to true for debugging
  
  let scrollSyncEnabled = false;
  let scrollListeners = [];
  let mutationObserver = null;

  // Utility per logging condizionale
  const log = (...args) => {
    if (DEBUG) console.log(...args);
  };

  // Cleanup completo per prevenire memory leak
  const cleanup = () => {
    // Rimuovi tutti i listener di scroll
    scrollListeners.forEach(({ element, handler }) => {
      if (element && element.removeEventListener) {
        element.removeEventListener('scroll', handler, { passive: true });
      }
    });
    scrollListeners = [];
  };

  const applyState = (enabled, editorPercent) => {
    root.classList.toggle(CLASS_NAME, Boolean(enabled));
    if (enabled && typeof editorPercent === "number") {
      root.style.setProperty("--ado-md-editor", `${editorPercent}%`);
    } else {
      root.style.removeProperty("--ado-md-editor");
    }
  };

  const findEditorAndPreview = () => {
    const container = document.querySelector('.work-item-form-control-content.show-markdown-preview');
    
    if (!container) {
      log('[ADO Sync Scroll] Container not found');
      return { editor: null, preview: null };
    }
    
    log('[ADO Sync Scroll] Found container:', container);
    
    const editorColumn = container.querySelector('.flex-column');
    let editor = null;
    
    if (editorColumn) {
      const candidates = [editorColumn, ...Array.from(editorColumn.querySelectorAll('*'))];
      for (let elem of candidates) {
        // Salta elementi nascosti
        if (elem.getAttribute('aria-hidden') === 'true' || 
            elem.getAttribute('role') === 'presentation' ||
            elem.style.visibility === 'hidden') {
          continue;
        }
        
        const style = window.getComputedStyle(elem);
        const hasScroll = style.overflow === 'auto' || style.overflow === 'scroll' || 
                         style.overflowY === 'auto' || style.overflowY === 'scroll';
        if (hasScroll && elem.scrollHeight > elem.clientHeight) {
          editor = elem;
          log('[ADO Sync Scroll] Found scrollable editor:', elem.className, 
                     'scrollHeight:', elem.scrollHeight, 'clientHeight:', elem.clientHeight);
          break;
        }
      }
      
      if (!editor) {
        editor = editorColumn;
        log('[ADO Sync Scroll] Using editor column as fallback:', editorColumn.className);
      }
    }
    
    let preview = container.querySelector('.markdown-content.markdown-editor-preview.markdown-preview');
    
    if (!preview) {
      preview = container.querySelector('.markdown-editor-preview, .md-preview, .preview-container');
    }
    
    if (preview) {
      const previewAndParents = [preview];
      let parent = preview.parentElement;
      while (parent && parent !== container) {
        previewAndParents.push(parent);
        parent = parent.parentElement;
      }
      
      for (let elem of previewAndParents) {
        const style = window.getComputedStyle(elem);
        const hasScroll = style.overflow === 'auto' || style.overflow === 'scroll' || 
                         style.overflowY === 'auto' || style.overflowY === 'scroll';
        if (hasScroll && elem.scrollHeight > elem.clientHeight) {
          preview = elem;
          log('[ADO Sync Scroll] Found scrollable preview:', elem.className,
                     'scrollHeight:', elem.scrollHeight, 'clientHeight:', elem.clientHeight);
          break;
        }
      }
    }
    
    log('[ADO Sync Scroll] Editor found:', editor);
    log('[ADO Sync Scroll] Preview found:', preview);
    
    return { editor, preview };
  };

  const setupScrollSync = (enabled) => {
    scrollSyncEnabled = enabled;
    
    // Cleanup preventivo
    cleanup();

    if (!enabled) {
      log('[ADO Sync Scroll] Disabled');
      return;
    }

    const { editor, preview } = findEditorAndPreview();
    if (!editor || !preview) {
      log('[ADO Sync Scroll] Editor or preview not found');
      return;
    }

    log('[ADO Sync Scroll] Setting up sync');
    log('[ADO Sync Scroll] Editor scrollHeight:', editor.scrollHeight, 'clientHeight:', editor.clientHeight);
    log('[ADO Sync Scroll] Preview scrollHeight:', preview.scrollHeight, 'clientHeight:', preview.clientHeight);

    let isEditorScrolling = false;
    let isPreviewScrolling = false;

    // Sync diretto senza RAF per responsività immediata
    const syncEditorToPreview = () => {
      if (isPreviewScrolling) return;
      isEditorScrolling = true;

      const editorScrollPercent = editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
      const previewScrollTop = editorScrollPercent * (preview.scrollHeight - preview.clientHeight);
      
      // Evita calcoli NaN
      if (!isNaN(previewScrollTop) && isFinite(previewScrollTop)) {
        preview.scrollTop = previewScrollTop;
      }

      log('[ADO Sync Scroll] Editor -> Preview:', editorScrollPercent.toFixed(2), 
          'editor scrollTop:', editor.scrollTop, 'preview scrollTop:', preview.scrollTop);

      // Reset flag immediatamente
      isEditorScrolling = false;
    };

    const syncPreviewToEditor = () => {
      if (isEditorScrolling) return;
      isPreviewScrolling = true;

      const previewScrollPercent = preview.scrollTop / (preview.scrollHeight - preview.clientHeight);
      const editorScrollTop = previewScrollPercent * (editor.scrollHeight - editor.clientHeight);
      
      // Evita calcoli NaN
      if (!isNaN(editorScrollTop) && isFinite(editorScrollTop)) {
        editor.scrollTop = editorScrollTop;
      }

      log('[ADO Sync Scroll] Preview -> Editor:', previewScrollPercent.toFixed(2), 
          'preview scrollTop:', preview.scrollTop, 'editor scrollTop:', editor.scrollTop);

      // Reset flag immediatamente
      isPreviewScrolling = false;
    };

    // Usa passive:true per migliorare le performance
    editor.addEventListener('scroll', syncEditorToPreview, { passive: true });
    preview.addEventListener('scroll', syncPreviewToEditor, { passive: true });

    scrollListeners.push(
      { element: editor, handler: syncEditorToPreview },
      { element: preview, handler: syncPreviewToEditor }
    );

    log('[ADO Sync Scroll] Listeners attached');
  };

  const loadState = () => {
    if (!chrome?.storage?.sync) {
      applyState(true, 50);
      return;
    }

    chrome.storage.sync.get({ enabled: true, editorPercent: 50, syncScroll: false }, (data) => {
      applyState(data.enabled, data.editorPercent);
      setupScrollSync(data.syncScroll);
    });
  };

  // Observer per elementi aggiunti dinamicamente (throttled)
  let lastMutationCheck = 0;
  const handleMutation = () => {
    if (!scrollSyncEnabled) return;
    
    // Throttle: max 1 check ogni 500ms
    const now = Date.now();
    if (now - lastMutationCheck < 500) return;
    lastMutationCheck = now;
    
    const { editor, preview } = findEditorAndPreview();
    if (editor && preview && scrollListeners.length === 0) {
      log('[ADO Sync Scroll] Re-attaching listeners after DOM change');
      chrome.storage.sync.get({ syncScroll: false }, (data) => {
        setupScrollSync(data.syncScroll);
      });
    }
  };

  mutationObserver = new MutationObserver(handleMutation);
  mutationObserver.observe(document.body, { 
    childList: true, 
    subtree: true 
  });

  // Listener per focus - ri-attacca i listener quando l'editor riceve focus
  let focusRetryTimeout = null;
  
  const tryReattachListeners = (attempt = 0) => {
    if (!scrollSyncEnabled) return;
    
    log(`[ADO Sync Scroll] Attempting to reattach listeners (attempt ${attempt + 1})`);
    
    const { editor, preview } = findEditorAndPreview();
    
    // Se gli elementi esistono
    if (editor && preview) {
      const hasValidListeners = scrollListeners.some(({ element }) => 
        element === editor || element === preview
      );
      
      if (!hasValidListeners) {
        log('[ADO Sync Scroll] Re-attaching listeners after focus change');
        chrome.storage.sync.get({ syncScroll: false }, (data) => {
          setupScrollSync(data.syncScroll);
        });
      } else {
        log('[ADO Sync Scroll] Listeners already valid');
      }
    } else {
      // Se la preview non è ancora renderizzata, riprova dopo un delay
      if (attempt < 5) { // Max 5 tentativi
        log('[ADO Sync Scroll] Preview not ready, retrying...');
        focusRetryTimeout = setTimeout(() => {
          tryReattachListeners(attempt + 1);
        }, 100 * (attempt + 1)); // Delay crescente: 100ms, 200ms, 300ms...
      } else {
        log('[ADO Sync Scroll] Max retry attempts reached');
      }
    }
  };
  
  document.addEventListener('focusin', (e) => {
    if (!scrollSyncEnabled) return;
    
    // Cancella timeout pendente
    if (focusRetryTimeout) {
      clearTimeout(focusRetryTimeout);
      focusRetryTimeout = null;
    }
    
    // Controlla se il focus è su un textarea dell'editor
    const target = e.target;
    if (target && target.classList && target.classList.contains('bolt-textfield-input')) {
      log('[ADO Sync Scroll] Focus on editor, checking listeners');
      tryReattachListeners(0);
    }
  }, true); // Use capture to catch focus early

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
      if (changes.syncScroll) {
        setupScrollSync(changes.syncScroll.newValue);
      }
    });
  }

  // Cleanup quando la pagina viene scaricata
  window.addEventListener('beforeunload', () => {
    cleanup();
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
    if (focusRetryTimeout) {
      clearTimeout(focusRetryTimeout);
      focusRetryTimeout = null;
    }
  });
})();
