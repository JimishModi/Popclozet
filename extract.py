import os
import json
from pypdf import PdfReader

def extract_text(pdf_path):
    try:
        reader = PdfReader(pdf_path)
        text = ""
        for page in reader.pages:
            t = page.extract_text()
            if t:
                text += t + "\n"
        return text
    except Exception as e:
        print(f"Error reading {pdf_path}: {e}")
        return ""

if __name__ == "__main__":
    base_dir = r"c:\Users\welcome\Desktop\PopCLozet-Apps-main"
    terms_path = os.path.join(base_dir, "docs", "Terms & condition_popclozet.pdf")
    cookies_path = os.path.join(base_dir, "docs", "Cookies policy.pdf")

    terms_text = extract_text(terms_path)
    cookies_text = extract_text(cookies_path)

    out_dir = os.path.join(base_dir, "apps", "customer-app", "src", "constants")
    os.makedirs(out_dir, exist_ok=True)

    out_file = os.path.join(out_dir, "legalDocs.ts")
    with open(out_file, "w", encoding="utf-8") as f:
        f.write(f"export const TERMS_AND_CONDITIONS = {json.dumps(terms_text)};\n\n")
        f.write(f"export const COOKIE_POLICY = {json.dumps(cookies_text)};\n")

    print(f"Extraction successful: {out_file}")
