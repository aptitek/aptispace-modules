function Link(el)
  if el.classes:includes('embed') then
    if quarto.doc.is_format('html') then
      -- HTML: Generate an iframe
      local url = el.target
      local title = pandoc.utils.stringify(el.content)
      
      -- We return a RawInline to avoid errors when the link is inside a paragraph.
      -- The CSS .ratio-embed will make it look like a block because it has width: 100% and limited height
      return pandoc.RawInline('html', '<div class="ratio-embed"><iframe src="' .. url .. '" title="' .. title .. '" allowfullscreen></iframe></div>')
    elseif quarto.doc.is_format('typst') then
      -- Typst: Keep as a link
      return el
    end
  end
end
