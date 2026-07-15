import {
  collection,
  getDocs,
  query,
  where,
  doc,
  addDoc,
  setDoc,
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
  description?: string; // penjelasan singkat item, tampil di kartu daftar harga
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
  /** Tautan ke kamera mitra/pengelola (id dokumen dari koleksi 'cameras') */
  cameraId?: string;
  /**
   * Snapshot kamera yang di-link, denormalisasi saat menyimpan destinasi.
   * Halaman publik /destinations/[id] memakai ini agar bisa menampilkan stream
   * tanpa membaca koleksi 'cameras' (yang privat). Kosong = tidak ada kamera.
   */
  cameraStreamId?: string; // = Camera.cameraId (id stream di server kamera)
  cameraName?: string;
  cameraStreamUrl?: string; // legacy: kamera lama dengan URL stream langsung
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

/** Daftar wilayah unik (non-kosong, terurut) dari destinasi — sumber pilihan wilayah pengelola & kamera. */
export function distinctLocations(destinations: Destination[]): string[] {
  return Array.from(
    new Set(destinations.map((d) => d.location).filter(Boolean))
  ).sort();
}

/**
 * Set id destinasi pada satu wilayah. Wilayah kosong/null → set kosong: TIDAK
 * boleh match global, supaya pengelola tanpa wilayah tidak melihat data siapa pun.
 */
export function destinationIdsInRegion(
  destinations: Destination[],
  region: string | null | undefined
): Set<string> {
  if (!region) return new Set();
  return new Set(
    destinations.filter((d) => d.location === region).map((d) => d.id)
  );
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
  /** Wilayah yang dikelola (khusus pengelola) — membatasi kamera & statistik ke wilayah ini. */
  location?: string;
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

/** Tetapkan wilayah kelola untuk pengelola. */
export async function updateUserLocation(uid: string, location: string) {
  if (!db) return;
  await updateDoc(doc(db, "users", uid), { location });
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
  cameraId: string; // ID stream dari server kamera (camera-server), dipaste user
  name: string; // nama tampilan, misal "Kamera Dermaga Bunaken"
  streamUrl?: string; // legacy: URL stream langsung, kamera lama sebelum server kamera
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

/**
 * Kamera pada satu wilayah (untuk pengelola). Jangan panggil dengan lokasi
 * kosong — itu akan match kamera berlokasi kosong; caller wajib guard dulu.
 */
export function subscribeCamerasByLocation(
  location: string,
  callback: (cameras: Camera[]) => void
) {
  if (!db) return () => {};
  const q = query(collection(db, "cameras"), where("location", "==", location));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Camera)));
  });
}

// ── Pengaturan server kamera ──
// Alamat server kamera lokal (camera-server) disimpan di Firestore supaya
// bisa diganti dari website saat WiFi/IP berubah — semua kamera mengikuti.

export function subscribeCameraServerUrl(callback: (url: string) => void) {
  if (!db) return () => {};
  return onSnapshot(doc(db, "settings", "cameraServer"), (snap) => {
    callback((snap.data()?.baseUrl as string | undefined) ?? "");
  });
}

export async function setCameraServerUrl(baseUrl: string) {
  if (!db) return;
  await setDoc(doc(db, "settings", "cameraServer"), {
    baseUrl,
    updatedAt: serverTimestamp(),
  });
}

/** URL stream final: server kamera + ID. Kamera lama tetap pakai streamUrl langsung. */
export function resolveStreamUrl(camera: Camera, serverBaseUrl: string): string {
  if (camera.streamUrl) return camera.streamUrl;
  if (!serverBaseUrl) return "";
  return `${serverBaseUrl.replace(/\/+$/, "")}/stream/${camera.cameraId}`;
}

/**
 * URL statistik/riwayat deteksi per-kamera pada server gabungan
 * (kamera_deteksi.py). Kamera lama yang memakai streamUrl langsung tidak punya
 * endpoint ini → kembalikan string kosong agar panel deteksi disembunyikan.
 */
export function resolveDetectionUrl(
  camera: Camera,
  serverBaseUrl: string,
  kind: "stats" | "history",
): string {
  if (camera.streamUrl || !serverBaseUrl) return "";
  return `${serverBaseUrl.replace(/\/+$/, "")}/${kind}/${camera.cameraId}`;
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
