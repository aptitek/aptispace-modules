--[[
  cards.lua — Quarto/Pandoc Lua filter
  ====================================
  Converts concise Aptitek card blocks into Bootstrap card structures.

  Authoring pattern:

    ::: {.card-window layout="sidebar-left"}
    #### Title {.bi-search}
    Card body content...
    :::

    ::: {.terminal}
    #### Sortie
    Terminal body content...
    :::

  The first Header becomes `.card-header`; the remaining blocks become
  `.card-body`. Existing cards that already contain `.card-header` or
  `.card-body` direct children are left unchanged.
--]]

local function has_class(classes, name)
  return classes and classes:includes(name)
end

local function has_direct_card_part(el)
  for _, block in ipairs(el.content) do
    if block.t == "Div" and (has_class(block.classes, "card-header") or has_class(block.classes, "card-body")) then
      return true
    end
  end
  return false
end

local function copy_attr_without_bi(attr)
  local classes = {}
  for _, cls in ipairs(attr.classes or {}) do
    if not cls:match("^bi%-") then
      table.insert(classes, cls)
    end
  end
  return pandoc.Attr(attr.identifier or "", classes, attr.attributes or {})
end

local function extract_bi_classes(attr)
  local classes = {}
  for _, cls in ipairs(attr.classes or {}) do
    if cls:match("^bi%-") then
      table.insert(classes, cls)
    end
  end
  return classes
end

local function card_classes(el)
  local classes = {}
  local has_card = false
  local has_window = false

  for _, cls in ipairs(el.classes) do
    if cls == "card-auto" or cls == "apt-card" then
      -- Marker-only aliases; do not emit them.
    else
      if cls == "card" then has_card = true end
      if cls == "card-window" then has_window = true end
      table.insert(classes, cls)
    end
  end

  if not has_card then
    table.insert(classes, 1, "card")
  end
  if has_window and not has_class(pandoc.List(classes), "mb-4") then
    table.insert(classes, "mb-4")
  end

  return classes
end

local function is_card_candidate(el)
  return has_class(el.classes, "card-window")
    or has_class(el.classes, "card-auto")
    or has_class(el.classes, "apt-card")
    or has_class(el.classes, "terminal")
end

local function header_div_from(block)
  local header_attr = copy_attr_without_bi(block.attr)
  local header_classes = { "card-header" }

  for _, cls in ipairs(extract_bi_classes(block.attr)) do
    table.insert(header_classes, cls)
  end
  for _, cls in ipairs(header_attr.classes) do
    table.insert(header_classes, cls)
  end

  local attr = pandoc.Attr(header_attr.identifier, header_classes, header_attr.attributes)
  return pandoc.Div({ pandoc.Plain(block.content) }, attr)
end

function Div(el)
  if not is_card_candidate(el) then
    return el
  end

  -- Already-expanded cards stay untouched so existing QMD remains compatible.
  if has_direct_card_part(el) then
    return el
  end

  local header = nil
  local body = {}
  local consumed_header = false

  for _, block in ipairs(el.content) do
    if not consumed_header and block.t == "Header" then
      header = header_div_from(block)
      consumed_header = true
    else
      table.insert(body, block)
    end
  end

  local content = {}
  if header then
    table.insert(content, header)
  end

  if #body > 0 then
    table.insert(content, pandoc.Div(body, pandoc.Attr("", { "card-body" }, {})))
  end

  local attrs = {}
  for key, value in pairs(el.attributes) do
    if key == "layout" then
      attrs["data-layout"] = value
    else
      attrs[key] = value
    end
  end

  return pandoc.Div(content, pandoc.Attr(el.identifier, card_classes(el), attrs))
end
