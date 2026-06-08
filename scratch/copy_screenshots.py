import shutil
import os

src_dir = r"C:\Users\bhars\.gemini\antigravity-ide\brain\eca6973a-38b5-404c-901c-b26d8b7ce636"
dst_dir = r"c:\Users\bhars\OneDrive\Desktop\aiwar\screenshots"

files_to_copy = {
    "dashboard_1780929491960.png": "dashboard.png",
    "patient_management_1780929506602.png": "patient_management.png",
    "donor_management_1780929519159.png": "donor_management.png",
    "aws_insights_1780929530899.png": "aws_insights.png",
    "prediction_center_1780929542976.png": "prediction_center.png"
}

os.makedirs(dst_dir, exist_ok=True)

for src_name, dst_name in files_to_copy.items():
    src_path = os.path.join(src_dir, src_name)
    dst_path = os.path.join(dst_dir, dst_name)
    if os.path.exists(src_path):
        print(f"Copying {src_path} -> {dst_path}")
        shutil.copy(src_path, dst_path)
    else:
        print(f"Source file not found: {src_path}")

print("Done!")
