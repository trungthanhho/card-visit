const SPREADSHEET_ID = "PASTE_SPREADSHEET_ID_HERE";
const SHEET_NAME = "Phieu xuat kho";
const DRIVE_FOLDER_ID = "PASTE_DRIVE_FOLDER_ID_HERE";

const HEADERS = [
  "record_id",
  "ngay",
  "gio",
  "ho_ten",
  "xuong",
  "bo_phan",
  "ma_vat_tu",
  "ten_vat_tu",
  "so_luong",
  "don_vi_tinh",
  "so_thang",
  "ghi_chu",
  "chua_co_ma",
  "dong_vat_tu",
  "tong_so_dong",
  "signature_url",
  "photo_1_url",
  "photo_2_url",
  "photo_3_url",
  "created_at",
  "updated_at",
  "received_at",
  "trang_thai_phieu",
  "cancelled_at",
  "cancelled_by",
  "cancel_reason"
];

function doGet(e) {
  const params = (e && e.parameter) || {};
  const callback = params.callback || "";

  try {
    const action = String(params.action || "").toLowerCase();
    if (action === "records") {
      const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
      const sheet = getSheet_(spreadsheet);
      ensureHeaders_(sheet);
      const limit = Math.min(Math.max(Number(params.limit || 100), 1), 500);
      return jsonOrJsonp_({
        ok: true,
        records: listRecords_(sheet, limit),
        receivedAt: new Date()
      }, callback);
    }

    return jsonOrJsonp_({ ok: true, app: "materials-warehouse" }, callback);
  } catch (error) {
    return jsonOrJsonp_({ ok: false, error: String(error && error.message ? error.message : error) }, callback);
  }
}

function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return json_({ ok: false, error: "Use the deployed Web app URL. Do not run doPost directly." });
  }

  const payload = JSON.parse(e.postData.contents || "{}");
  const action = String(payload.action || "upsert").toLowerCase();
  if (action === "delete") {
    const recordId = payload.recordId || (payload.record && payload.record.id);
    if (!recordId) {
      return json_({ ok: false, error: "Missing recordId" });
    }

    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getSheet_(spreadsheet);
    const deletedRows = deleteRecordRows_(sheet, recordId, true);
    return json_({ ok: true, action: "delete", recordId: recordId, deletedRows: deletedRows });
  }

  const record = payload.record;
  if (!record || !record.id) {
    return json_({ ok: false, error: "Missing record" });
  }

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getSheet_(spreadsheet);
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);

  ensureHeaders_(sheet);
  deleteRecordRows_(sheet, record.id, false);

  const signatureUrl = saveDataUrl_(folder, record.signatureDataUrl, `${record.id}_signature.png`) || record.signatureUrl || "";
  const existingPhotoUrls = Array.isArray(record.photoUrls)
    ? record.photoUrls
    : (record.photos || []).map((photo) => photo.url || photo.photoUrl || "").filter(Boolean);
  const savedPhotoUrls = (record.photos || [])
    .slice(0, 3)
    .map((photo, index) => saveDataUrl_(folder, photo.dataUrl, `${record.id}_photo_${index + 1}.jpg`));
  const photoUrls = [0, 1, 2].map((index) => savedPhotoUrls[index] || existingPhotoUrls[index] || "");

  const receivedAt = new Date();
  const rows = (record.items || []).map((item, index) => [
    record.id,
    record.date,
    record.time,
    record.fullName,
    record.workshop,
    record.department,
    item.code,
    item.name,
    item.quantity,
    item.unit,
    item.months,
    record.note || "",
    item.unknown ? "Đúng" : "Không đúng",
    index + 1,
    record.items.length,
    signatureUrl,
    photoUrls[0] || "",
    photoUrls[1] || "",
    photoUrls[2] || "",
    record.createdAt,
    record.updatedAt || "",
    receivedAt,
    record.cancelledAt ? "Da huy" : "Dang hoat dong",
    record.cancelledAt || "",
    record.cancelledBy || "",
    record.cancelReason || ""
  ]);

  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, HEADERS.length).setValues(rows);
  }

  return json_({ ok: true, rows: rows.length });
}

function getSheet_(spreadsheet) {
  return spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
}

function ensureHeaders_(sheet) {
  const existing = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const hasHeaders = existing.some((value) => String(value || "").trim());
  const sameHeaders = HEADERS.every((header, index) => String(existing[index] || "") === header);
  if (!hasHeaders || !sameHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
}

function listRecords_(sheet, limit) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  const recordsById = {};

  values.forEach((row) => {
    const recordId = text_(row[0]);
    if (!recordId) return;

    if (!recordsById[recordId]) {
      const cancelledAt = iso_(row[23]);
      recordsById[recordId] = {
        id: recordId,
        date: date_(row[1]),
        time: time_(row[2]),
        fullName: text_(row[3]),
        workshop: text_(row[4]),
        department: text_(row[5]),
        note: text_(row[11]),
        items: [],
        signatureDataUrl: "",
        signatureUrl: text_(row[15]),
        photoUrls: [text_(row[16]), text_(row[17]), text_(row[18])].filter(Boolean),
        photos: [text_(row[16]), text_(row[17]), text_(row[18])]
          .filter(Boolean)
          .map((url, index) => ({
            id: `${recordId}_photo_${index + 1}`,
            name: `Ảnh ${index + 1}`,
            url: url
          })),
        createdAt: iso_(row[19]),
        updatedAt: iso_(row[20]),
        receivedAt: iso_(row[21]),
        sentAt: iso_(row[21]),
        cancelledAt: cancelledAt,
        cancelledBy: text_(row[24]),
        cancelReason: text_(row[25]),
        syncStatus: "sent",
        fromSheet: true
      };
    }

    recordsById[recordId].items.push({
      order: Number(row[13]) || recordsById[recordId].items.length + 1,
      code: text_(row[6]),
      name: text_(row[7]),
      quantity: text_(row[8]),
      unit: text_(row[9]),
      months: text_(row[10]),
      unknown: isYes_(row[12])
    });
  });

  return Object.keys(recordsById)
    .map((id) => {
      const record = recordsById[id];
      record.items.sort((a, b) => a.order - b.order);
      record.items = record.items.map((item) => ({
        code: item.code,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        months: item.months,
        unknown: item.unknown
      }));
      return record;
    })
    .sort((a, b) => sortTime_(b) - sortTime_(a))
    .slice(0, limit);
}

function text_(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function date_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return text_(value);
}

function time_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "HH:mm:ss");
  }
  return text_(value);
}

function iso_(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  return text_(value);
}

function sortTime_(record) {
  const value = record.receivedAt || record.updatedAt || record.createdAt || `${record.date}T${record.time || "00:00:00"}`;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isYes_(value) {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  return ["dung", "co", "true", "yes", "1"].includes(normalized);
}

function deleteRecordRows_(sheet, recordId, deleteFiles) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  let deletedRows = 0;
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const row = values[index];
    if (String(row[0]) === String(recordId)) {
      if (deleteFiles) {
        trashFileByUrl_(row[15]);
        trashFileByUrl_(row[16]);
        trashFileByUrl_(row[17]);
        trashFileByUrl_(row[18]);
      }
      sheet.deleteRow(index + 2);
      deletedRows += 1;
    }
  }
  return deletedRows;
}

function trashFileByUrl_(url) {
  if (!url) return;

  const match = String(url).match(/\/d\/([^/]+)|[?&]id=([^&]+)/);
  const fileId = match && (match[1] || match[2]);
  if (!fileId) return;

  try {
    DriveApp.getFileById(fileId).setTrashed(true);
  } catch (error) {
    // Ignore missing files or permission mismatches so row deletion can continue.
  }
}

function saveDataUrl_(folder, dataUrl, filename) {
  if (!dataUrl) return "";

  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return "";

  const contentType = match[1];
  const bytes = Utilities.base64Decode(match[2]);
  const blob = Utilities.newBlob(bytes, contentType, filename);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonOrJsonp_(payload, callback) {
  const callbackName = String(callback || "").trim();
  if (/^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(callbackName)) {
    return ContentService
      .createTextOutput(`${callbackName}(${JSON.stringify(payload)});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json_(payload);
}
