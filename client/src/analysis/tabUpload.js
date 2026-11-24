import LZString from "lz-string";
import { MAX_BYTES, parseCsv } from "./csv.js";

const uploadKey = "logdetect.upload.v1";
const compressedPrefix = "~";

export function restoreUpload(storage = window.sessionStorage) {
  const saved = storage.getItem(uploadKey);
  if (saved === null) return null;
  const json = saved.startsWith(compressedPrefix)
    ? LZString.decompressFromUTF16(saved.slice(1))
    : saved;
  const upload = JSON.parse(json);
  if (!upload || typeof upload.name !== "string" || typeof upload.csv !== "string" || upload.csv.length > MAX_BYTES) {
    throw new Error("Invalid saved CSV.");
  }
  const parsed = parseCsv(upload.csv);
  if (!parsed.rows.length) throw new Error("Saved CSV has no valid records.");
  return { name: upload.name, ...parsed };
}

export function rememberUpload(name, csv, storage = window.sessionStorage) {
  const json = JSON.stringify({ name, csv });
  try {
    storage.setItem(uploadKey, json);
  } catch (error) {
    // A failed replacement must not bring an older file back on refresh.
    storage.removeItem(uploadKey);
    if (error.name !== "QuotaExceededError" && error.name !== "NS_ERROR_DOM_QUOTA_REACHED") throw error;
    storage.setItem(uploadKey, compressedPrefix + LZString.compressToUTF16(json));
  }
}

export function forgetUpload(storage = window.sessionStorage) {
  storage.removeItem(uploadKey);
}
