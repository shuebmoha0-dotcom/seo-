import zipfile
import os

def build_zip():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    output_dir = os.path.join(base_dir, 'public', 'downloads')
    os.makedirs(output_dir, exist_ok=True)
    
    zip_path = os.path.join(output_dir, 'seo-autopilot-connector.zip')
    src_dir = os.path.join(base_dir, 'wordpress-plugin', 'seo-autopilot-connector')
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(src_dir):
            for file in files:
                full_path = os.path.join(root, file)
                # Create standard forward-slash entry relative to wordpress-plugin
                rel_path = os.path.relpath(full_path, os.path.join(base_dir, 'wordpress-plugin'))
                zip_entry = rel_path.replace('\\', '/')
                zipf.write(full_path, zip_entry)
                print(f"Added entry: {zip_entry}")
                
    print(f"Successfully generated clean plugin zip at {zip_path}")

if __name__ == '__main__':
    build_zip()
