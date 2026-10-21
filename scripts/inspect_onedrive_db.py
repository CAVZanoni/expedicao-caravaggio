import sqlite3
import shutil
import os

db_path = r'C:\Users\cesar\AppData\Local\Microsoft\OneDrive\settings\Personal\SyncEngineDatabase.db'
temp_db = 'temp_onedrive_sync.db'

# Copiar temporariamente para não ter conflito de lock
shutil.copy2(db_path, temp_db)

conn = sqlite3.connect(temp_db)
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = [r[0] for r in cursor.fetchall()]
print("Tabelas encontradas:", tables[:15])

# Procurar tabelas com 'item' ou 'file'
for t in tables:
    if any(k in t.lower() for k in ['item', 'file', 'sync', 'resource']):
        cursor.execute(f"PRAGMA table_info({t});")
        cols = [c[1] for c in cursor.fetchall()]
        print(f"\nTabela: {t} -> Colunas: {cols[:10]}")
        
        # Testar se tem coluna fileName ou similar
        name_col = next((c for c in cols if 'name' in c.lower() or 'path' in c.lower()), None)
        if name_col:
            cursor.execute(f"SELECT * FROM {t} WHERE {name_col} LIKE '%DJI%' LIMIT 3;")
            rows = cursor.fetchall()
            if rows:
                print(f"  Encontrado DJI em {t}!")
                print("  Exemplo:", rows[0])

conn.close()
if os.path.exists(temp_db):
    os.remove(temp_db)
