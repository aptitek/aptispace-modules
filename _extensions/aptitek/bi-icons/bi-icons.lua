--[[
  bi-icons.lua  —  Quarto/Pandoc Lua filter
  ==========================================
  Automatically prepend a Bootstrap Icon to any element that carries a
  `.bi-<icon-name>` CSS class, using Quarto's native attribute syntax:

      ## My Heading {.bi-hash}
      [Some inline text]{.bi-star}

  The filter:
    1. Extracts the first `bi-*` class found on the element.
    2. Prepends  <i class="bi bi-<name>" aria-hidden="true"></i>  as raw HTML.
    3. Removes the `bi-*` class from the element so the output HTML stays clean.

  Works on: Span, Header, Div (useful for panel-tabset panes and card headers).

  Because this runs at compile time in the Pandoc AST, it works everywhere —
  including inside panel-tabset headings where Quarto shortcodes cannot.
  The icon is embedded in the heading content, so Quarto's tab-label also
  picks it up automatically (no JS injection needed).
--]]


--- Extract the first bi-* class from a class list.
--- Returns the icon class name (e.g. "bi-hash") and the remaining classes.
---@param classes pandoc.List<string>
---@return string|nil  bi_class
---@return table       remaining_classes
local function extract_bi_class(classes)
  local bi_class = nil
  local remaining = {}
  for _, cls in ipairs(classes) do
    if not bi_class and cls:match("^bi%-") then
      bi_class = cls
    else
      table.insert(remaining, cls)
    end
  end
  return bi_class, remaining
end


--- Build the Bootstrap Icon inline HTML element.
---@param bi_class string  e.g. "bi-hash"
---@return pandoc.RawInline
local function make_icon(bi_class)
  return pandoc.RawInline(
    "html",
    '<i class="bi ' .. bi_class .. '" aria-hidden="true"></i> '
  )
end


-- ── Span handler ───────────────────────────────────────────────────────────────
-- Handles:
--   1. [42]{#rawInput .search-bar .bi-keyboard placeholder="..."}  (generic search bar)
--   2. [text]{.bi-icon}  and  []{.bi-icon}  (generic icon/badge elements)
function Span(el)
  -- Case 1: Generic search/input component
  local is_search_bar = false
  local is_button = false
  for _, cls in ipairs(el.classes) do
    if cls == "search-bar" then
      is_search_bar = true
    elseif cls == "btn" or cls:match("^btn%-") or cls == "button" then
      is_button = true
    end
  end

  -- Case 1.5: Generic button component
  if is_button then
    local bi_class, remaining = extract_bi_class(el.classes)
    local val = pandoc.utils.stringify(el.content)
    local id = el.identifier or ""
    local id_attr = ""
    if id ~= "" then
      id_attr = ' id="' .. id .. '"'
    end

    local icon_html = ""
    if bi_class then
      icon_html = '<i class="bi ' .. bi_class .. '" aria-hidden="true"></i> '
    end

    -- Construct classes string preserving all other class names
    local class_list = { "btn-tab-action" }
    for _, r_cls in ipairs(remaining) do
      table.insert(class_list, r_cls)
    end
    local class_str = table.concat(class_list, " ")

    local html = string.format(
      '<button%s class="%s">%s%s</button>',
      id_attr, class_str, icon_html, val
    )
    return pandoc.RawInline("html", html)
  end

  if is_search_bar then
    local bi_class, remaining = extract_bi_class(el.classes)
    local val = pandoc.utils.stringify(el.content)
    local placeholder = el.attributes["placeholder"] or ""
    local id = el.identifier or ""

    local icon_html = ""
    if bi_class then
      icon_html = '<i class="bi ' .. bi_class .. '" aria-hidden="true"></i>'
    end

    local html = string.format(
      '<span class="search-bar">%s<input type="text" id="%s" value="%s" placeholder="%s" autocomplete="off" spellcheck="false" /></span>',
      icon_html, id, val, placeholder
    )
    return pandoc.RawInline("html", html)
  end

  -- Case 2: Generic icon/badge styling
  local bi_class, remaining = extract_bi_class(el.classes)
  if not bi_class then return el end

  local icon = make_icon(bi_class)

  -- Empty span []{.bi-icon} — return just the icon, no wrapper
  if #el.content == 0 then
    return icon
  end

  -- Non-empty span [text]{.bi-icon} — prepend icon, keep the span
  el.classes = pandoc.List(remaining)
  el.content:insert(1, icon)
  return el
end


-- ── Header handler ────────────────────────────────────────────────────────────
-- Handles: ## Title {.bi-icon}
-- Also covers panel-tabset ## headings — the icon lands in the tab label too.
function Header(el)
  local bi_class, remaining = extract_bi_class(el.classes)
  if not bi_class then return el end

  el.classes = pandoc.List(remaining)
  el.content:insert(1, make_icon(bi_class))
  return el
end


-- ── Div handler ───────────────────────────────────────────────────────────────
-- Handles: ::: {.bi-icon}  (e.g. card headers or section divs)
-- Skips Bootstrap .tab-pane divs — those are handled by JS initTabIcons().
-- Wraps the first block's inlines with the icon prepended.
function Div(el)
  -- Generic Background Image Extractor
  -- Intercepts any Image element carrying the `.background` class,
  -- and turns it into a background-image of its parent Div.
  local bg_src = nil
  el = pandoc.walk_block(el, {
    Image = function(img)
      local is_bg = false
      for _, cls in ipairs(img.classes) do
        if cls == "background" then
          is_bg = true
          break
        end
      end
      if is_bg then
        bg_src = img.src
        return {} -- Remove the image from the AST
      end
    end
  })

  if bg_src then
    el.attributes["style"] = (el.attributes["style"] or "") .. " background-image: url('" .. bg_src .. "');"
    
    -- Ensure "card-canvas" is in classes so standard background styles apply
    local has_canvas = false
    for _, cls in ipairs(el.classes) do
      if cls == "card-canvas" then
        has_canvas = true
        break
      end
    end
    if not has_canvas then
      el.classes:insert("card-canvas")
    end
    return el
  end

  -- Panel-tabset panes: class is read at runtime by JS initTabIcons; skip here
  for _, cls in ipairs(el.classes) do
    if cls == "tab-pane" then return el end
  end


  local bi_class, remaining = extract_bi_class(el.classes)
  if not bi_class then return el end

  el.classes = pandoc.List(remaining)

  -- Prepend the icon to the first Para or Plain block found
  for _, block in ipairs(el.content) do
    if block.t == "Para" or block.t == "Plain" then
      block.content:insert(1, make_icon(bi_class))
      break
    end
  end

  return el
end
