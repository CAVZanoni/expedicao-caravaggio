with open('components/Map.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

idx1 = code.find('  // Renderizar Rotas GPX (Trajetos)')
idx2 = code.find('  // Renderizar Marcadores de Mídia (Miniaturas Circulares)')
print(code[idx1:idx2])
