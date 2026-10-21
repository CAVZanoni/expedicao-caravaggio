import sqlite3
import shutil
import os

db_path = r'C:\Users\cesar\AppData\Local\Microsoft\OneDrive\settings\Personal\SyncEngineDatabase.db'
temp_db = 'temp_onedrive_caravaggio.db'
shutil.copy2(db_path, temp_db)

conn = sqlite3.connect(temp_db)
cursor = conn.cursor()

cursor.execute("""
SELECT resourceID, parentResourceID, fileName, size 
FROM od_ClientFile_Records 
WHERE fileName LIKE '%DJI_202610%' AND fileName LIKE '%.MP4'
LIMIT 20;
""")

rows = cursor.fetchall()
print(f"Total de vídeos MP4 de outubro encontrados no banco do OneDrive: {len(rows)}")
for r in rows:
    print(f"File: {r[2]} -> resourceID: {r[0]} -> parent: {r[1]} -> size: {r[3]}")

conn.close()
if os.path.exists(temp_db):
    os.remove(temp_db)
