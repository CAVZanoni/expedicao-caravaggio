with open('components/Map.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Substituir o bloco do marker
text_norm = text.replace('\r\n', '\n')

search_str = """      el.className = 'marker-pin relative group cursor-pointer';

      const isDrone = m.tipo === 'video_drone';
      const isPrivate = m.is_private;

      el.innerHTML = `
        <div class="w-10 h-10 rounded-full overflow-hidden border-2 shadow-xl bg-slate-900 transition-transform ${
          isDrone
            ? 'border-red-500 ring-2 ring-red-500/30'
            : isPrivate
            ? 'border-amber-400 ring-2 ring-amber-400/30'
            : 'border-white'
        }">
          <img src="${m.url_thumbnail || m.url_midia}" alt="${m.titulo || ''}" class="w-full h-full object-cover select-none pointer-events-none" />
        </div>
        ${
          isDrone
            ? `<div class="absolute -bottom-1 -right-1 bg-red-600 text-white rounded-full p-1 shadow-md">
                 <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
               </div>`
            : ''
        }
        ${
          isPrivate
            ? `<div class="absolute -top-1 -right-1 bg-amber-500 text-slate-950 rounded-full p-1 shadow-md">
                 <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17a2 2 0 100-4 2 2 0 000 4zm6-9a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V10a2 2 0 012-2h1V6a5 5 0 0110 0v2h1zm-6-5a3 3 0 00-3 3v2h6V6a3 3 0 00-3-3z"/></svg>
               </div>`
            : ''
        }
      `;

      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        onSelectMidia(m);
      });

      const marker = new maplibregl.Marker({
        element: el,
        draggable: isAdmin,
      })"""

replace_str = """      el.className = 'marker-pin relative cursor-pointer';

      const isDrone = m.tipo === 'video_drone';
      const isPrivate = m.is_private;

      el.innerHTML = `
        <div class="marker-card relative">
          <div class="w-10 h-10 rounded-full overflow-hidden border-2 shadow-xl bg-slate-900 ${
            isDrone
              ? 'border-red-500 ring-2 ring-red-500/30'
              : isPrivate
              ? 'border-amber-400 ring-2 ring-amber-400/30'
              : 'border-white'
          }">
            <img src="${m.url_thumbnail || m.url_midia}" alt="${m.titulo || ''}" class="w-full h-full object-cover select-none pointer-events-none" />
          </div>
          ${
            isDrone
              ? `<div class="absolute -bottom-1 -right-1 bg-red-600 text-white rounded-full p-1 shadow-md">
                   <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                 </div>`
              : ''
          }
          ${
            isPrivate
              ? `<div class="absolute -top-1 -right-1 bg-amber-500 text-slate-950 rounded-full p-1 shadow-md">
                   <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17a2 2 0 100-4 2 2 0 000 4zm6-9a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V10a2 2 0 012-2h1V6a5 5 0 0110 0v2h1zm-6-5a3 3 0 00-3 3v2h6V6a3 3 0 00-3-3z"/></svg>
                 </div>`
              : ''
          }
        </div>
      `;

      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        onSelectMidia(m);
      });

      const marker = new maplibregl.Marker({
        element: el,
        anchor: 'center',
        draggable: isAdmin,
      })"""

if search_str in text_norm:
    text_norm = text_norm.replace(search_str, replace_str)
    with open('components/Map.tsx', 'w', encoding='utf-8') as f:
        f.write(text_norm)
    print("Sucesso!")
else:
    print("Trecho não encontrado.")
