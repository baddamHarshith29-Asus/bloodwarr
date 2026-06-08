import shutil
import os

src_dir = r"C:\Users\bhars\.gemini\antigravity-ide\brain\eca6973a-38b5-404c-901c-b26d8b7ce636"
dst_dir = r"c:\Users\bhars\OneDrive\Desktop\aiwar\screenshots"

files_to_copy = {
    "request_center_1780931037874.png": "request_center.png",
    "biological_graph_1780931054628.png": "biological_graph.png",
    "donor_matching_1780931073345.png": "donor_matching.png",
    "outreach_studio_1780931096309.png": "outreach_studio.png",
    "donor_ai_chat_1780931109870.png": "donor_chat.png",
    "self_healing_protocol_1780931125444.png": "self_healing_protocol.png",
    "analytics_1780931140152.png": "analytics.png"
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
