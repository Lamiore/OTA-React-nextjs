import albumentations as A
import cv2
import os
import glob

# --- KONFIGURASI ---
# Kita akan membuat 100 variasi dari setiap 1 foto asli
JUMLAH_VARIASI = 100 

# Definisi transformasi untuk simulasi kondisi bawah laut
transform = A.Compose([
    A.HorizontalFlip(p=0.5),
    A.RandomRotate90(p=0.5),
    A.RandomBrightnessContrast(brightness_limit=0.2, contrast_limit=0.2, p=0.8),
    A.HueSaturationValue(hue_shift_limit=20, sat_shift_limit=30, val_shift_limit=20, p=0.5),
    A.GaussNoise(var_limit=(10, 50), p=0.3),
    A.Blur(blur_limit=3, p=0.3),
], bbox_params=A.BboxParams(format='yolo', label_fields=['class_labels']))

# Path Folder
image_path = 'dataset/images/'
label_path = 'dataset/labels/'
output_img = 'aug_dataset/images/'
output_lab = 'aug_dataset/labels/'

# Buat folder output jika belum ada
os.makedirs(output_img, exist_ok=True)
os.makedirs(output_lab, exist_ok=True)

# Proses Augmentasi
images = glob.glob(os.path.join(image_path, "*.jpg"))

if len(images) == 0:
    print("❌ ERROR: Tidak ada foto .jpg di folder dataset/images/")
else:
    print(f"🔄 Memulai augmentasi untuk {len(images)} foto...")
    
    for img_file in images:
        filename = os.path.basename(img_file).split('.')[0]
        image = cv2.imread(img_file)
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Cari file label .txt yang sesuai
        txt_file = os.path.join(label_path, f"{filename}.txt")
        if not os.path.exists(txt_file):
            print(f"⚠️ Skip {filename}: File label .txt tidak ditemukan!")
            continue

        # Baca isi label YOLO
        with open(txt_file, 'r') as f:
            bboxes = [list(map(float, line.split())) for line in f.readlines()]
        
        class_labels = [int(b[0]) for b in bboxes]
        yolo_bboxes = [b[1:] for b in bboxes]

        # Generate variasi foto
        for i in range(JUMLAH_VARIASI):
            transformed = transform(image=image, bboxes=yolo_bboxes, class_labels=class_labels)
            
            new_name = f"{filename}_aug_{i}"
            
            # Simpan Foto Baru
            cv2.imwrite(os.path.join(output_img, f"{new_name}.jpg"), 
                        cv2.cvtColor(transformed['image'], cv2.COLOR_RGB2BGR))
            
            # Simpan Label Baru
            with open(os.path.join(output_lab, f"{new_name}.txt"), 'w') as f:
                for j, bbox in enumerate(transformed['bboxes']):
                    f.write(f"{class_labels[j]} {' '.join(map(str, bbox))}\n")
    
    print("✅ SELESAI! Silakan cek folder 'aug_dataset'.")