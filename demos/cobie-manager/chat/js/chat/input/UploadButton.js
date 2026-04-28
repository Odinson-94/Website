export class UploadButton {
  constructor(state, bridge) {
    this._state = state;
    this._bridge = bridge;
    this._el = document.getElementById('chatUploadBtn');
    this._fileInput = null;
    this._createHiddenInput();
    if (this._el) this._attach();
  }

  _createHiddenInput() {
    this._fileInput = document.createElement('input');
    this._fileInput.type = 'file';
    this._fileInput.multiple = true;
    this._fileInput.accept = '.xlsx,.xls,.docx,.doc,.pdf,.png,.jpg,.jpeg,.pptx,.pub,.csv,.txt,.json,.xml';
    this._fileInput.style.display = 'none';
    document.body.appendChild(this._fileInput);
    this._fileInput.addEventListener('change', (e) => this._handleFiles(e.target.files));
  }

  _attach() {
    this._el.addEventListener('click', (e) => {
      e.preventDefault();
      this._fileInput.click();
    });
  }

  /**
   * Read file as base64 and send to host (WebView2 does not expose a reliable disk path).
   */
  _handleFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    for (const file of fileList) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const base64 = typeof dataUrl === 'string' && dataUrl.includes(',')
          ? dataUrl.split(',')[1]
          : '';
        this._bridge.postMessage('file_upload', JSON.stringify({
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          fileBase64: base64,
          path: file.path || ''
        }));
      };
      reader.onerror = () => {
        console.error('[UploadButton] Could not read file:', file.name);
      };
      reader.readAsDataURL(file);
    }
    this._fileInput.value = '';
  }
}
