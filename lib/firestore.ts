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

export interface PriceItem {
  id: string; // key React & edit admin — crypto.randomUUID()
  label: string; // "Tiket Masuk", "Penginapan", "Sewa Alat Diving", ...
  price: number; // rupiah, >= 0
  unit: string; // "/pax", "/malam", "/set" — teks bebas
}

export interface Destination {
  id: string;
  name: string;
  location: string;
  emoji: string;
  thumbColor: string;
  tags: string[];
  /** Legacy — harga tunggal lama; hanya dipakai sebagai fallback getPriceItems. */
  priceStart?: number;
  /** Daftar harga multi-item (tiket, penginapan, sewa alat, ...). */
  priceItems?: PriceItem[];
  description: string;
  image: string;
  /** True hanya untuk destinasi yang punya stasiun sensor IoT fisik. */
  hasMonitoring?: boolean;
}

export type DestinationInput = Omit<Destination, "id">;

/**
 * Sumber kebenaran daftar harga. priceItems yang sudah ada dikembalikan apa
 * adanya — array kosong berarti sengaja tanpa harga. Fallback priceStart
 * hanya untuk dokumen legacy yang belum pernah disimpan editor baru, agar
 * tetap bisa tampil & dibooking tanpa migrasi manual.
 */
export function getPriceItems(dest: Destination): PriceItem[] {
  if (dest.priceItems) return dest.priceItems;
  if (dest.priceStart && dest.priceStart > 0) {
    return [{ id: "legacy", label: "Tiket Masuk", price: dest.priceStart, unit: "/pax" }];
  }
  return [];
}

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

export interface MitraVerification {
  fullName: string; // nama lengkap penanggung jawab
  phone: string; // no. HP/WhatsApp aktif
  organization: string; // instansi/organisasi (operator dive, resort, ...)
  status: "pending" | "approved" | "rejected";
  submittedAt: unknown;
  reviewedAt?: unknown;
}

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  role: "user" | "mitra" | "pengelola" | "admin";
  /** Pengajuan verifikasi mitra; tidak ada berarti belum pernah mengajukan. */
  verification?: MitraVerification;
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

export async function submitMitraVerification(
  uid: string,
  data: { fullName: string; phone: string; organization: string }
) {
  if (!db) return;
  await updateDoc(doc(db, "users", uid), {
    verification: { ...data, status: "pending", submittedAt: serverTimestamp() },
  });
}

export async function approveMitra(uid: string) {
  if (!db) return;
  await updateDoc(doc(db, "users", uid), {
    role: "mitra",
    "verification.status": "approved",
    "verification.reviewedAt": serverTimestamp(),
  });
}

export async function rejectMitra(uid: string) {
  if (!db) return;
  await updateDoc(doc(db, "users", uid), {
    "verification.status": "rejected",
    "verification.reviewedAt": serverTimestamp(),
  });
}

// ── Cameras (kamera mitra — terpisah dari monitoring IoT) ──

export interface Camera {
  id: string; // Firestore doc id
  cameraId: string; // ID perangkat yang diisi user, unik per pemilik
  name: string; // nama tampilan, misal "Kamera Dermaga Bunaken"
  streamUrl: string; // URL stream langsung (MJPEG/HTTP), wajib http(s)://
  location: string; // lokasi pemasangan, boleh string kosong
  ownerUid: string;
  ownerName: string; // snapshot nama pemilik saat dibuat (untuk panel admin)
  ownerEmail: string; // snapshot email pemilik saat dibuat
  createdAt: unknown;
}

export type CameraInput = Omit<Camera, "id" | "createdAt">;

/** Mitra ke atas boleh mengelola kamera; pengelola & admin tanpa verifikasi. */
export function canManageCameras(role: string | null | undefined): boolean {
  return role === "mitra" || role === "pengelola" || role === "admin";
}

export async function addCamera(data: CameraInput) {
  if (!db) return;
  await addDoc(collection(db, "cameras"), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function deleteCamera(id: string) {
  if (!db) return;
  await deleteDoc(doc(db, "cameras", id));
}

export function subscribeMyCameras(
  uid: string,
  callback: (cameras: Camera[]) => void
) {
  if (!db) return () => {};
  const q = query(collection(db, "cameras"), where("ownerUid", "==", uid));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Camera)));
  });
}

export function subscribeAllCameras(callback: (cameras: Camera[]) => void) {
  if (!db) return () => {};
  return onSnapshot(collection(db, "cameras"), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Camera)));
  });
}

// ── Bookings ──

export interface BookingItem {
  label: string;
  price: number;
  qty: number;
}

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
  /** Snapshot rincian item yang dipilih saat booking dibuat. */
  items?: BookingItem[];
  status: "pending" | "confirmed" | "cancelled" | "used";
  createdAt: unknown;
  checkedInAt?: unknown;
  amount?: number;
  paymentStatus?: "unpaid" | "paid";
  paymentMethod?: string;
  paidAt?: unknown;
}

export type BookingInput = Omit<
  Booking,
  "id" | "status" | "createdAt" | "checkedInAt" | "paymentStatus" | "paymentMethod" | "paidAt"
>;

export async function createBooking(data: BookingInput) {
  if (!db) return;
  await addDoc(collection(db, "bookings"), {
    ...data,
    items: data.items ?? [],
    amount: data.amount ?? 0,
    status: "confirmed",
    paymentStatus: "unpaid",
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

/** Tandai booking sebagai lunas (mock — tanpa gateway). Dijalankan oleh pemilik booking. */
export async function payBooking(id: string, method: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, "bookings", id), {
    paymentStatus: "paid",
    paymentMethod: method,
    paidAt: serverTimestamp(),
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
