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
  if el.classes:includes('bootstrap-grid') or el.classes:includes('grid') then
    -- Case 1: Check if the Div contains a Table. If so, convert the table into a grid.
    for _, child in ipairs(el.content) do
      if child.t == 'Table' then
        return parse_table_to_grid(child)
      end
    end
    
    -- Case 2: Standard flat list of elements/divs inside the grid container.
    -- Check if it already has a .row child to prevent double wrapping.
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
        -- If the child is already a column, keep it
        local is_col = false
        if child.t == 'Div' then
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
          -- Wrap the block inside a column div
          table.insert(cols, pandoc.Div({child}, {class = col_class}))
        end
      end
      
      -- Wrap all columns in a single Bootstrap row
      local row_div = pandoc.Div(cols, {class = "row"})
      el.content = {row_div}
    end
    
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
