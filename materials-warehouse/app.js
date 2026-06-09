(() => {
  "use strict";

  const SYSTEM_CONFIG = window.WAREHOUSE_CONFIG || {};

  const STORAGE_KEYS = {
    materials: "mw_material_database_v1",
    records: "mw_issue_records_v1",
    settings: "mw_settings_v1",
    adminSession: "mw_admin_authenticated_v1"
  };

  const WORKDAY = {
    startMinutes: 7 * 60 + 30,
    endMinutes: 16 * 60 + 30
  };

  const DEFAULT_SETTINGS = {
    managerPin: "2468",
    emergencyUntil: null,
    sheetUrl: "",
    lastDbName: "Dữ liệu mẫu",
    lastDbUpdatedAt: null
  };

  const DEFAULT_MATERIALS = [
    { code: "CLKH0089", name: "Bạc đạn 6204 ZZ", unit: "Cái" },
    { code: "CLKH0090", name: "Bạc đạn 6205 ZZ", unit: "Cái" },
    { code: "CLKH0091", name: "Bạc đạn 6206 ZZ", unit: "Cái" },
    { code: "VTBT0001", name: "Dây curoa Bando A42", unit: "Sợi" },
    { code: "VTBT0002", name: "Dây curoa Bando B54", unit: "Sợi" },
    { code: "VTBT0003", name: "Mỡ bò chịu nhiệt", unit: "Kg" },
    { code: "VTBT0004", name: "Dầu thủy lực 68", unit: "Lít" },
    { code: "VTBT0005", name: "Lưỡi dao cắt màng", unit: "Cái" },
    { code: "VTBT0006", name: "Băng keo chịu nhiệt", unit: "Cuộn" },
    { code: "VTBT0007", name: "Đầu nối khí nén phi 8", unit: "Cái" },
    { code: "VTBT0008", name: "Ống hơi PU phi 8", unit: "Mét" },
    { code: "VTBT0009", name: "Cảm biến quang Omron", unit: "Cái" },
    { code: "VTBT0010", name: "Relay trung gian 24VDC", unit: "Cái" },
    { code: "VTBT0011", name: "Cầu chì 10A", unit: "Cái" },
    { code: "VTBT0012", name: "Găng tay chống cắt", unit: "Đôi" }
  ];

  const els = {};
  const state = {
    materials: [],
    records: [],
    settings: { ...DEFAULT_SETTINGS },
    photos: [],
    editingId: null,
    pendingCancelRecordId: null,
    pendingDeleteRecordId: null,
    itemSeq: 0,
    adminAuthenticated: false,
    onlineRecordsLoading: false,
    lastOnlineRecordsAt: null,
    lastManagerOpen: null,
    signatureDirty: false,
    signatureCtx: null,
    drawing: false,
    lastPoint: null,
    fullscreenSignatureCtx: null,
    fullscreenDrawing: false,
    fullscreenLastPoint: null,
    fullscreenSignatureDirty: false,
    fullscreenSignatureDataUrl: "",
    currentSignatureDataUrl: ""
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    cacheElements();
    loadState();
    await loadSystemMaterials();
    setupEvents();
    setupSignaturePad();
    addItemRow();
    updateNowFields(true);
    updateDbStatus();
    updateSyncStatus();
    updateAdminVisibility();
    updateLockState();
    renderPhotos();
    renderRecords();
    if (state.adminAuthenticated) {
      refreshOnlineRecords(false);
    }
    refreshIcons();

    window.setInterval(() => {
      updateNowFields(false);
      updateLockState();
      updateSyncStatus();
    }, 1000);

    window.setInterval(() => {
      if (state.adminAuthenticated) {
        refreshOnlineRecords(false);
      }
    }, 15000);
  }

  function cacheElements() {
    [
      "clockText",
      "lockStatus",
      "appShell",
      "adminPanel",
      "adminLoginBtn",
      "adminLogoutBtn",
      "adminDialog",
      "closeAdminDialogBtn",
      "adminLoginPin",
      "adminSubmitBtn",
      "adminLoginMessage",
      "cancelDialog",
      "closeCancelDialogBtn",
      "cancelBackBtn",
      "confirmCancelBtn",
      "cancelRecordId",
      "cancelRecordName",
      "cancelReasonInput",
      "cancelDialogMessage",
      "deleteDialog",
      "closeDeleteDialogBtn",
      "deleteBackBtn",
      "confirmDeleteBtn",
      "deleteRecordId",
      "deleteRecordName",
      "deleteConfirmInput",
      "deleteDialogMessage",
      "editState",
      "cancelEditBtn",
      "formLockNotice",
      "issueForm",
      "issueFieldset",
      "takeDate",
      "takeTime",
      "fullName",
      "workshop",
      "department",
      "itemRows",
      "addItemBtn",
      "photoInput",
      "photoPreview",
      "photoCount",
      "signaturePad",
      "expandSignatureBtn",
      "clearSignatureBtn",
      "signatureDialog",
      "closeSignatureDialogBtn",
      "fullscreenSignaturePad",
      "clearFullscreenSignatureBtn",
      "useFullscreenSignatureBtn",
      "note",
      "submitBtn",
      "formMessage",
      "dbFile",
      "dbStatus",
      "sheetUrl",
      "saveSheetUrlBtn",
      "syncStatus",
      "resendPendingBtn",
      "exportCsvBtn",
      "exportJsonBtn",
      "managerPin",
      "unlockMinutes",
      "unlockBtn",
      "lockNowBtn",
      "adminStatus",
      "currentPin",
      "newPin",
      "changePinBtn",
      "recordsList",
      "recordCount"
    ].forEach((id) => {
      els[id] = document.getElementById(id);
    });
  }

  function loadState() {
    state.materials = loadJson(STORAGE_KEYS.materials, DEFAULT_MATERIALS);
    state.records = loadJson(STORAGE_KEYS.records, []);
    const localSettings = loadJson(STORAGE_KEYS.settings, {});
    state.settings = {
      ...DEFAULT_SETTINGS,
      ...localSettings
    };
    if (SYSTEM_CONFIG.sheetUrl) {
      state.settings.sheetUrl = String(SYSTEM_CONFIG.sheetUrl).trim();
    }
    state.adminAuthenticated = sessionStorage.getItem(STORAGE_KEYS.adminSession) === "true";
    els.sheetUrl.value = state.settings.sheetUrl || "";
  }

  async function loadSystemMaterials() {
    const materialsUrl = String(SYSTEM_CONFIG.materialsUrl || "materials.json").trim();
    if (!materialsUrl || typeof fetch !== "function") return;

    try {
      const response = await fetch(withVersionParam(materialsUrl, SYSTEM_CONFIG.materialsVersion));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      const rows = Array.isArray(payload) ? payload : payload.materials;
      if (!Array.isArray(rows) || !rows.length) return;

      const materials = rows
        .map((item) => ({
          code: String(item.code || "").trim(),
          name: String(item.name || "").trim(),
          unit: stripDigits(String(item.unit || "")).trim()
        }))
        .filter((item) => item.code && item.name);

      if (!materials.length) return;

      state.materials = dedupeMaterials(materials);
      state.settings.lastDbName = payload.source || SYSTEM_CONFIG.dbName || materialsUrl;
      state.settings.lastDbUpdatedAt = payload.updatedAt || SYSTEM_CONFIG.materialsUpdatedAt || null;
      saveJson(STORAGE_KEYS.materials, state.materials);
      saveSettings();
    } catch (error) {
      console.warn("Cannot load shared material database", error);
    }
  }

  function withVersionParam(url, version) {
    if (!version) return url;
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}v=${encodeURIComponent(version)}`;
  }

  function setupEvents() {
    els.issueForm.addEventListener("submit", handleSubmit);
    els.adminLoginBtn.addEventListener("click", openAdminDialog);
    els.adminLogoutBtn.addEventListener("click", logoutAdmin);
    els.closeAdminDialogBtn.addEventListener("click", closeAdminDialog);
    els.adminSubmitBtn.addEventListener("click", loginAdmin);
    els.adminLoginPin.addEventListener("keydown", (event) => {
      if (event.key === "Enter") loginAdmin();
    });
    els.adminDialog.addEventListener("click", (event) => {
      if (event.target === els.adminDialog) closeAdminDialog();
    });
    els.closeCancelDialogBtn.addEventListener("click", closeCancelDialog);
    els.cancelBackBtn.addEventListener("click", closeCancelDialog);
    els.confirmCancelBtn.addEventListener("click", confirmCancelRecord);
    els.cancelReasonInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        confirmCancelRecord();
      }
    });
    els.cancelDialog.addEventListener("click", (event) => {
      if (event.target === els.cancelDialog) closeCancelDialog();
    });
    els.closeDeleteDialogBtn.addEventListener("click", closeDeleteDialog);
    els.deleteBackBtn.addEventListener("click", closeDeleteDialog);
    els.confirmDeleteBtn.addEventListener("click", confirmPermanentDelete);
    els.deleteConfirmInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") confirmPermanentDelete();
    });
    els.deleteDialog.addEventListener("click", (event) => {
      if (event.target === els.deleteDialog) closeDeleteDialog();
    });
    els.addItemBtn.addEventListener("click", () => addItemRow());
    els.cancelEditBtn.addEventListener("click", resetForm);
    els.itemRows.addEventListener("input", handleItemInput);
    els.itemRows.addEventListener("click", handleItemClick);
    els.photoInput.addEventListener("change", handlePhotoInput);
    els.expandSignatureBtn.addEventListener("click", openSignatureDialog);
    els.clearSignatureBtn.addEventListener("click", clearSignature);
    els.closeSignatureDialogBtn.addEventListener("click", closeSignatureDialog);
    els.clearFullscreenSignatureBtn.addEventListener("click", clearFullscreenSignature);
    els.useFullscreenSignatureBtn.addEventListener("click", useFullscreenSignature);
    els.signatureDialog.addEventListener("click", (event) => {
      if (event.target === els.signatureDialog) closeSignatureDialog();
    });
    els.dbFile.addEventListener("change", handleDatabaseImport);
    els.saveSheetUrlBtn.addEventListener("click", saveSheetUrl);
    els.resendPendingBtn.addEventListener("click", syncPendingRecords);
    els.exportCsvBtn.addEventListener("click", exportCsv);
    els.exportJsonBtn.addEventListener("click", exportJson);
    els.unlockBtn.addEventListener("click", unlockByManager);
    els.lockNowBtn.addEventListener("click", lockNow);
    els.changePinBtn.addEventListener("click", changePin);
    els.recordsList.addEventListener("click", handleRecordAction);

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".search-cell")) {
        closeSuggestions();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeSuggestions();
        closeAdminDialog();
        closeCancelDialog();
        closeDeleteDialog();
        closeSignatureDialog();
      }
    });
  }

  function openAdminDialog() {
    els.adminDialog.classList.remove("hidden");
    els.adminLoginPin.value = "";
    els.adminLoginMessage.textContent = "";
    els.adminLoginMessage.classList.remove("error", "success");
    window.setTimeout(() => els.adminLoginPin.focus(), 0);
  }

  function closeAdminDialog() {
    els.adminDialog.classList.add("hidden");
  }

  function openCancelDialog(record) {
    state.pendingCancelRecordId = record.id;
    els.cancelRecordId.textContent = record.id;
    els.cancelRecordName.textContent = record.fullName || "-";
    els.cancelReasonInput.value = "";
    els.cancelDialogMessage.textContent = "";
    els.cancelDialogMessage.classList.remove("error", "success");
    els.cancelDialog.classList.remove("hidden");
    refreshIcons();
    window.setTimeout(() => els.cancelReasonInput.focus(), 0);
  }

  function closeCancelDialog() {
    els.cancelDialog.classList.add("hidden");
    state.pendingCancelRecordId = null;
  }

  function openDeleteDialog(record) {
    state.pendingDeleteRecordId = record.id;
    els.deleteRecordId.textContent = record.id;
    els.deleteRecordName.textContent = record.fullName || "-";
    els.deleteConfirmInput.value = "";
    els.deleteDialogMessage.textContent = "";
    els.deleteDialogMessage.classList.remove("error", "success");
    els.deleteDialog.classList.remove("hidden");
    refreshIcons();
    window.setTimeout(() => els.deleteConfirmInput.focus(), 0);
  }

  function closeDeleteDialog() {
    els.deleteDialog.classList.add("hidden");
    state.pendingDeleteRecordId = null;
  }

  async function confirmPermanentDelete() {
    const record = state.records.find((entry) => entry.id === state.pendingDeleteRecordId);
    if (!record) {
      closeDeleteDialog();
      return;
    }

    if (normalizeText(els.deleteConfirmInput.value) !== "xoa") {
      els.deleteDialogMessage.textContent = "Cần nhập XOA để xác nhận xóa vĩnh viễn.";
      els.deleteDialogMessage.classList.add("error");
      els.deleteDialogMessage.classList.remove("success");
      els.deleteConfirmInput.focus();
      return;
    }

    els.confirmDeleteBtn.disabled = true;
    await permanentlyDeleteRecord(record);
    els.confirmDeleteBtn.disabled = false;
    closeDeleteDialog();
  }

  async function confirmCancelRecord() {
    const record = state.records.find((entry) => entry.id === state.pendingCancelRecordId);
    if (!record) {
      closeCancelDialog();
      return;
    }

    const reason = els.cancelReasonInput.value.trim();
    if (!reason) {
      els.cancelDialogMessage.textContent = "Cần nhập lý do hủy phiếu.";
      els.cancelDialogMessage.classList.add("error");
      els.cancelDialogMessage.classList.remove("success");
      els.cancelReasonInput.focus();
      return;
    }

    els.confirmCancelBtn.disabled = true;
    await cancelRecord(record, reason);
    els.confirmCancelBtn.disabled = false;
    closeCancelDialog();
  }

  function loginAdmin() {
    if (!checkPin(els.adminLoginPin.value)) {
      els.adminLoginMessage.textContent = "Mã quản lý không đúng.";
      els.adminLoginMessage.classList.add("error");
      els.adminLoginMessage.classList.remove("success");
      return;
    }

    state.adminAuthenticated = true;
    sessionStorage.setItem(STORAGE_KEYS.adminSession, "true");
    closeAdminDialog();
    updateAdminVisibility();
    updateLockState();
    setMessage("Đã đăng nhập admin.", "success");
    refreshOnlineRecords(true);
  }

  function logoutAdmin() {
    state.adminAuthenticated = false;
    sessionStorage.removeItem(STORAGE_KEYS.adminSession);
    updateAdminVisibility();
    if (state.editingId) resetForm();
    renderRecords();
    setMessage("Đã thoát admin.", "success");
  }

  function updateAdminVisibility() {
    const isAdmin = state.adminAuthenticated;
    els.adminPanel.classList.toggle("hidden", !isAdmin);
    els.appShell.classList.toggle("no-admin", !isAdmin);
    els.adminLoginBtn.classList.toggle("hidden", isAdmin);
    els.adminLogoutBtn.classList.toggle("hidden", !isAdmin);
  }

  function requireAdmin() {
    if (state.adminAuthenticated) return true;
    setMessage("Cần đăng nhập admin để dùng chức năng quản trị.", "error");
    openAdminDialog();
    return false;
  }

  function setupSignaturePad() {
    resizeSignaturePad();
    window.addEventListener("resize", debounce(resizeSignaturePad, 160));
    window.addEventListener("resize", debounce(() => {
      if (!els.signatureDialog.classList.contains("hidden")) {
        resizeFullscreenSignaturePad();
      }
    }, 160));

    els.signaturePad.addEventListener("pointerdown", startSignature);
    els.signaturePad.addEventListener("pointermove", moveSignature);
    els.signaturePad.addEventListener("pointerup", endSignature);
    els.signaturePad.addEventListener("pointercancel", endSignature);
    els.signaturePad.addEventListener("pointerleave", endSignature);

    els.fullscreenSignaturePad.addEventListener("pointerdown", startFullscreenSignature);
    els.fullscreenSignaturePad.addEventListener("pointermove", moveFullscreenSignature);
    els.fullscreenSignaturePad.addEventListener("pointerup", endFullscreenSignature);
    els.fullscreenSignaturePad.addEventListener("pointercancel", endFullscreenSignature);
    els.fullscreenSignaturePad.addEventListener("pointerleave", endFullscreenSignature);
  }

  function resizeSignaturePad() {
    const canvas = els.signaturePad;
    const existing = state.signatureDirty ? canvas.toDataURL("image/png") : "";
    state.signatureCtx = prepareSignatureCanvas(canvas, 280, 170);

    if (existing) {
      drawSignatureImage(existing);
    }
  }

  function resizeFullscreenSignaturePad() {
    const canvas = els.fullscreenSignaturePad;
    const existing = state.fullscreenSignatureDirty
      ? (state.fullscreenSignatureDataUrl || canvas.toDataURL("image/png"))
      : state.currentSignatureDataUrl;
    state.fullscreenSignatureCtx = prepareSignatureCanvas(canvas, 320, 360);

    if (existing) {
      drawSignatureImageToCanvas(canvas, state.fullscreenSignatureCtx, existing, () => {
        state.fullscreenSignatureDirty = true;
        state.fullscreenSignatureDataUrl = existing;
      });
    }
  }

  function prepareSignatureCanvas(canvas, minWidth, minHeight) {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(minWidth, Math.floor(rect.width));
    const height = Math.max(minHeight, Math.floor(rect.height || minHeight));
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.8;
    ctx.strokeStyle = "#17211b";
    return ctx;
  }

  function startSignature(event) {
    if (els.issueFieldset.disabled) return;
    event.preventDefault();
    els.signaturePad.setPointerCapture(event.pointerId);
    state.drawing = true;
    state.signatureDirty = true;
    state.lastPoint = getCanvasPoint(event);
    state.signatureCtx.beginPath();
    state.signatureCtx.moveTo(state.lastPoint.x, state.lastPoint.y);
  }

  function moveSignature(event) {
    if (!state.drawing) return;
    event.preventDefault();
    const point = getCanvasPoint(event);
    state.signatureCtx.lineTo(point.x, point.y);
    state.signatureCtx.stroke();
    state.lastPoint = point;
  }

  function endSignature(event) {
    if (!state.drawing) return;
    event.preventDefault();
    state.drawing = false;
    state.currentSignatureDataUrl = els.signaturePad.toDataURL("image/png");
  }

  function getCanvasPoint(event) {
    return getCanvasPointFor(event, els.signaturePad);
  }

  function getCanvasPointFor(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function clearSignature() {
    clearCanvas(els.signaturePad, state.signatureCtx);
    state.signatureDirty = false;
    state.currentSignatureDataUrl = "";
  }

  function drawSignatureImage(dataUrl) {
    drawSignatureImageToCanvas(els.signaturePad, state.signatureCtx, dataUrl, () => {
      state.signatureDirty = true;
      state.currentSignatureDataUrl = dataUrl;
    });
  }

  function drawSignatureImageToCanvas(canvas, ctx, dataUrl, onDone) {
    const image = new Image();
    image.onload = () => {
      const rect = canvas.getBoundingClientRect();
      clearCanvas(canvas, ctx);
      ctx.drawImage(image, 0, 0, rect.width, rect.height || 190);
      if (onDone) onDone();
    };
    image.src = dataUrl;
  }

  function clearCanvas(canvas, ctx) {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height || canvas.height);
  }

  function openSignatureDialog() {
    if (els.issueFieldset.disabled) return;
    state.fullscreenSignatureDirty = state.signatureDirty;
    state.fullscreenSignatureDataUrl = state.signatureDirty
      ? els.signaturePad.toDataURL("image/png")
      : "";
    els.signatureDialog.classList.remove("hidden");
    document.body.classList.add("modal-open");
    window.setTimeout(() => {
      resizeFullscreenSignaturePad();
      refreshIcons();
    }, 0);
  }

  function closeSignatureDialog() {
    els.signatureDialog.classList.add("hidden");
    document.body.classList.remove("modal-open");
    state.fullscreenDrawing = false;
  }

  function startFullscreenSignature(event) {
    event.preventDefault();
    els.fullscreenSignaturePad.setPointerCapture(event.pointerId);
    state.fullscreenDrawing = true;
    state.fullscreenSignatureDirty = true;
    state.fullscreenLastPoint = getCanvasPointFor(event, els.fullscreenSignaturePad);
    state.fullscreenSignatureCtx.beginPath();
    state.fullscreenSignatureCtx.moveTo(state.fullscreenLastPoint.x, state.fullscreenLastPoint.y);
  }

  function moveFullscreenSignature(event) {
    if (!state.fullscreenDrawing) return;
    event.preventDefault();
    const point = getCanvasPointFor(event, els.fullscreenSignaturePad);
    state.fullscreenSignatureCtx.lineTo(point.x, point.y);
    state.fullscreenSignatureCtx.stroke();
    state.fullscreenLastPoint = point;
  }

  function endFullscreenSignature(event) {
    if (!state.fullscreenDrawing) return;
    event.preventDefault();
    state.fullscreenDrawing = false;
    state.fullscreenSignatureDataUrl = els.fullscreenSignaturePad.toDataURL("image/png");
  }

  function clearFullscreenSignature() {
    clearCanvas(els.fullscreenSignaturePad, state.fullscreenSignatureCtx);
    state.fullscreenSignatureDirty = false;
    state.fullscreenSignatureDataUrl = "";
  }

  function useFullscreenSignature() {
    if (state.fullscreenSignatureDirty) {
      const dataUrl = state.fullscreenSignatureDataUrl || els.fullscreenSignaturePad.toDataURL("image/png");
      drawSignatureImage(dataUrl);
    } else {
      clearSignature();
    }
    closeSignatureDialog();
  }

  function updateNowFields(force) {
    const now = new Date();
    els.clockText.textContent = `${formatDateVN(now)} ${formatTime(now)}`;
    if (!state.editingId || force) {
      els.takeDate.value = formatDateISO(now);
      els.takeTime.value = formatTime(now);
    }
  }

  function updateLockState() {
    const lockInfo = getLockInfo();
    const canUseForm = lockInfo.canWrite;

    els.lockStatus.textContent = lockInfo.label;
    els.lockStatus.classList.toggle("locked", lockInfo.kind === "locked");
    els.lockStatus.classList.toggle("override", lockInfo.kind === "override");
    els.formLockNotice.textContent = lockInfo.notice || "";
    els.formLockNotice.classList.toggle("hidden", canUseForm);
    els.issueFieldset.disabled = !canUseForm;
    els.submitBtn.disabled = !canUseForm;

    if (!canUseForm && state.editingId) {
      resetForm();
    }

    const managerOpen = isManagerOpen();
    els.adminStatus.textContent = managerOpen ? `Đang mở đến ${formatDateTimeShort(new Date(state.settings.emergencyUntil))}` : "Chưa mở";
    if (state.lastManagerOpen !== managerOpen) {
      state.lastManagerOpen = managerOpen;
      renderRecords();
    }
  }

  function getLockInfo() {
    const now = new Date();
    if (isManagerOpen(now)) {
      return {
        canWrite: true,
        kind: "override",
        label: "Mở khóa quản lý",
        notice: ""
      };
    }

    if (isWithinWorkday(now)) {
      return {
        canWrite: true,
        kind: "open",
        label: "Đang mở kho",
        notice: ""
      };
    }

    return {
      canWrite: false,
      kind: "locked",
      label: "Đã khóa nhập",
      notice: "Kho chỉ nhập phiếu từ 07:30 đến 16:30. Cần mã quản lý để mở khóa khẩn cấp."
    };
  }

  function isWithinWorkday(date) {
    const minutes = date.getHours() * 60 + date.getMinutes();
    return minutes >= WORKDAY.startMinutes && minutes <= WORKDAY.endMinutes;
  }

  function isManagerOpen(date = new Date()) {
    if (!state.settings.emergencyUntil) return false;
    return new Date(state.settings.emergencyUntil).getTime() > date.getTime();
  }

  function addItemRow(item = {}) {
    const row = document.createElement("div");
    const rowId = `item-${++state.itemSeq}`;
    row.className = "item-card";
    row.dataset.rowId = rowId;
    row.dataset.selectedCode = item.unknown ? "" : item.code || "";
    row.dataset.unknown = item.unknown ? "true" : "false";
    row.innerHTML = `
      <div class="item-grid">
        <label class="field search-cell">
          <span>Mã vật tư</span>
          <input class="material-code" type="text" autocomplete="off" required>
          <div class="suggestions" hidden></div>
        </label>
        <label class="field search-cell">
          <span>Tên vật tư</span>
          <input class="material-name" type="text" autocomplete="off" required>
          <div class="suggestions" hidden></div>
        </label>
        <label class="field">
          <span>Số lượng</span>
          <input class="quantity" type="number" min="0.01" step="any" inputmode="decimal" required>
        </label>
        <label class="field">
          <span>Đơn vị tính</span>
          <input class="unit" type="text" inputmode="text" autocomplete="off" required>
        </label>
        <label class="field">
          <span>Số tháng</span>
          <input class="months" type="number" min="1" step="1" inputmode="numeric" required>
        </label>
        <button class="icon-button remove-item" type="button" aria-label="Xóa dòng vật tư" title="Xóa dòng vật tư">
          <i data-lucide="trash-2" aria-hidden="true">X</i>
        </button>
      </div>
    `;

    setRowValues(row, item);
    els.itemRows.appendChild(row);
    updateRemoveButtons();
    refreshIcons();
  }

  function setRowValues(row, item) {
    row.querySelector(".material-code").value = item.code || "";
    row.querySelector(".material-name").value = item.name || "";
    row.querySelector(".quantity").value = item.quantity || "";
    row.querySelector(".unit").value = item.unit || "";
    row.querySelector(".months").value = item.months || "";
    row.querySelector(".unit").readOnly = !item.unknown && Boolean(item.code);
  }

  function updateRemoveButtons() {
    const rows = Array.from(els.itemRows.querySelectorAll(".item-card"));
    rows.forEach((row) => {
      row.querySelector(".remove-item").disabled = rows.length === 1;
    });
  }

  function handleItemInput(event) {
    const target = event.target;
    if (target.matches(".unit")) {
      const cleaned = stripDigits(target.value);
      if (target.value !== cleaned) {
        target.value = cleaned;
        setMessage("Đơn vị tính không được nhập số.", "error");
      }
      return;
    }

    if (!target.matches(".material-code, .material-name")) return;

    const row = target.closest(".item-card");
    row.dataset.selectedCode = "";
    row.dataset.unknown = "false";
    row.querySelector(".unit").readOnly = false;
    updateSuggestions(row, target);
  }

  function handleItemClick(event) {
    const removeButton = event.target.closest(".remove-item");
    if (removeButton) {
      const rows = els.itemRows.querySelectorAll(".item-card");
      if (rows.length > 1) {
        removeButton.closest(".item-card").remove();
        updateRemoveButtons();
      }
      return;
    }

    const suggestion = event.target.closest(".suggestion");
    if (!suggestion) return;

    const row = suggestion.closest(".item-card");
    if (suggestion.dataset.unknown === "true") {
      markUnknownMaterial(row, suggestion.dataset.term || "");
      closeSuggestions();
      return;
    }

    const material = state.materials[Number(suggestion.dataset.index)];
    if (material) {
      selectMaterial(row, material);
      closeSuggestions();
    }
  }

  function updateSuggestions(row, input) {
    const term = input.value.trim();
    const panel = input.parentElement.querySelector(".suggestions");
    if (!term) {
      panel.hidden = true;
      panel.innerHTML = "";
      return;
    }

    const matches = searchMaterials(term).slice(0, 10);
    const noResult = matches.length === 0;
    const matchHtml = matches
      .map(({ material, index }) => `
        <button class="suggestion" type="button" data-index="${index}">
          <strong>${escapeHtml(material.code)}</strong>
          <span>${escapeHtml(material.name)}</span>
          <small>${escapeHtml(material.unit || "Chưa có ĐVT")}</small>
        </button>
      `)
      .join("");

    const unknownHtml = noResult
      ? `
        <button class="suggestion unknown" type="button" data-unknown="true" data-term="${escapeHtml(term)}">
          <strong>Chưa có mã vật tư</strong>
          <span>${escapeHtml(term)}</span>
          <small>Nhập tên và đơn vị tính thủ công</small>
        </button>
      `
      : "";

    panel.innerHTML = matchHtml + unknownHtml;
    panel.hidden = false;
  }

  function searchMaterials(term) {
    const query = normalizeText(term);
    if (!query) return [];

    return state.materials
      .map((material, index) => {
        const code = normalizeText(material.code);
        const name = normalizeText(material.name);
        let score = 0;

        if (code === query) score = 100;
        else if (code.startsWith(query)) score = 90;
        else if (name.startsWith(query)) score = 82;
        else if (code.includes(query)) score = 72;
        else if (name.includes(query)) score = 64;

        return { material, index, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.material.name.localeCompare(b.material.name, "vi"));
  }

  function selectMaterial(row, material) {
    row.dataset.selectedCode = material.code;
    row.dataset.unknown = "false";
    row.querySelector(".material-code").value = material.code;
    row.querySelector(".material-name").value = material.name;
    row.querySelector(".unit").value = material.unit || "";
    row.querySelector(".unit").readOnly = true;
  }

  function markUnknownMaterial(row, term) {
    const codeInput = row.querySelector(".material-code");
    const nameInput = row.querySelector(".material-name");
    const unitInput = row.querySelector(".unit");
    const safeTerm = term.trim();

    row.dataset.selectedCode = "";
    row.dataset.unknown = "true";
    codeInput.value = "CHUA_CO_MA";
    if (!nameInput.value.trim()) {
      nameInput.value = safeTerm || "Chưa có mã vật tư";
    }
    unitInput.readOnly = false;
    unitInput.focus();
  }

  function closeSuggestions() {
    els.itemRows.querySelectorAll(".suggestions").forEach((panel) => {
      panel.hidden = true;
      panel.innerHTML = "";
    });
  }

  async function handlePhotoInput(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    if (!files.length) return;
    const remaining = 3 - state.photos.length;
    if (remaining <= 0) {
      setMessage("Tối đa 3 ảnh cho mỗi phiếu.", "error");
      return;
    }

    const selected = files.slice(0, remaining);
    if (files.length > remaining) {
      setMessage(`Chỉ thêm ${remaining} ảnh vì giới hạn mỗi phiếu là 3 ảnh.`, "error");
    }

    for (const file of selected) {
      if (!file.type.startsWith("image/")) continue;
      try {
        const photo = await compressImage(file);
        state.photos.push(photo);
      } catch (error) {
        setMessage(`Không đọc được ảnh ${file.name}.`, "error");
      }
    }

    renderPhotos();
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const image = new Image();
        image.onerror = reject;
        image.onload = () => {
          const maxSize = 1280;
          const ratio = Math.min(1, maxSize / Math.max(image.width, image.height));
          const width = Math.max(1, Math.round(image.width * ratio));
          const height = Math.max(1, Math.round(image.height * ratio));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(image, 0, 0, width, height);

          resolve({
            id: createId("PHOTO"),
            name: file.name,
            type: "image/jpeg",
            size: file.size,
            dataUrl: canvas.toDataURL("image/jpeg", 0.76)
          });
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function renderPhotos() {
    els.photoCount.textContent = `${state.photos.length}/3 ảnh`;
    if (!state.photos.length) {
      els.photoPreview.innerHTML = "";
      return;
    }

    els.photoPreview.innerHTML = state.photos
      .map((photo, index) => {
        const src = photo.dataUrl || photo.url || "";
        return `
          <div class="photo-tile">
            <img src="${escapeHtml(src)}" alt="${escapeHtml(photo.name || `Ảnh ${index + 1}`)}">
            <button class="icon-button" type="button" data-photo-index="${index}" aria-label="Xóa ảnh" title="Xóa ảnh">
              <i data-lucide="x" aria-hidden="true">X</i>
            </button>
          </div>
        `;
      })
      .join("");

    els.photoPreview.querySelectorAll("[data-photo-index]").forEach((button) => {
      button.addEventListener("click", () => {
        state.photos.splice(Number(button.dataset.photoIndex), 1);
        renderPhotos();
      });
    });

    refreshIcons();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    closeSuggestions();
    setMessage("");

    const lockInfo = getLockInfo();
    if (!lockInfo.canWrite) {
      setMessage("Web đang khóa nhập. Cần mã quản lý để mở khóa.", "error");
      return;
    }

    const errors = [];
    const common = collectCommonFields(errors);
    const items = collectItems(errors);

    if (items.length === 0) {
      errors.push("Cần ít nhất 1 dòng vật tư.");
    }

    if (!state.signatureDirty) {
      errors.push("Cần ký tên xác nhận.");
    }

    if (state.photos.length === 0) {
      errors.push("Cần chụp ít nhất 1 ảnh vật tư.");
    }

    if (errors.length) {
      setMessage(errors[0], "error");
      return;
    }

    const now = new Date();
    const existing = state.editingId ? state.records.find((record) => record.id === state.editingId) : null;
    const record = {
      id: existing?.id || createId("PXK"),
      date: existing?.date || formatDateISO(now),
      time: existing?.time || formatTime(now),
      createdAt: existing?.createdAt || now.toISOString(),
      updatedAt: now.toISOString(),
      fullName: common.fullName,
      workshop: common.workshop,
      department: common.department,
      note: common.note,
      items,
      signatureDataUrl: els.signaturePad.toDataURL("image/png"),
      photos: state.photos.map((photo) => ({ ...photo })),
      cancelledAt: existing?.cancelledAt || null,
      cancelledBy: existing?.cancelledBy || "",
      cancelReason: existing?.cancelReason || "",
      syncStatus: state.settings.sheetUrl ? "pending" : "local",
      sentAt: null
    };

    if (existing) {
      const index = state.records.findIndex((entry) => entry.id === existing.id);
      state.records.splice(index, 1, record);
    } else {
      state.records.unshift(record);
    }

    saveRecords();
    renderRecords();
    updateSyncStatus();

    if (state.settings.sheetUrl) {
      setMessage("Đã lưu dự phòng trên máy này, đang gửi Google Sheet để admin thấy online...", "success");
      await syncRecord(record.id);
      if (state.adminAuthenticated) {
        refreshOnlineRecords(false);
      }
    } else {
      setMessage("Thiết bị này chưa cấu hình Google Apps Script URL nên phiếu chỉ lưu cục bộ, chưa gửi Google Sheet.", "error");
    }

    resetForm();
  }

  function collectCommonFields(errors) {
    const values = {
      fullName: els.fullName.value.trim(),
      workshop: els.workshop.value.trim(),
      department: els.department.value.trim(),
      note: els.note.value.trim()
    };

    if (!values.fullName) errors.push("Cần nhập họ tên.");
    if (!values.workshop) errors.push("Cần chọn xưởng.");
    if (!values.department) errors.push("Cần chọn bộ phận làm việc.");

    return values;
  }

  function collectItems(errors) {
    const rows = Array.from(els.itemRows.querySelectorAll(".item-card"));
    return rows
      .map((row, index) => collectItem(row, index + 1, errors))
      .filter(Boolean);
  }

  function collectItem(row, rowNumber, errors) {
    let code = row.querySelector(".material-code").value.trim();
    let name = row.querySelector(".material-name").value.trim();
    let unit = row.querySelector(".unit").value.trim();
    const quantityValue = row.querySelector(".quantity").value.trim();
    const monthsValue = row.querySelector(".months").value.trim();
    const quantity = Number(quantityValue);
    const months = Number(monthsValue);
    const unknown = row.dataset.unknown === "true" || normalizeText(code) === "chua_co_ma";
    const selectedCode = row.dataset.selectedCode;
    const exactMaterial = unknown ? null : findExactMaterial(code, name, selectedCode);

    if (exactMaterial) {
      code = exactMaterial.code;
      name = exactMaterial.name;
      unit = exactMaterial.unit || unit;
    } else if (!unknown) {
      errors.push(`Dòng ${rowNumber}: chọn vật tư từ danh sách hoặc chọn "Chưa có mã vật tư".`);
      return null;
    } else {
      code = "CHUA_CO_MA";
    }

    if (!name) errors.push(`Dòng ${rowNumber}: cần nhập tên vật tư.`);
    if (!quantityValue || !Number.isFinite(quantity) || quantity <= 0) errors.push(`Dòng ${rowNumber}: số lượng phải lớn hơn 0.`);
    if (hasDigits(unit)) {
      errors.push(`Dòng ${rowNumber}: đơn vị tính không được chứa số.`);
    }
    unit = stripDigits(unit).trim();
    if (!unit) errors.push(`Dòng ${rowNumber}: cần nhập đơn vị tính.`);
    if (!monthsValue || !Number.isInteger(months) || months <= 0) errors.push(`Dòng ${rowNumber}: số tháng phải là số nguyên lớn hơn 0.`);

    return {
      code,
      name,
      quantity,
      unit,
      months,
      unknown
    };
  }

  function findExactMaterial(code, name, selectedCode) {
    if (selectedCode) {
      return state.materials.find((material) => material.code === selectedCode);
    }

    const normalizedCode = normalizeText(code);
    if (normalizedCode) {
      const byCode = state.materials.find((material) => normalizeText(material.code) === normalizedCode);
      if (byCode) return byCode;
    }

    const normalizedName = normalizeText(name);
    if (normalizedName) {
      const byName = state.materials.filter((material) => normalizeText(material.name) === normalizedName);
      if (byName.length === 1) return byName[0];
    }

    return null;
  }

  async function handleDatabaseImport(event) {
    if (!requireAdmin()) return;
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const materials = await readMaterialFile(file);
      if (!materials.length) {
        setMessage("File không có dòng mã vật tư hợp lệ.", "error");
        return;
      }

      state.materials = dedupeMaterials(materials);
      state.settings.lastDbName = file.name;
      state.settings.lastDbUpdatedAt = new Date().toISOString();
      saveJson(STORAGE_KEYS.materials, state.materials);
      saveSettings();
      updateDbStatus();
      setMessage(`Đã nạp ${state.materials.length} mã vật tư từ ${file.name}.`, "success");
    } catch (error) {
      setMessage(error.message || "Không đọc được file CCDC.", "error");
    }
  }

  async function readMaterialFile(file) {
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
      if (!window.XLSX) {
        throw new Error("Chưa tải được thư viện đọc Excel. Có thể lưu file thành CSV rồi nạp lại.");
      }
      const buffer = await file.arrayBuffer();
      const workbook = window.XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
      return normalizeMaterialRows(rows);
    }

    const text = await file.text();
    const rows = csvToObjects(text);
    return normalizeMaterialRows(rows);
  }

  function normalizeMaterialRows(rows) {
    if (!rows.length) return [];
    const headers = Object.keys(rows[0]);
    const codeKey = findColumn(headers, ["ma vat tu", "ma ccdc", "ma hang", "ma", "code"]);
    const nameKey = findColumn(headers, ["ten vat tu", "ten ccdc", "ten hang", "ten", "name"]);
    const unitKey = findColumn(headers, ["don vi tinh", "dvt", "unit", "uom"]);

    if (!codeKey || !nameKey) {
      throw new Error("File cần có cột mã vật tư và tên vật tư.");
    }

    return rows
      .map((row) => ({
        code: String(row[codeKey] ?? "").trim(),
        name: String(row[nameKey] ?? "").trim(),
        unit: unitKey ? stripDigits(String(row[unitKey] ?? "")).trim() : ""
      }))
      .filter((material) => material.code && material.name);
  }

  function findColumn(headers, candidates) {
    const normalizedCandidates = candidates.map(normalizeHeader);
    const exact = headers.find((header) => normalizedCandidates.includes(normalizeHeader(header)));
    if (exact) return exact;

    return headers.find((header) => {
      const normalized = normalizeHeader(header);
      return normalizedCandidates.some((candidate) => normalized.includes(candidate));
    });
  }

  function normalizeHeader(value) {
    return normalizeText(value).replace(/[^a-z0-9]+/g, " ").trim();
  }

  function dedupeMaterials(materials) {
    const map = new Map();
    materials.forEach((material) => {
      const key = normalizeText(material.code);
      if (!map.has(key)) {
        map.set(key, material);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code, "vi"));
  }

  function updateDbStatus() {
    const name = state.settings.lastDbName || "Dữ liệu mẫu";
    const updated = state.settings.lastDbUpdatedAt ? `, ${formatDateTimeShort(new Date(state.settings.lastDbUpdatedAt))}` : "";
    els.dbStatus.textContent = `${state.materials.length} mã`;
    els.dbStatus.title = `${name}${updated}`;
  }

  function saveSheetUrl() {
    if (!requireAdmin()) return;
    const nextUrl = els.sheetUrl.value.trim();
    if (nextUrl && !isValidWebAppUrl(nextUrl)) {
      setMessage("URL phải là link Web app đã Deploy, dạng https://script.google.com/macros/s/.../exec, không phải link chỉnh sửa Apps Script.", "error");
      return;
    }

    state.settings.sheetUrl = nextUrl;
    if (state.settings.sheetUrl) {
      state.records.forEach((record) => {
        if (!record.sentAt) record.syncStatus = "pending";
      });
      saveRecords();
      setMessage("Đã lưu URL Google Apps Script.", "success");
    } else {
      setMessage("Đã chuyển về chế độ lưu cục bộ.", "success");
    }
    saveSettings();
    updateSyncStatus();
    renderRecords();
    if (state.adminAuthenticated && state.settings.sheetUrl) {
      refreshOnlineRecords(true);
    }
  }

  async function refreshOnlineRecords(showMessage) {
    if (!state.adminAuthenticated || !state.settings.sheetUrl || state.onlineRecordsLoading) return;

    state.onlineRecordsLoading = true;
    try {
      const payload = await requestJsonp(state.settings.sheetUrl, {
        action: "records",
        limit: "100"
      });

      if (!payload || payload.ok === false || !Array.isArray(payload.records)) {
        throw new Error(payload?.error || "Invalid online records response");
      }

      mergeOnlineRecords(payload.records);
      state.lastOnlineRecordsAt = new Date().toISOString();
      saveRecords();
      renderRecords();
      updateSyncStatus();
      if (showMessage) {
        setMessage(`Đã tải ${payload.records.length} phiếu từ Google Sheet.`, "success");
      }
    } catch (error) {
      if (showMessage) {
        setMessage("Chưa tải được phiếu online. Cần cập nhật Apps Script và deploy phiên bản mới.", "error");
      }
      console.warn("Cannot load online records", error);
    } finally {
      state.onlineRecordsLoading = false;
    }
  }

  function mergeOnlineRecords(onlineRecords) {
    const localById = new Map(state.records.map((record) => [record.id, record]));
    const onlineIds = new Set();
    const mergedOnline = onlineRecords
      .map((record) => normalizeOnlineRecord(record, localById.get(record.id)))
      .filter(Boolean);

    mergedOnline.forEach((record) => onlineIds.add(record.id));

    const localOnly = state.records.filter((record) => {
      if (onlineIds.has(record.id)) return false;
      return record.syncStatus !== "sent" || !record.sentAt;
    });

    state.records = [...mergedOnline, ...localOnly].sort((a, b) => getRecordSortTime(b) - getRecordSortTime(a));
  }

  function normalizeOnlineRecord(record, localRecord) {
    if (!record || !record.id) return null;

    const localPhotos = (localRecord?.photos || []).filter((photo) => photo.dataUrl);
    const onlinePhotos = (record.photos || []).map((photo, index) => ({
      id: photo.id || createId("PHOTO"),
      name: photo.name || `Ảnh ${index + 1}`,
      type: photo.type || "image/jpeg",
      size: Number(photo.size || 0),
      dataUrl: photo.dataUrl || "",
      url: photo.url || photo.photoUrl || ""
    }));

    return {
      ...localRecord,
      ...record,
      items: Array.isArray(record.items) ? record.items : [],
      photos: localPhotos.length ? localPhotos : onlinePhotos,
      signatureDataUrl: localRecord?.signatureDataUrl || record.signatureDataUrl || "",
      signatureUrl: record.signatureUrl || localRecord?.signatureUrl || "",
      photoUrls: record.photoUrls || localRecord?.photoUrls || onlinePhotos.map((photo) => photo.url).filter(Boolean),
      syncStatus: "sent",
      sentAt: record.sentAt || record.receivedAt || localRecord?.sentAt || new Date().toISOString(),
      fromSheet: true
    };
  }

  function getRecordSortTime(record) {
    const candidates = [
      record.updatedAt,
      record.receivedAt,
      record.createdAt,
      record.date && record.time ? `${record.date}T${record.time}` : ""
    ];

    for (const value of candidates) {
      const time = Date.parse(value);
      if (Number.isFinite(time)) return time;
    }
    return 0;
  }

  function requestJsonp(baseUrl, params) {
    return new Promise((resolve, reject) => {
      const callbackName = `mwJsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement("script");
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("Online records request timed out"));
      }, 15000);

      function cleanup() {
        window.clearTimeout(timeout);
        delete window[callbackName];
        script.remove();
      }

      window[callbackName] = (payload) => {
        cleanup();
        resolve(payload);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error("Online records request failed"));
      };

      const url = new URL(baseUrl);
      Object.entries(params || {}).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
      url.searchParams.set("callback", callbackName);
      url.searchParams.set("_", String(Date.now()));
      script.src = url.toString();
      document.head.appendChild(script);
    });
  }

  async function syncPendingRecords() {
    if (!requireAdmin()) return;
    if (!state.settings.sheetUrl) {
      setMessage("Cần nhập Google Apps Script URL trước.", "error");
      return;
    }

    const pending = state.records.filter((record) => !record.sentAt || record.syncStatus === "pending");
    if (!pending.length) {
      setMessage("Không có phiếu chờ gửi.", "success");
      return;
    }

    setMessage(`Đang gửi ${pending.length} phiếu...`, "success");
    for (const record of pending) {
      await syncRecord(record.id);
    }
    setMessage("Đã gửi yêu cầu đồng bộ các phiếu đang chờ.", "success");
  }

  async function syncRecord(recordId) {
    const record = state.records.find((entry) => entry.id === recordId);
    if (!record || !state.settings.sheetUrl) return;

    try {
      await fetch(state.settings.sheetUrl, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          app: "materials-warehouse",
          version: 1,
          record
        })
      });

      record.sentAt = new Date().toISOString();
      record.syncStatus = "sent";
      saveRecords();
      renderRecords();
      updateSyncStatus();
      setMessage("Đã gửi yêu cầu đồng bộ Google Sheet.", "success");
    } catch (error) {
      record.syncStatus = "pending";
      saveRecords();
      renderRecords();
      updateSyncStatus();
      setMessage("Chưa gửi được Google Sheet. Phiếu vẫn lưu cục bộ.", "error");
    }
  }

  async function syncDeleteRecord(recordId) {
    if (!state.settings.sheetUrl) return true;

    try {
      await fetch(state.settings.sheetUrl, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          app: "materials-warehouse",
          version: 1,
          action: "delete",
          recordId
        })
      });
      return true;
    } catch (error) {
      setMessage("Chưa gửi được lệnh xóa Google Sheet. Phiếu vẫn được giữ cục bộ.", "error");
      return false;
    }
  }

  function isValidWebAppUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.hostname === "script.google.com" && parsed.pathname.includes("/macros/s/") && parsed.pathname.endsWith("/exec");
    } catch (error) {
      return false;
    }
  }

  function updateSyncStatus() {
    const pending = state.records.filter((record) => !record.sentAt || record.syncStatus === "pending").length;
    if (!state.settings.sheetUrl) {
      els.syncStatus.textContent = "Cục bộ";
      return;
    }
    els.syncStatus.textContent = pending ? `${pending} chờ gửi` : "Đã cấu hình";
  }

  function unlockByManager() {
    if (!requireAdmin()) return;

    if (!state.adminAuthenticated && !checkPin(els.managerPin.value)) {
      setMessage("Mã quản lý không đúng.", "error");
      return;
    }

    const minutes = clamp(Number(els.unlockMinutes.value || 60), 5, 480);
    const until = new Date(Date.now() + minutes * 60 * 1000);
    state.settings.emergencyUntil = until.toISOString();
    els.managerPin.value = "";
    saveSettings();
    updateLockState();
    setMessage(`Đã mở khóa đến ${formatDateTimeShort(until)}.`, "success");
  }

  function lockNow() {
    if (!requireAdmin()) return;
    state.settings.emergencyUntil = null;
    saveSettings();
    updateLockState();
    setMessage("Đã khóa quyền quản lý.", "success");
  }

  function changePin() {
    if (!requireAdmin()) return;
    const current = els.currentPin.value;
    const next = els.newPin.value.trim();
    if (!checkPin(current)) {
      setMessage("Mã hiện tại không đúng.", "error");
      return;
    }
    if (next.length < 4) {
      setMessage("Mã mới cần tối thiểu 4 ký tự.", "error");
      return;
    }
    state.settings.managerPin = next;
    els.currentPin.value = "";
    els.newPin.value = "";
    saveSettings();
    setMessage("Đã đổi mã quản lý.", "success");
  }

  function checkPin(value) {
    return String(value || "") === String(state.settings.managerPin || DEFAULT_SETTINGS.managerPin);
  }

  function renderRecords() {
    els.recordCount.textContent = `${state.records.length} phiếu`;

    if (!state.records.length) {
      els.recordsList.innerHTML = `<p class="empty-state">Chưa có phiếu nào.</p>`;
      return;
    }

    const managerOpen = isManagerOpen();
    els.recordsList.innerHTML = state.records
      .slice(0, 8)
      .map((record) => {
        const itemText = record.items.length === 1 ? record.items[0].name : `${record.items.length} dòng vật tư`;
        const status = getRecordStatus(record);
        const isCancelled = Boolean(record.cancelledAt);
        const editDisabled = !managerOpen || isCancelled || isOnlineOnlyRecord(record);
        const cancelDisabled = !managerOpen || isCancelled;
        const deleteDisabled = !managerOpen;
        const cancelMeta = isCancelled
          ? `<div class="record-meta">Hủy: ${escapeHtml(formatDateTimeShort(new Date(record.cancelledAt)))} · ${escapeHtml(record.cancelReason || "Không ghi lý do")}</div>`
          : "";
        return `
          <article class="record-row">
            <div class="record-top">
              <div>
                <div class="record-title">${escapeHtml(record.fullName)} - ${escapeHtml(itemText)}</div>
                <div class="record-meta">${escapeHtml(record.date)} ${escapeHtml(record.time)} · ${escapeHtml(record.workshop)} · ${escapeHtml(record.department)}</div>
                ${cancelMeta}
              </div>
              <span class="tag ${status.className}">${status.label}</span>
            </div>
            <div class="record-actions">
              <button class="secondary-button" type="button" data-record-action="edit" data-record-id="${record.id}" ${editDisabled ? "disabled" : ""}>
                <i data-lucide="pencil" aria-hidden="true"></i>
                <span>Sửa</span>
              </button>
              <button class="danger-button" type="button" data-record-action="cancel" data-record-id="${record.id}" ${cancelDisabled ? "disabled" : ""}>
                <i data-lucide="ban" aria-hidden="true"></i>
                <span>${isCancelled ? "Đã hủy" : "Hủy"}</span>
              </button>
              <button class="danger-button permanent-delete-button" type="button" data-record-action="delete" data-record-id="${record.id}" ${deleteDisabled ? "disabled" : ""}>
                <i data-lucide="trash-2" aria-hidden="true"></i>
                <span>Xóa vĩnh viễn</span>
              </button>
            </div>
          </article>
        `;
      })
      .join("");

    refreshIcons();
  }

  function getRecordStatus(record) {
    if (record.cancelledAt && record.syncStatus === "pending") return { label: "Hủy chờ gửi", className: "pending" };
    if (record.cancelledAt) return { label: "Đã hủy", className: "cancelled" };
    if (record.syncStatus === "sent" && record.sentAt) return { label: "Đã gửi", className: "sent" };
    if (record.syncStatus === "pending") return { label: "Chờ gửi", className: "pending" };
    return { label: "Cục bộ", className: "local" };
  }

  function getSyncStatusLabel(record) {
    if (record.syncStatus === "sent" && record.sentAt) return "Đã gửi";
    if (record.syncStatus === "pending") return "Chờ gửi";
    return "Cục bộ";
  }

  function isOnlineOnlyRecord(record) {
    if (!record.fromSheet) return false;
    const hasLocalSignature = Boolean(record.signatureDataUrl);
    const hasLocalPhotos = (record.photos || []).some((photo) => Boolean(photo.dataUrl));
    return !hasLocalSignature || !hasLocalPhotos;
  }

  async function handleRecordAction(event) {
    if (!requireAdmin()) return;
    const button = event.target.closest("[data-record-action]");
    if (!button) return;

    const action = button.dataset.recordAction;
    const record = state.records.find((entry) => entry.id === button.dataset.recordId);
    if (!record) return;

    if (!isManagerOpen()) {
      setMessage("Cần mở khóa bằng mã quản lý để sửa hoặc hủy phiếu.", "error");
      return;
    }

    if (action === "edit") {
      if (record.cancelledAt) {
        setMessage("Phiếu này đã hủy, không thể sửa.", "error");
        return;
      }
      if (isOnlineOnlyRecord(record)) {
        setMessage("Phiếu tải từ Google Sheet chỉ có link ảnh/chữ ký nên không sửa trực tiếp trên máy này. Có thể hủy hoặc xóa vĩnh viễn.", "error");
        return;
      }
      loadRecordForEdit(record);
      return;
    }

    if (action === "cancel") {
      if (record.cancelledAt) {
        setMessage("Phiếu này đã hủy, không thể hủy lại.", "error");
        return;
      }
      openCancelDialog(record);
      return;
    }

    if (action === "delete") {
      openDeleteDialog(record);
    }
  }

  async function cancelRecord(record, reason) {
    const cancelledAt = new Date();
    record.cancelledAt = cancelledAt.toISOString();
    record.cancelledBy = "Quản lý";
    record.cancelReason = reason.trim();
    record.updatedAt = record.cancelledAt;
    record.syncStatus = state.settings.sheetUrl ? "pending" : "local";

    saveRecords();
    renderRecords();
    updateSyncStatus();

    if (state.settings.sheetUrl) {
      setMessage("Đã hủy phiếu cục bộ, đang cập nhật Google Sheet...", "success");
      await syncRecord(record.id);
      if (state.adminAuthenticated) {
        refreshOnlineRecords(false);
      }
    } else {
      setMessage("Đã hủy phiếu cục bộ. Cấu hình Google Sheet hoặc xuất CSV/JSON để lưu vết hủy.", "success");
    }
  }

  async function permanentlyDeleteRecord(record) {
    if (state.settings.sheetUrl) {
      setMessage("Đang xóa vĩnh viễn trên Google Sheet...", "success");
    }

    const synced = await syncDeleteRecord(record.id);
    if (!synced) return;

    state.records = state.records.filter((entry) => entry.id !== record.id);
    if (state.editingId === record.id) {
      resetForm();
    }
    saveRecords();
    renderRecords();
    updateSyncStatus();
    setMessage("Đã xóa vĩnh viễn phiếu.", "success");
    if (state.adminAuthenticated) {
      window.setTimeout(() => refreshOnlineRecords(false), 1200);
    }
  }

  function loadRecordForEdit(record) {
    state.editingId = record.id;
    els.editState.textContent = `Đang sửa phiếu ${record.id}`;
    els.cancelEditBtn.classList.remove("hidden");
    els.takeDate.value = record.date;
    els.takeTime.value = record.time;
    els.fullName.value = record.fullName;
    els.workshop.value = record.workshop;
    els.department.value = record.department;
    els.note.value = record.note || "";
    els.itemRows.innerHTML = "";
    record.items.forEach((item) => addItemRow(item));
    state.photos = record.photos.map((photo) => ({ ...photo }));
    renderPhotos();
    clearSignature();
    drawSignatureImage(record.signatureDataUrl);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    state.editingId = null;
    state.photos = [];
    state.itemSeq = 0;
    els.issueForm.reset();
    els.itemRows.innerHTML = "";
    els.editState.textContent = "";
    els.cancelEditBtn.classList.add("hidden");
    addItemRow();
    renderPhotos();
    clearSignature();
    updateNowFields(true);
    updateLockState();
  }

  function exportCsv() {
    if (!requireAdmin()) return;
    if (!state.records.length) {
      setMessage("Chưa có dữ liệu để xuất CSV.", "error");
      return;
    }

    const rows = flattenRecordsForCsv(state.records);
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.map(escapeCsv).join(","),
      ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(","))
    ].join("\r\n");

    downloadBlob(`phieu-xuat-kho-${formatDateISO(new Date())}.csv`, `\uFEFF${csv}`, "text/csv;charset=utf-8");
  }

  function exportJson() {
    if (!requireAdmin()) return;
    if (!state.records.length) {
      setMessage("Chưa có dữ liệu để xuất JSON.", "error");
      return;
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      records: state.records
    };
    downloadBlob(`phieu-xuat-kho-full-${formatDateISO(new Date())}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
  }

  function flattenRecordsForCsv(records) {
    return records.flatMap((record) =>
      record.items.map((item, index) => ({
        record_id: record.id,
        ngay: record.date,
        gio: record.time,
        ho_ten: record.fullName,
        xuong: record.workshop,
        bo_phan: record.department,
        ma_vat_tu: item.code,
        ten_vat_tu: item.name,
        so_luong: item.quantity,
        don_vi_tinh: item.unit,
        so_thang: item.months,
        ghi_chu: record.note || "",
        chua_co_ma: item.unknown ? "Đúng" : "Không đúng",
        dong_vat_tu: index + 1,
        tong_so_dong: record.items.length,
        so_anh: record.photos.length,
        da_ky: record.signatureDataUrl ? "Có" : "Không",
        trang_thai_phieu: record.cancelledAt ? "Đã hủy" : "Đang hoạt động",
        cancelled_at: record.cancelledAt || "",
        cancelled_by: record.cancelledBy || "",
        cancel_reason: record.cancelReason || "",
        trang_thai_dong_bo: getSyncStatusLabel(record),
        created_at: record.createdAt,
        updated_at: record.updatedAt || "",
        sent_at: record.sentAt || ""
      }))
    );
  }

  function csvToObjects(text) {
    const rows = parseCsv(text.replace(/^\uFEFF/, ""));
    if (rows.length < 2) return [];
    const headers = rows[0].map((header) => header.trim());
    return rows.slice(1).map((row) => {
      const object = {};
      headers.forEach((header, index) => {
        object[header] = row[index] ?? "";
      });
      return object;
    });
  }

  function parseCsv(text) {
    const delimiter = detectDelimiter(text);
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const next = text[index + 1];

      if (char === "\"") {
        if (inQuotes && next === "\"") {
          field += "\"";
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (!inQuotes && char === delimiter) {
        row.push(field);
        field = "";
        continue;
      }

      if (!inQuotes && (char === "\n" || char === "\r")) {
        if (char === "\r" && next === "\n") index += 1;
        row.push(field);
        if (row.some((value) => value.trim() !== "")) rows.push(row);
        row = [];
        field = "";
        continue;
      }

      field += char;
    }

    row.push(field);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
    return rows;
  }

  function detectDelimiter(text) {
    const firstLine = text.split(/\r?\n/, 1)[0] || "";
    const candidates = [",", ";", "\t"];
    return candidates
      .map((delimiter) => ({
        delimiter,
        count: firstLine.split(delimiter).length
      }))
      .sort((a, b) => b.count - a.count)[0].delimiter;
  }

  function downloadBlob(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function saveRecords() {
    saveJson(STORAGE_KEYS.records, state.records);
  }

  function saveSettings() {
    saveJson(STORAGE_KEYS.settings, state.settings);
  }

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      setMessage("Bộ nhớ trình duyệt không đủ để lưu thêm dữ liệu. Nên cấu hình Google Sheet hoặc xuất JSON để sao lưu.", "error");
      return false;
    }
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/đ/g, "d")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function hasDigits(value) {
    return /[0-9０-９]/.test(String(value || ""));
  }

  function stripDigits(value) {
    return String(value || "").replace(/[0-9０-９]/g, "");
  }

  function formatDateISO(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function formatDateVN(date) {
    return [
      String(date.getDate()).padStart(2, "0"),
      String(date.getMonth() + 1).padStart(2, "0"),
      date.getFullYear()
    ].join("/");
  }

  function formatTime(date) {
    return [
      String(date.getHours()).padStart(2, "0"),
      String(date.getMinutes()).padStart(2, "0"),
      String(date.getSeconds()).padStart(2, "0")
    ].join(":");
  }

  function formatDateTimeShort(date) {
    return `${formatDateVN(date)} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  function createId(prefix) {
    const random = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `${prefix}-${Date.now()}-${random}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeCsv(value) {
    const string = String(value ?? "");
    if (/[",\r\n]/.test(string)) {
      return `"${string.replace(/"/g, "\"\"")}"`;
    }
    return string;
  }

  function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
  }

  function debounce(callback, wait) {
    let timer = null;
    return (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => callback(...args), wait);
    };
  }

  function setMessage(message, type = "") {
    els.formMessage.textContent = message;
    els.formMessage.classList.toggle("error", type === "error");
    els.formMessage.classList.toggle("success", type === "success");
  }

  function refreshIcons() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
})();
