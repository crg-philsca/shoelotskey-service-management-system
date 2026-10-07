import sys, os
sys.path.insert(0, 'backend')
from dotenv import load_dotenv
load_dotenv('backend/.env')
from google import genai

client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))
for m in ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.7-flash', 'gemini-3.8-flash']:
    try:
        r = client.models.generate_content(model=m, contents='Hi')
        print(f"SUCCESS with {m}: {r.text.strip()}")
        break
    except Exception as e:
        print(f"FAILED with {m}: {e}")
