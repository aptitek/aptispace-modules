function Pandoc(doc)
  if quarto.doc.is_format("html") then
    quarto.doc.add_html_dependency({
      name = 'timeline',
      version = '0.1.0',
      stylesheets = { 'timeline.css' },
      scripts = { 'timeline.js' }
    })
  end
  return doc
end

function Div(el)
  -- NOUVEAU BLOC : On n'intervient que si on génère un PDF avec Typst
  if quarto.doc.is_format("typst") then
    
    -- Si on trouve la div conteneur .timeline
    if el.classes:includes("timeline") then
      local new_content = pandoc.List()
      
      -- On parcourt les éléments à l'intérieur
      for _, block in ipairs(el.content) do
        
        -- Si c'est un jalon (.event)
        if block.t == "Div" and block.classes:includes("event") then
          local label = block.attributes["data-label"] or ""
          
          -- 1. On ouvre le bloc Typst. 
          -- Ça crée une bordure grise à gauche (la ligne) et place un rond noir dessus.
          local start_typst = '#block(stroke: (left: 2pt + luma(150)), inset: (left: 1.5em, bottom: 1.5em))[#place(left, dx: -1.5em - 4pt, dy: 0.2em, circle(radius: 4pt, fill: black))\n'
          
          -- Si on a une date (data-label), on l'ajoute en gras
          if label ~= "" then
            start_typst = start_typst .. '#text(weight: "bold")[' .. label .. ']\n\n'
          end
          
          -- On injecte ce code d'ouverture en Typst brut
          new_content:insert(pandoc.RawBlock('typst', start_typst))
          
          -- 2. On insère le contenu original du Markdown !
          -- C'est la magie de cette méthode : Pandoc va traduire vos images et textes normalement.
          for _, inner_block in ipairs(block.content) do
            new_content:insert(inner_block)
          end
          
          -- 3. On ferme le bloc Typst
          new_content:insert(pandoc.RawBlock('typst', '\n]\n'))
        
        else
          -- Si ce n'est pas un jalon, on garde l'élément tel quel
          new_content:insert(block)
        end
      end
      
      el.content = new_content
      return el
    end
  end
end