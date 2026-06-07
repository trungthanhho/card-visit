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

  const signatureUrl = saveDataUrl_(folder, record.signatureDataUrl, `${record.id}_signature.png`);
  const photoUrls = (record.photos || [])
    .slice(0, 3)
    .map((photo, index) => saveDataUrl_(folder, photo.dataUrl, `${record.id}_photo_${index + 1}.jpg`));

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
