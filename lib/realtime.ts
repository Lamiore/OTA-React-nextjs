import { onValue, ref } from "firebase/database";
import { rtdb } from "./firebase";

export interface SensorReading {
  tempDHT: number;
  humidity: number;
  tempDS18: number;
  rainStatus: string;
  rainValue: number;
  windSpeed: number;
  flowRate: number;
  updatedAt: number;
  // GPS — hanya terisi saat modul NEO-6M dapat fix satelit; kalau belum fix
  // gpsValid=false dan koordinat 0, jadi UI bisa tampilkan "mencari sinyal".
  latitude?: number;
  longitude?: number;
  altitude?: number;
  speed?: number;
  satellites?: number;
  gpsValid?: boolean;
}

/** Id stasiun aman dipakai sebagai segmen path RTDB (tanpa . # $ / [ ] & spasi). */
export function sanitizeStationId(id: string): string {
  return id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

/**
 * Path RTDB paket sensor sebuah destinasi, atau null kalau destinasi itu tidak
 * punya stasiun. Tiap paket sensor menulis ke `monitoring/<stationId>/latest`.
 * Dokumen lama tanpa stationId (cuma hasMonitoring) tetap dibaca dari
 * `monitoring/latest` — stasiun pertama yang firmware-nya belum diberi id.
 */
export function stationPath(d: {
  stationId?: string;
  hasMonitoring?: boolean;
}): string | null {
  const id = sanitizeStationId(d.stationId ?? "");
  if (id) return `monitoring/${id}/latest`;
  return d.hasMonitoring ? "monitoring/latest" : null;
}

export function subscribeMonitoring(
  path: string,
  callback: (data: SensorReading | null) => void
) {
  if (!rtdb) return () => {};
  return onValue(ref(rtdb, path), (snap) => callback(snap.val()));
}
