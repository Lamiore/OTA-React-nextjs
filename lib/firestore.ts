import {
  collection,
  getDocs,
  query,
  where,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./firebase";

// ── Destinations ──

export interface Destination {
  id: string;
  name: string;
  location: string;
  emoji: string;
  thumbColor: string;
  tags: string[];
  priceStart: number;
  description: string;
  image: string;
}

export type DestinationInput = Omit<Destination, "id">;

export async function getDestinations(filter?: string): Promise<Destination[]> {
  if (!db) return [];
  const ref = collection(db, "destinations");
  const q =
    filter && filter !== "Semua"
      ? query(ref, where("location", "==", filter))
      : ref;

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Destination));
}

export function subscribeDestinations(
  callback: (destinations: Destination[]) => void
) {
  if (!db) return () => {};
  const ref = collection(db, "destinations");
  return onSnapshot(ref, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Destination)));
  });
}

export async function addDestination(data: DestinationInput) {
  if (!db) return;
  await addDoc(collection(db, "destinations"), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function updateDestination(id: string, data: Partial<DestinationInput>) {
  if (!db) return;
  await updateDoc(doc(db, "destinations", id), data);
}

export async function deleteDestination(id: string) {
  if (!db) return;
  await deleteDoc(doc(db, "destinations", id));
}

// ── Users ──

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  role: "user" | "pengelola" | "admin";
}

export function subscribeUsers(callback: (users: AppUser[]) => void) {
  if (!db) return () => {};
  const ref = collection(db, "users");
  return onSnapshot(ref, (snap) => {
    callback(
      snap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser))
    );
  });
}

export async function updateUserRole(uid: string, role: AppUser["role"]) {
  if (!db) return;
  await updateDoc(doc(db, "users", uid), { role });
}

// ── Bookings ──

export interface Booking {
  id: string;
  userId: string;
  destinationId: string;
  destinationName: string;
  date: string;
  guests: number;
  name: string;
  phone: string;
  notes: string;
  status: "pending" | "confirmed" | "cancelled" | "used";
  createdAt: unknown;
  checkedInAt?: unknown;
}

export type BookingInput = Omit<Booking, "id" | "status" | "createdAt" | "checkedInAt">;

export async function createBooking(data: BookingInput) {
  if (!db) return;
  await addDoc(collection(db, "bookings"), {
    ...data,
    status: "confirmed",
    createdAt: serverTimestamp(),
  });
}

export async function updateBookingStatus(id: string, status: Booking["status"]) {
  if (!db) return;
  await updateDoc(doc(db, "bookings", id), { status });
}

export type CheckInOutcome = "success" | "already-used" | "cancelled" | "notfound";

/**
 * Check-in tiket secara transaksional: baca ulang status di dalam transaksi dan
 * hanya tandai 'used' bila tiket masih valid (confirmed/pending). Mencegah double
 * check-in / race antar petugas, dan memberi alasan jelas saat gagal.
 */
export async function checkInBooking(id: string): Promise<CheckInOutcome> {
  if (!db) return "notfound";
  const ref = doc(db, "bookings", id);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return "notfound";
    const status = snap.data()?.status as Booking["status"] | undefined;
    if (status === "used") return "already-used";
    if (status === "cancelled") return "cancelled";
    tx.update(ref, { status: "used", checkedInAt: serverTimestamp() });
    return "success";
  });
}

// ── Monitoring ──

export function subscribeSensor(
  docId: string,
  callback: (data: DocumentData | undefined) => void
) {
  if (!db) return () => {};
  const docRef = doc(db, "monitoring_data", docId);
  return onSnapshot(docRef, (snap) => callback(snap.data()));
}
