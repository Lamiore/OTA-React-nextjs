import { onValue, ref } from "firebase/database";
import { rtdb } from "./firebase";

export interface SensorReading {
  tempDHT: number;
  humidity: number;
  tempDS18: number;
  rainStatus: string;
  windSpeed: number;
  flowRate: number;
  ecValue: number;
  updatedAt: number;
}

export function subscribeMonitoring(
  callback: (data: SensorReading | null) => void
) {
  if (!rtdb) return () => {};
  const sensorRef = ref(rtdb, "monitoring/latest");
  return onValue(sensorRef, (snap) => callback(snap.val()));
}
