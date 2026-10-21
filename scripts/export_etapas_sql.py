import json
import os

with open("data/expedicao.json", "r", encoding="utf-8") as f:
    data = json.load(f)

os.makedirs("data/sql", exist_ok=True)

for etapa in data["etapas"]:
    dia = etapa["numero_dia"]
    sql = f"""
    INSERT INTO public.etapas (
        numero_dia, data, titulo, cidade_origem, cidade_destino,
        distancia_km, altimetria_ganho, altimetria_perda,
        alt_min, alt_max, duracao_segundos,
        geojson_rota, perfil_altimetria, bounds
    ) VALUES (
        {dia},
        '{etapa["data"]}',
        '{etapa["titulo"].replace("'", "''")}',
        '{etapa["cidade_origem"].replace("'", "''")}',
        '{etapa["cidade_destino"].replace("'", "''")}',
        {etapa["distancia_km"]},
        {etapa["altimetria_ganho"]},
        {etapa["altimetria_perda"]},
        {etapa["alt_min"]},
        {etapa["alt_max"]},
        {etapa["duracao_segundos"]},
        '{json.dumps(etapa["geojson"], ensure_ascii=False).replace("'", "''")}'::jsonb,
        '{json.dumps(etapa["perfil_altimetria"], ensure_ascii=False).replace("'", "''")}'::jsonb,
        '{json.dumps(etapa["bounds"], ensure_ascii=False).replace("'", "''")}'::jsonb
    )
    ON CONFLICT (numero_dia) DO UPDATE SET
        titulo = EXCLUDED.titulo,
        distancia_km = EXCLUDED.distancia_km,
        altimetria_ganho = EXCLUDED.altimetria_ganho,
        altimetria_perda = EXCLUDED.altimetria_perda,
        geojson_rota = EXCLUDED.geojson_rota,
        perfil_altimetria = EXCLUDED.perfil_altimetria,
        bounds = EXCLUDED.bounds;
    """
    with open(f"data/sql/dia_{dia}.sql", "w", encoding="utf-8") as out:
        out.write(sql.strip())
    print(f"Gerado data/sql/dia_{dia}.sql ({len(sql)} chars)")
