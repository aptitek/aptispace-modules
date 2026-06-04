--[[
  tabs.lua  —  Quarto/Pandoc Lua filter
  =====================================
  Converts a Div with class `.tabs` or `.bootstrap-tabs` into a Bootstrap Tabset.
  Tab items are defined by headers (e.g., H5) inside the Div.
  Supports aligning tabs to the left/right and embedding custom controls (e.g. search bars).
--]]

local tab_counter = 0

-- Helper function to check if a list of classes contains control keywords
local function is_control_header(classes)
  for _, cls in ipairs(classes) do
    if cls == 'searchbar' or cls == 'search-bar' or cls == 'control' or
       cls == 'btn' or cls == 'button' or cls == 'slider' or
       cls == 'number' or cls == 'label' or cls == 'no-pane' then
      return true
    end
  end
  return false
end

function Div(el)
  if el.classes:includes('tabs') or el.classes:includes('bootstrap-tabs') then
    -- 1. Find the header level to use as tab demarcators
    local header_level = nil
    for _, block in ipairs(el.content) do
      if block.t == 'Header' then
        header_level = block.level
        break
      end
    end
    
    if not header_level then
      return el -- No tab headers found, return unmodified
    end
    
    -- 2. Group block contents by tabs
    local tabs = {}
    local current_tab = nil
    
    for _, block in ipairs(el.content) do
      if block.t == 'Header' and block.level == header_level then
        -- Initialize a new tab structure
        current_tab = {
          header = block,
          content = {},
          is_control = is_control_header(block.classes),
          align = 'left'
        }
        
        -- Detect right/left alignment classes
        if block.classes:includes('tab-right') or block.classes:includes('right-tab') then
          current_tab.align = 'right'
        elseif block.classes:includes('tab-left') or block.classes:includes('left-tab') then
          current_tab.align = 'left'
        end
        
        table.insert(tabs, current_tab)
      else
        -- Collect blocks under the active tab
        if current_tab then
          table.insert(current_tab.content, block)
        end
      end
    end
    
    -- If no tabs were parsed, return unmodified
    if #tabs == 0 then
      return el
    end
    
    -- 3. Construct the Bootstrap Tabset HTML structure
    local nav_items = {}
    local tab_panes = {}
    local seen_right = false
    local first_pane = true
    
    for _, tab in ipairs(tabs) do
      tab_counter = tab_counter + 1
      local tab_id = "custom-tab-" .. tab_counter
      
      -- Compile alignment classes for the nav-item list wrapper
      local li_classes = { "nav-item" }
      if tab.align == 'right' and not seen_right then
        table.insert(li_classes, "ms-auto")
        seen_right = true -- ms-auto pushes all subsequent right-aligned tabs
      end
      
      local title_inlines = tab.header.content
      
      if tab.is_control then
        -- Case A: Control Tab (Searchbars, Sliders, Buttons)
        -- Wrap the header inlines in a Span carrying all its classes
        local span_node = pandoc.Span(title_inlines, tab.header.attr)
        
        local li_html_start = string.format('<li class="%s d-flex align-items-center px-2">', table.concat(li_classes, " "))
        
        table.insert(nav_items, pandoc.RawInline('html', li_html_start))
        table.insert(nav_items, span_node)
        table.insert(nav_items, pandoc.RawInline('html', '</li>'))
      else
        -- Case B: Standard Pane Tab
        local active_class = ""
        local selected_attr = "false"
        if first_pane then
          active_class = " active"
          selected_attr = "true"
        end
        
        local button_html = string.format(
          '<li class="%s"><button class="nav-link%s" id="%s-tab" data-bs-toggle="tab" data-bs-target="#%s" type="button" role="tab" aria-controls="%s" aria-selected="%s">',
          table.concat(li_classes, " "),
          active_class,
          tab_id,
          tab_id,
          tab_id,
          selected_attr
        )
        
        table.insert(nav_items, pandoc.RawInline('html', button_html))
        for _, inl in ipairs(title_inlines) do
          table.insert(nav_items, inl)
        end
        table.insert(nav_items, pandoc.RawInline('html', '</button></li>'))
        
        -- Build the matching tab pane
        local pane_active_class = ""
        if first_pane then
          pane_active_class = " show active"
          first_pane = false
        end
        
        local pane_start_html = string.format(
          '<div class="tab-pane fade%s" id="%s" role="tabpanel" aria-labelledby="%s-tab">',
          pane_active_class,
          tab_id,
          tab_id
        )
        
        table.insert(tab_panes, pandoc.RawBlock('html', pane_start_html))
        for _, b in ipairs(tab.content) do
          table.insert(tab_panes, b)
        end
        table.insert(tab_panes, pandoc.RawBlock('html', '</div>'))
      end
    end
    
    -- Assemble components
    local ul_start = pandoc.RawBlock('html', '<ul class="nav nav-tabs d-flex align-items-center" id="tabs-' .. tab_counter .. '" role="tablist">')
    local ul_content = pandoc.Plain(nav_items)
    local ul_end = pandoc.RawBlock('html', '</ul>')
    
    local content_start = pandoc.RawBlock('html', '<div class="tab-content mt-3" id="tab-content-' .. tab_counter .. '">')
    local content_end = pandoc.RawBlock('html', '</div>')
    
    local final_blocks = {
      ul_start,
      ul_content,
      ul_end,
      content_start
    }
    
    for _, pane_block in ipairs(tab_panes) do
      table.insert(final_blocks, pane_block)
    end
    table.insert(final_blocks, content_end)
    
    return pandoc.Div(final_blocks, {class = "tabset-container"})
  end
end
