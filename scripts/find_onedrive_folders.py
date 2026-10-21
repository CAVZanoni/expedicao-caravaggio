import sqlite3
import shutil
import os

db_path = r'C:\Users\cesar\AppData\Local\Microsoft\OneDrive\settings\Personal\SyncEngineDatabase.db'
temp_db = 'temp_check_folder.db'
shutil.copy2(db_path, temp_db)

conn = sqlite3.connect(temp_db)
cursor = conn.cursor()

cursor.execute("SELECT resourceID, folderName, parentResourceID FROM od_ClientFolder_Records WHERE folderName LIKE '%CARAVAGGIO%' OR folderName LIKE '%DRONE%' OR folderName LIKE '%D1%'")
rows = cursor.fetchall()
print("Pastas encontradas no banco OneDrive:")
for r in rows:
    print(f"  Folder: {r[1]} -> resourceID: {r[0]} -> parent: {r[2]}")

conn.close()
if os.path.exists(temp_db):
    os.remove(temp_db)
