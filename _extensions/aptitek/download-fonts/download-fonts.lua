-- =============================================================================
-- FONT REGISTRY (SINGLE SOURCE OF TRUTH FOR CDN FONTS)
-- To swap or add fonts in the future, simply update the table below!
-- =============================================================================
local GOOGLE_FONTS_REGISTRY = {
    "family=Arvo:ital,wght@0,400;0,700;1,400;1,700",
    "family=EB+Garamond:ital,wght@0,400..800;1,400..800",
    "family=Fira+Code:wght@300..700",
    "family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900",
    "family=Outfit:wght@300..800",
    "family=Pacifico",
    "family=Press+Start+2P",
    "family=Recursive:slnt,wght,CASL,CRSV,MONO@-15..0,300..1000,0..1,0..1,0..1"
}

function Meta(meta)
    if quarto.doc.is_format("html") then
        local fonts_query = table.concat(GOOGLE_FONTS_REGISTRY, "&")
        local fonts_url = "https://fonts.googleapis.com/css2?" .. fonts_query .. "&display=swap"

        local font_headers = pandoc.RawBlock("html", string.format([[
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="%s" rel="stylesheet">
]], fonts_url))

        if meta['header-includes'] == nil then
            meta['header-includes'] = pandoc.MetaList({font_headers})
        else
            local headers = meta['header-includes']
            if headers.t ~= 'MetaList' then
                headers = pandoc.MetaList({headers})
            end
            headers:insert(font_headers)
            meta['header-includes'] = headers
        end
    end

    local project_dir = os.getenv("QUARTO_PROJECT_DIR")
    if project_dir and quarto.doc.is_format("typst") then
        local fonts_dir = project_dir .. "/assets/fonts"
        if meta['font-paths'] == nil then
            meta['font-paths'] = pandoc.MetaList({pandoc.MetaString(fonts_dir)})
        else
            local fp = meta['font-paths']
            if fp.t ~= 'MetaList' then
                fp = pandoc.MetaList({fp})
            end
            fp[#fp + 1] = pandoc.MetaString(fonts_dir)
            meta['font-paths'] = fp
        end
    end

    return meta
end
