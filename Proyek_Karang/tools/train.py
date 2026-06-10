from ultralytics import YOLO

if __name__ == '__main__':
    # Load model dasar (Nano version agar ringan)
    model = YOLO('yolov8n.pt') 

    # Mulai belajar
    model.train(
        data='data.yaml', 
        epochs=50, 
        imgsz=640, 
        device='cpu' # Ganti ke 0 jika punya GPU Nvidia
    )