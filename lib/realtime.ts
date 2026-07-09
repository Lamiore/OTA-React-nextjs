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

export function subscribeMonitoring(
  callback: (data: SensorReading | null) => void
) {
  if (!rtdb) return () => {};
  const sensorRef = ref(rtdb, "monitoring/latest");
  return onValue(sensorRef, (snap) => callback(snap.val()));
}
