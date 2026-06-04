function Pandoc(doc)
    local project_dir = os.getenv("QUARTO_PROJECT_DIR")
    local script_path = "_extensions/aptitek/download-fonts/download_fonts.sh"
    
    if project_dir then
        script_path = project_dir .. "/" .. script_path
    end

    -- Execute the font download script
    os.execute("bash " .. script_path)

    -- If rendering for Typst, ensure font-paths is set correctly to project root fonts folder
    if project_dir and quarto.doc.is_format("typst") then
        local fonts_dir = project_dir .. "/fonts"
        if doc.meta['font-paths'] == nil then
            doc.meta['font-paths'] = pandoc.MetaList({pandoc.MetaString(fonts_dir)})
        else
            local fp = doc.meta['font-paths']
            -- If it's not already a list, convert it to one
            if fp.t ~= 'MetaList' then
                fp = pandoc.MetaList({fp})
            end
            -- Add the absolute path to the list
            fp[#fp + 1] = pandoc.MetaString(fonts_dir)
            doc.meta['font-paths'] = fp
        end
    end

    return doc
end
