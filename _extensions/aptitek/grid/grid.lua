--[[
  grid.lua  —  Quarto/Pandoc Lua filter
  =====================================
  Automatically converts markdown tables or divs with class `.grid` or `.bootstrap-grid`
  into standard responsive Bootstrap grid structures (`row` and `col-md-*` columns).
--]]

-- Helper function to check if a class starts with a prefix
local function has_prefix(str, prefix)
  return string.sub(str, 1, string.len(prefix)) == prefix
end

-- Parse a Pandoc Table element and return a list of Div rows with column children
local function parse_table_to_grid(tbl)
  local rows = {}
  
  -- Extract cells from modern Pandoc Table (Pandoc 2.11+)
  if tbl.bodies then
    for _, body in ipairs(tbl.bodies) do
      -- Fallback chain for rows list: body.body (standard), body.body_rows, body.rows
      local body_rows = body.body or body.body_rows or body.rows or {}
      for _, row in ipairs(body_rows) do
        local row_cells = {}
        -- Fallback chain for cells list: row.cells (standard), row.content
        local cells = row.cells or row.content or {}
        for _, cell in ipairs(cells) do
          table.insert(row_cells, cell.content or cell)
        end
        table.insert(rows, row_cells)
      end
    end
  -- Extract cells from legacy compatibility Pandoc Table
  elseif tbl.rows then
    for _, row in ipairs(tbl.rows) do
      local row_cells = {}
      for _, cell in ipairs(row) do
        table.insert(row_cells, cell.content or cell)
      end
      table.insert(rows, row_cells)
    end
  end
  
  local grid_blocks = {}
  
  for _, row in ipairs(rows) do
    local num_cells = #row
    if num_cells > 0 then
      local col_class = "col-md"
      -- Equal distribution of columns
      if 12 % num_cells == 0 then
        col_class = "col-md-" .. string.format("%d", 12 / num_cells)
      end
      
      local row_content = {}
      for _, cell_blocks in ipairs(row) do
        table.insert(row_content, pandoc.Div(cell_blocks, {class = col_class}))
      end
      
      table.insert(grid_blocks, pandoc.Div(row_content, {class = "row mb-3"}))
    end
  end
  
  return pandoc.Div(grid_blocks, {class = "container-fluid px-0"})
end

-- ── Div handler ───────────────────────────────────────────────────────────────
-- Converts a flat list of child divs/blocks or a wrapped table into a Bootstrap grid.
function Div(el)
  -- Case 1: Simple auto-balanced grid system (row with col children)
  if el.classes:includes('row') then
    -- Translate semantic attributes on .row into Bootstrap utility classes:
    --   gap=N   → g-N   (Bootstrap gutter)
    --   align=center/start/end → align-items-{value}
    --   mb=N    → mb-N
    --   mt=N    → mt-N
    for _, attr in ipairs({"gap", "mb", "mt"}) do
      local val = el.attributes[attr]
      if val then
        local prefix = attr == "gap" and "g-" or (attr .. "-")
        el.classes:insert(prefix .. val)
        el.attributes[attr] = nil
      end
    end
    local align = el.attributes["align"]
    if align then
      el.classes:insert("align-items-" .. align)
      el.attributes["align"] = nil
    end

    -- Find all direct children that are Divs with class 'col'
    local cols = {}
    for _, child in ipairs(el.content) do
      if child.t == 'Div' and child.classes:includes('col') then
        table.insert(cols, child)
      end
    end

    local num_cols = #cols
    if num_cols > 0 then
      -- Automatically map column count to standard Bootstrap classes:
      -- 1 column: col-12
      -- 2 columns: col-12 col-md-6 (50% each)
      -- 3 columns: col-12 col-md-4 (33% each)
      -- 4 columns: col-12 col-md-6 (2x2 grid is best for concept cards)
      -- >=5 columns: col-12 col-md-4 col-lg-3
      local default_col_class = "col-12"
      if num_cols == 2 then
        default_col_class = "col-12 col-md-6"
      elseif num_cols == 3 then
        default_col_class = "col-12 col-md-4"
      elseif num_cols == 4 then
        default_col_class = "col-12 col-md-6"
      elseif num_cols >= 5 then
        default_col_class = "col-12 col-md-4 col-lg-3"
      end

      -- Replace simple 'col' class with Bootstrap responsive class definitions.
      -- span=N    → col-12 col-md-N  (md breakpoint asymmetric column)
      -- span-lg=N → col-12 col-lg-N  (lg breakpoint asymmetric column)
      for _, col_div in ipairs(cols) do
        local span = col_div.attributes["span"]
        local span_lg = col_div.attributes["span-lg"]
        local col_class
        if span then
          col_class = "col-12 col-md-" .. span
          col_div.attributes["span"] = nil
        elseif span_lg then
          col_class = "col-12 col-lg-" .. span_lg
          col_div.attributes["span-lg"] = nil
        else
          col_class = default_col_class
        end

        -- Translate mb=N / mt=N attributes on individual cols
        for _, attr in ipairs({"mb", "mt"}) do
          local val = col_div.attributes[attr]
          if val then
            col_div.classes:insert(attr .. "-" .. val)
            col_div.attributes[attr] = nil
          end
        end

        local new_classes = {}
        for _, cls in ipairs(col_div.classes) do
          if cls ~= "col" then
            table.insert(new_classes, cls)
          end
        end
        for word in string.gmatch(col_class, "%S+") do
          table.insert(new_classes, word)
        end
        col_div.classes = new_classes
      end
    end

    return el
  end

  -- Case 2: Legacy .grid and .bootstrap-grid handlers
  if el.classes:includes('bootstrap-grid') or el.classes:includes('grid') then
    -- Check if the Div contains a Table. If so, convert the table into a grid.
    for _, child in ipairs(el.content) do
      if child.t == 'Table' then
        return parse_table_to_grid(child)
      end
    end
    
    local has_row = false
    for _, child in ipairs(el.content) do
      if child.t == 'Div' and child.classes:includes('row') then
        has_row = true
        break
      end
    end
    
    if not has_row then
      local cols = {}
      local num_children = #el.content
      local col_class = "col-md"
      
      -- Calculate default equal-width column sizes if they divide cleanly
      if num_children > 0 and 12 % num_children == 0 then
        col_class = "col-md-" .. string.format("%d", 12 / num_children)
      end
      
      for _, child in ipairs(el.content) do
        local is_col = false
        if child.t == 'Div' then
          -- Translate any g-col-* classes to col-*
          local translated_classes = {}
          for _, cls in ipairs(child.classes) do
            if has_prefix(cls, "g-col-") then
              table.insert(translated_classes, string.sub(cls, 3))
            else
              table.insert(translated_classes, cls)
            end
          end
          child.classes = translated_classes
          
          for _, cls in ipairs(child.classes) do
            if cls == "col" or has_prefix(cls, "col-") then
              is_col = true
              break
            end
          end
        end
        
        if is_col then
          table.insert(cols, child)
        else
          table.insert(cols, pandoc.Div({child}, pandoc.Attr("", {col_class})))
        end
      end

      local row_div = pandoc.Div(cols, pandoc.Attr("", {"row"}))
      el.content = {row_div}
    end
    
    -- Replace 'grid' and 'bootstrap-grid' classes with 'container-fluid px-0' to prevent CSS grid conflicts
    local new_classes = {}
    for _, cls in ipairs(el.classes) do
      if cls ~= "grid" and cls ~= "bootstrap-grid" then
        table.insert(new_classes, cls)
      end
    end
    table.insert(new_classes, "container-fluid")
    table.insert(new_classes, "px-0")
    el.classes = new_classes
    
    return el
  end
end

-- ── Table handler ─────────────────────────────────────────────────────────────
-- Converts any standard markdown table with class `.grid` or `.bootstrap-grid`
-- directly into a responsive grid layout of rows and columns.
function Table(el)
  if el.classes:includes('grid') or el.classes:includes('bootstrap-grid') then
    return parse_table_to_grid(el)
  end
end
