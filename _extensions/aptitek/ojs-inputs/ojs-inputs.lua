--[[
  ojs-inputs.lua  —  Quarto/Pandoc Lua filter
  ===========================================
  Converts spans carrying class names (.slider, .number, .text, .select, etc.)
  into styled native HTML input elements and binds them to Observable JS (OJS)
  at compile time so they can be referenced reactively (e.g. `${myvar}`).

  Syntax:  [Label text]{.slider #id value=42 min=0 max=100}
  — The span content is used as the <label> for the input.
  — The default value is read from the `value` attribute.
  — If the span content is empty, no label is rendered.
  
  Also parses links matching `[import #id](path.js)` and converts them into
  HTML container divs (`<div id="id"></div>`) and binds them as reactive
  OJS module imports (`id_var = import("path.js")`).
  
  Additionally, parses occurrences of `${variable}` in text blocks and
  transforms them into reactive `<span class="val ojs-inline-value" data-expr="variable"></span>`
  elements so that values are rendered and updated dynamically by OJS.
--]]

local input_items = {}
local ojs_imports = {}
local val_exprs   = {}   -- set of unique OJS expressions used in .val / ${} spans

-- Helper to check if a list of classes contains a class
local function has_class(classes, name)
  return classes:includes(name)
end

-- Helper to extract an attribute or return a default
local function get_attr(el, name, default)
  return el.attributes[name] or default
end

-- Helper to build a <label> HTML string for an input
local function make_label(id, text, extra_classes)
  if text == "" then return "" end
  local cls = "form-label ojs-input-label"
  if extra_classes then cls = cls .. " " .. extra_classes end
  return string.format('<label for="%s" class="%s">%s</label>', id, cls, text)
end

-- Walk spans and transform them
local function transform_span(el)
  -- Skip .label spans — they are now obsolete (label lives in input span content)
  if has_class(el.classes, 'label') then
    return {}
  end

  -- 1. Slider / Range Input
  if has_class(el.classes, 'slider') then
    local id = el.identifier or ""
    if id == "" then id = "slider_" .. tostring(#input_items + 1) end
    table.insert(input_items, { id = id, type = "slider" })
    
    local label_text = pandoc.utils.stringify(el.content)
    local val = get_attr(el, "value", "0")
    local min = get_attr(el, "min", "0")
    local max = get_attr(el, "max", "100")
    local step = get_attr(el, "step", "1")
    local is_vertical = has_class(el.classes, 'vertical') or get_attr(el, "vertical", nil) ~= nil
    
    local label_html = ""
    local input_html = ""
    if is_vertical then
      -- Vertical slider: full .sim-slider-v structure (label rotated, badge, arrow)
      local direction  = get_attr(el, "direction", "down")
      local arrow_char = direction == "up" and "&#9650;" or "&#9660;"
      local badge_id   = "__badge__" .. id

      -- Compute initial data-state (0-3) from initial value
      local val_n = tonumber(val) or 0
      local min_n = tonumber(min) or 0
      local max_n = tonumber(max) or 100
      local init_state = math.min(3, math.floor((val_n - min_n) / math.max(1, max_n - min_n) * 4))

      -- Inline oninput: update badge text + data-state on the wrapper
      local oninput = string.format(
        "var b=document.getElementById('%s');b&&(b.textContent=this.value);" ..
        "this.parentElement.dataset.state=Math.min(3,Math.floor((+this.value-+this.min)/(+this.max-+this.min)*4));",
        badge_id
      )

      local html = string.format(
        '<div class="sim-slider-v sim-slider-v--%s" data-state="%d">' ..
        '<span class="slider-v-label">%s</span>' ..
        '<span class="slider-v-badge" id="%s">%s</span>' ..
        '<input type="range" class="slider-v-input" id="%s" min="%s" max="%s" step="%s" value="%s" oninput="%s" />' ..
        '<div class="slider-v-arrow">%s</div>' ..
        '</div>',
        direction, init_state, label_text, badge_id, val, id, min, max, step, val, oninput, arrow_char
      )
      return pandoc.RawInline('html', html)
    else
      label_html = make_label(id, label_text)
      input_html = string.format(
        '<input type="range" class="form-range slider-inline" id="%s" min="%s" max="%s" step="%s" value="%s" />',
        id, min, max, step, val
      )
    end
    return pandoc.RawInline('html', label_html .. input_html)
  end

  -- 2. Number Input
  if has_class(el.classes, 'number') then
    local id = el.identifier or ""
    if id == "" then id = "number_" .. tostring(#input_items + 1) end
    table.insert(input_items, { id = id, type = "number" })
    
    local label_text = pandoc.utils.stringify(el.content)
    local val = get_attr(el, "value", "0")
    local min = get_attr(el, "min", "")
    local max = get_attr(el, "max", "")
    local step = get_attr(el, "step", "1")
    
    local min_attr = min ~= "" and string.format(' min="%s"', min) or ""
    local max_attr = max ~= "" and string.format(' max="%s"', max) or ""
    
    local label_html = make_label(id, label_text)
    local input_html = string.format(
      '<input type="number" class="form-control number-inline" id="%s" step="%s" value="%s"%s%s style="display: inline-block; width: 70px; height: 26px; padding: 2px 6px; font-size: 0.85rem; vertical-align: middle; margin: 0 4px;" />',
      id, step, val, min_attr, max_attr
    )
    return pandoc.RawInline('html', label_html .. input_html)
  end

  -- 3. Text Input
  if has_class(el.classes, 'text') then
    local id = el.identifier or ""
    if id == "" then id = "text_" .. tostring(#input_items + 1) end
    table.insert(input_items, { id = id, type = "text" })
    
    local label_text = pandoc.utils.stringify(el.content)
    local val = get_attr(el, "value", "")
    local label_html = make_label(id, label_text)
    local input_html = string.format(
      '<input type="text" class="form-control text-inline" id="%s" value="%s" style="display: inline-block; width: 140px; height: 26px; padding: 2px 6px; font-size: 0.85rem; vertical-align: middle; margin: 0 4px;" />',
      id, val
    )
    return pandoc.RawInline('html', label_html .. input_html)
  end

  -- 4. Textarea Input
  if has_class(el.classes, 'textarea') then
    local id = el.identifier or ""
    if id == "" then id = "textarea_" .. tostring(#input_items + 1) end
    table.insert(input_items, { id = id, type = "textarea" })
    
    local label_text = pandoc.utils.stringify(el.content)
    local val = get_attr(el, "value", "")
    local rows = get_attr(el, "rows", "3")
    local label_html = make_label(id, label_text)
    local input_html = string.format(
      '<textarea class="form-control textarea-inline" id="%s" rows="%s" style="font-size: 0.85rem; margin-top: 4px;">%s</textarea>',
      id, rows, val
    )
    return pandoc.RawInline('html', label_html .. input_html)
  end

  -- 5. Checkbox / Toggle
  if has_class(el.classes, 'checkbox') or has_class(el.classes, 'toggle') then
    local id = el.identifier or ""
    if id == "" then id = "checkbox_" .. tostring(#input_items + 1) end
    table.insert(input_items, { id = id, type = "checkbox" })
    
    local label_text = pandoc.utils.stringify(el.content)
    local is_checked = has_class(el.classes, 'checked') or get_attr(el, "checked", nil) ~= nil
    local checked_attr = is_checked and " checked" or ""
    
    local input_html = string.format(
      '<input type="checkbox" class="form-check-input checkbox-inline" id="%s"%s style="width: 16px; height: 16px; margin: 0 6px; vertical-align: middle;" />',
      id, checked_attr
    )
    -- For checkboxes, label comes after the input (standard form-check pattern)
    local label_html = make_label(id, label_text)
    return pandoc.RawInline('html', input_html .. label_html)
  end

  -- 6. Dropdown / Select
  if has_class(el.classes, 'select') then
    local id = el.identifier or ""
    if id == "" then id = "select_" .. tostring(#input_items + 1) end
    table.insert(input_items, { id = id, type = "select" })
    
    local label_text = pandoc.utils.stringify(el.content)
    local selected_val = get_attr(el, "value", "")
    local options_str = get_attr(el, "options", "")
    
    local html_opts = {}
    for opt in string.gmatch(options_str, "[^,]+") do
      opt = string.gsub(opt, "^%s*(.-)%s*$", "%1") -- trim whitespace
      local selected_attr = opt == selected_val and " selected" or ""
      table.insert(html_opts, string.format('<option value="%s"%s>%s</option>', opt, selected_attr, opt))
    end
    
    local label_html = make_label(id, label_text)
    local input_html = string.format(
      '<select class="form-select select-inline" id="%s" style="display: inline-block; width: auto; height: 26px; padding: 2px 24px 2px 8px; font-size: 0.85rem; vertical-align: middle; margin: 0 4px;">%s</select>',
      id, table.concat(html_opts, "")
    )
    return pandoc.RawInline('html', label_html .. input_html)
  end

  -- 7. Color Input
  if has_class(el.classes, 'color') then
    local id = el.identifier or ""
    if id == "" then id = "color_" .. tostring(#input_items + 1) end
    table.insert(input_items, { id = id, type = "color" })
    
    local label_text = pandoc.utils.stringify(el.content)
    local val = get_attr(el, "value", "#000000")
    
    local label_html = make_label(id, label_text)
    local input_html = string.format(
      '<input type="color" class="form-control form-control-color color-inline" id="%s" value="%s" style="display: inline-block; width: 40px; height: 26px; padding: 2px; vertical-align: middle; margin: 0 4px;" />',
      id, val
    )
    return pandoc.RawInline('html', label_html .. input_html)
  end

  -- 8. Date Input
  if has_class(el.classes, 'date') then
    local id = el.identifier or ""
    if id == "" then id = "date_" .. tostring(#input_items + 1) end
    table.insert(input_items, { id = id, type = "date" })
    
    local label_text = pandoc.utils.stringify(el.content)
    local val = get_attr(el, "value", "")
    local label_html = make_label(id, label_text)
    local input_html = string.format(
      '<input type="date" class="form-control date-inline" id="%s" value="%s" style="display: inline-block; width: auto; height: 26px; padding: 2px 6px; font-size: 0.85rem; vertical-align: middle; margin: 0 4px;" />',
      id, val
    )
    return pandoc.RawInline('html', label_html .. input_html)
  end

  -- 9. Button Input (content = button text, no separate label needed)
  --    Also handles .bi-* icon classes (since bi-icons runs after us,
  --    it would never see this Span once we convert it to RawInline).
  if has_class(el.classes, 'button') or has_class(el.classes, 'btn') then
    local id = el.identifier or ""
    if id == "" then id = "button_" .. tostring(#input_items + 1) end
    table.insert(input_items, { id = id, type = "button" })

    -- Extract a .bi-* icon class if present
    local icon_html = ""
    for _, cls in ipairs(el.classes) do
      if cls:match("^bi%-") then
        icon_html = '<i class="bi ' .. cls .. ' me-1" aria-hidden="true"></i>'
        break
      end
    end
    
    local val = pandoc.utils.stringify(el.content)
    local html = string.format(
      '<button type="button" class="btn btn-secondary btn-sm button-inline" id="%s" style="padding: 2px 8px; font-size: 0.85rem; vertical-align: middle; margin: 0 4px;">%s%s</button>',
      id, icon_html, val
    )
    return pandoc.RawInline('html', html)
  end

  -- 10. Reactive Value Display (.val)
  if has_class(el.classes, 'val') then
    local val_text = pandoc.utils.stringify(el.content)
    local expr = get_attr(el, "for", val_text)
    -- Accept kebab-case IDs (e.g. inf-p) and normalise to underscores for OJS
    if string.match(expr, "^[a-zA-Z_][a-zA-Z0-9_%-]*$") then
      local ojs_expr = expr:gsub("%-", "_")
      val_exprs[ojs_expr] = true
      local span_classes = { "val", "ojs-inline-value" }
      for _, cls in ipairs(el.classes) do
        if cls ~= "val" and cls ~= "ojs-inline-value" then
          table.insert(span_classes, cls)
        end
      end
      local html = string.format('<span class="%s" data-expr="%s"></span>', table.concat(span_classes, " "), ojs_expr)
      return pandoc.RawInline('html', html)
    end
  end

  -- 11. Progress Bar (.progressbar / .progress-bar)
  if has_class(el.classes, 'progressbar') or has_class(el.classes, 'progress-bar') then
    local id = el.identifier or ""
    if id == "" then id = "progressbar_" .. tostring(#input_items + 1) end
    
    -- Extract properties
    local val_text = pandoc.utils.stringify(el.content)
    val_text = string.gsub(val_text, "^%s*(.-)%s*$", "%1")
    
    local is_reactive = false
    local var_name = ""
    local static_val = 0
    local is_from_attribute = false
    
    -- Check if it's empty, try attributes
    if val_text == "" then
      val_text = get_attr(el, "data-progress", "")
      if val_text == "" then
        val_text = get_attr(el, "value", "0")
      end
      is_from_attribute = true
    end
    
    -- Parse val_text
    -- 1. Check if it's reactive with ${var}
    local rx_var = string.match(val_text, "^%${([%a%d%-_]+)%%?}$")
    if rx_var then
      is_reactive = true
      var_name = rx_var
    else
      -- 2. Check if it's a number (static)
      -- Strip trailing % if present
      local num_str = string.match(val_text, "^([%d%.]+)%%?$")
      if num_str then
        local num = tonumber(num_str)
        if num then
          if not is_from_attribute and num <= 1.0 and num > 0 then
            static_val = num * 100
          else
            static_val = num
          end
        end
      else
        -- 3. Check if it's a plain variable name (not a number)
        -- E.g. "seuil" or "inp-seuil"
        if string.match(val_text, "^[a-zA-Z_][a-zA-Z0-9_%-]*$") then
          is_reactive = true
          var_name = val_text
        end
      end
    end
    
    -- Attributes: animated, striped, max, color
    local animated = get_attr(el, "animated", "false") == "true" or has_class(el.classes, "animated")
    local striped = get_attr(el, "striped", "false") == "true" or has_class(el.classes, "striped")
    local max_val = get_attr(el, "max", nil)
    
    -- Color class or accent
    local color_class = ""
    for _, cls in ipairs(el.classes) do
      if cls:match("^bg%-") then
        color_class = cls
        break
      end
    end
    if color_class == "" then
      local col_attr = get_attr(el, "color", "")
      if col_attr ~= "" then
        color_class = "bg-" .. col_attr
      end
    end
    
    -- Create HTML classes
    local bar_classes = "progress-bar"
    if striped then bar_classes = bar_classes .. " progress-bar-striped" end
    if animated then bar_classes = bar_classes .. " progress-bar-animated" end
    if color_class ~= "" then bar_classes = bar_classes .. " " .. color_class end
    
    -- If reactive, we insert it into input_items so OJS script is generated
    if is_reactive then
      table.insert(input_items, {
        id = id,
        type = "progressbar",
        var_name = var_name,
        max_val = max_val
      })
    end
    
    -- HTML construction
    local width_style = ""
    if not is_reactive then
      width_style = string.format(' style="width: %g%%;"', static_val)
    end
    
    local html = string.format(
      '<div class="progress progressbar-inline" id="%s">' ..
      '<div class="%s" role="progressbar"%s aria-valuenow="%g" aria-valuemin="0" aria-valuemax="100"></div>' ..
      '</div>',
      id, bar_classes, width_style, static_val
    )
    return pandoc.RawInline('html', html)
  end

  -- 12. Progress Ring (.progressring / .progress-ring)
  if has_class(el.classes, 'progressring') or has_class(el.classes, 'progress-ring') then
    local id = el.identifier or ""
    if id == "" then id = "progressring_" .. tostring(#input_items + 1) end

    local val_text = pandoc.utils.stringify(el.content)
    val_text = string.gsub(val_text, "^%s*(.-)%s*$", "%1")

    local is_reactive = false
    local var_name = ""
    local static_val = 0
    local is_from_attribute = false

    if val_text == "" then
      val_text = get_attr(el, "data-progress", "")
      if val_text == "" then
        val_text = get_attr(el, "value", "0")
      end
      is_from_attribute = true
    end

    local rx_var = string.match(val_text, "^%${([%a%d%-_]+)%%?}$")
    if rx_var then
      is_reactive = true
      var_name = rx_var
    else
      local num_str = string.match(val_text, "^([%d%.]+)%%?$")
      if num_str then
        local num = tonumber(num_str)
        if num then
          if not is_from_attribute and num <= 1.0 and num > 0 then
            static_val = num * 100
          else
            static_val = num
          end
        end
      else
        if string.match(val_text, "^[a-zA-Z_][a-zA-Z0-9_%-]*$") then
          is_reactive = true
          var_name = val_text
        end
      end
    end

    local max_val = get_attr(el, "max", nil)
    local label_var = get_attr(el, "label", nil)
    if label_var and not string.match(label_var, "^[a-zA-Z_][a-zA-Z0-9_%-]*$") then
      label_var = nil
    end

    local color_name = ""
    for _, cls in ipairs(el.classes) do
      local bg_match = cls:match("^bg%-(.+)")
      if bg_match then
        color_name = bg_match
        break
      end
    end
    if color_name == "" then
      color_name = get_attr(el, "color", "")
    end

    local ring_classes = "progressring-inline"
    if color_name ~= "" then
      ring_classes = ring_classes .. " progressring-color-" .. color_name
    end

    if is_reactive then
      table.insert(input_items, {
        id = id,
        type = "progressring",
        var_name = var_name,
        max_val = max_val,
        label_var = label_var
      })
    end

    local max_num = max_val and tonumber(max_val) or nil
    local pct = static_val
    if max_num then
      pct = (static_val / max_num) * 100
    end
    pct = math.min(100, math.max(0, pct))

    local radius = 18
    local circumference = 2 * math.pi * radius
    local dash_offset = circumference * (1 - pct / 100)
    local label_text = string.format("%g %%", static_val)

    local html = string.format(
      '<span class="%s" id="%s" role="img" aria-label="%s">' ..
      '<svg class="progressring-svg" viewBox="0 0 44 44" aria-hidden="true">' ..
      '<circle class="progressring-track" cx="22" cy="22" r="%g"></circle>' ..
      '<circle class="progressring-value" cx="22" cy="22" r="%g" stroke-dasharray="%g" stroke-dashoffset="%g"></circle>' ..
      '</svg>' ..
      '<span class="progressring-label">%s</span>' ..
      '</span>',
      ring_classes, id, label_text, radius, radius, circumference, dash_offset, label_text
    )
    return pandoc.RawInline('html', html)
  end

  return el
end

-- Walk links and transform OJS imports
local function transform_link(el)
  local txt = pandoc.utils.stringify(el.content)
  local id = string.match(txt, "^import%s+#([%a%d%-_]+)$")
  if id then
    local target_js = el.target
    table.insert(ojs_imports, { id = id, path = target_js })
    
    -- Replace the link with an HTML div container
    local html = string.format('<div id="%s"></div>', id)
    return pandoc.RawInline('html', html)
  end
  return el
end

-- Walk strings and transform ${var} expressions
local function transform_str(el)
  local text = el.text
  if string.match(text, "%${[%a%d%-_]+}") then
    local inlines = pandoc.List()
    local last_pos = 1
    
    for start_pos, var_name, end_pos in string.gmatch(text, "()%${([%a%d%-_]+)}()") do
      if start_pos > last_pos then
        table.insert(inlines, pandoc.Str(string.sub(text, last_pos, start_pos - 1)))
      end
      local ojs_expr = var_name:gsub("%-", "_")
      val_exprs[ojs_expr] = true
      local html = string.format('<span class="val ojs-inline-value" data-expr="%s"></span>', ojs_expr)
      table.insert(inlines, pandoc.RawInline('html', html))
      
      last_pos = end_pos
    end
    
    if last_pos <= #text then
      table.insert(inlines, pandoc.Str(string.sub(text, last_pos)))
    end
    
    return inlines
  end
  return el
end

function Pandoc(doc)
  input_items = {}
  ojs_imports = {}
  val_exprs   = {}

  -- 1. Walk the document to find and transform spans, links, and strings
  doc = doc:walk {
    Span = transform_span,
    Link = transform_link,
    Str = transform_str,
    -- Code nodes (backtick spans) containing ${var} are not Str — handle them too
    Code = function(el)
      local text = el.text
      if not string.match(text, "^%${[%a%d%-_]+}$") then return el end
      local var_name = string.match(text, "^%${([%a%d%-_]+)}$")
      if not var_name then return el end
      local ojs_expr = var_name:gsub("%-", "_")
      val_exprs[ojs_expr] = true
      return pandoc.RawInline('html',
        string.format('<span class="val ojs-inline-value" data-expr="%s"></span>', ojs_expr))
    end
  }
  
  -- 2. If inputs, imports or .val expressions were generated, append an OJS code block
  local has_val_exprs = next(val_exprs) ~= nil
  if #input_items > 0 or #ojs_imports > 0 or has_val_exprs then
    local ojs_lines = { "//| echo: false" }

    -- A. Process imports
    for _, imp in ipairs(ojs_imports) do
      local var_name = imp.id:gsub("%-", "_")
      table.insert(ojs_lines, string.format('%s = import("%s")', var_name, imp.path))
    end

    -- B. Process inputs
    for _, item in ipairs(input_items) do
      local id = item.id
      local var_name = id:gsub("%-", "_")
      if item.type == "button" then
        local btn_code = string.format(
          "%s = Generators.observe(change => {\n" ..
          "  let clicked = 0;\n" ..
          "  const el = document.getElementById('%s');\n" ..
          "  if (!el) return;\n" ..
          "  const cb = (e) => { e.preventDefault(); change(++clicked); };\n" ..
          "  el.addEventListener('click', cb);\n" ..
          "  change(clicked);\n" ..
          "  return () => el.removeEventListener('click', cb);\n" ..
          "})",
          var_name, id
        )
        table.insert(ojs_lines, btn_code)
      elseif item.type == "progressbar" then
        local ojs_var = item.var_name:gsub("%-", "_")
        local max_str = item.max_val and tonumber(item.max_val) or "null"
        local code = string.format(
          "__update_%s = {\n" ..
          "  const val = %s;\n" ..
          "  const el = document.getElementById('%s');\n" ..
          "  if (el) {\n" ..
          "    const bar = el.querySelector('.progress-bar');\n" ..
          "    if (bar) {\n" ..
          "      let pct = val;\n" ..
          "      const maxVal = %s;\n" ..
          "      if (maxVal !== null) {\n" ..
          "        pct = (val / maxVal) * 100;\n" ..
          "      } else {\n" ..
          "        if (val > 0 && val <= 1) {\n" ..
          "          pct = val * 100;\n" ..
          "        }\n" ..
          "      }\n" ..
          "      pct = Math.min(100, Math.max(0, pct));\n" ..
          "      bar.style.width = pct + '%%';\n" ..
          "    }\n" ..
          "  }\n" ..
          "}",
          item.id:gsub("%-", "_"), ojs_var, item.id, max_str
        )
        table.insert(ojs_lines, code)
      elseif item.type == "progressring" then
        local ojs_var = item.var_name:gsub("%-", "_")
        local label_expr = item.label_var and item.label_var:gsub("%-", "_") or "null"
        local max_str = item.max_val and tonumber(item.max_val) or "null"
        local code = string.format(
          "__update_%s = {\n" ..
          "  const val = %s;\n" ..
          "  const labelVal = %s;\n" ..
          "  const el = document.getElementById('%s');\n" ..
          "  if (el) {\n" ..
          "    const ring = el.querySelector('.progressring-value');\n" ..
          "    const label = el.querySelector('.progressring-label');\n" ..
          "    let pct = val;\n" ..
          "    const maxVal = %s;\n" ..
          "    if (maxVal !== null) {\n" ..
          "      pct = (val / maxVal) * 100;\n" ..
          "    } else if (val > 0 && val <= 1) {\n" ..
          "      pct = val * 100;\n" ..
          "    }\n" ..
          "    pct = Math.min(100, Math.max(0, pct));\n" ..
          "    const radius = 18;\n" ..
          "    const circumference = 2 * Math.PI * radius;\n" ..
          "    const text = labelVal !== null && labelVal !== undefined\n" ..
          "      ? String(labelVal)\n" ..
          "      : (Number.isFinite(Number(val)) ? Number(val).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' %%' : String(val));\n" ..
          "    if (ring) {\n" ..
          "      ring.setAttribute('stroke-dasharray', String(circumference));\n" ..
          "      ring.setAttribute('stroke-dashoffset', String(circumference * (1 - pct / 100)));\n" ..
          "    }\n" ..
          "    if (label) label.textContent = text;\n" ..
          "    el.setAttribute('aria-label', text);\n" ..
          "  }\n" ..
          "}",
          item.id:gsub("%-", "_"), ojs_var, label_expr, item.id, max_str
        )
        table.insert(ojs_lines, code)
      else
        table.insert(ojs_lines, string.format("%s = Generators.input(document.getElementById('%s'))", var_name, id))
      end
    end

    -- C. Generate a reactive DOM-update cell for every .val / ${} expression.
    --    Each cell depends on the named OJS variable and writes to all matching
    --    [data-expr="expr"] spans whenever the variable changes.
    for ojs_expr, _ in pairs(val_exprs) do
      local cell = string.format(
        "__val_%s = {\n" ..
        "  const _v = %s;\n" ..
        "  document.querySelectorAll('[data-expr=\"%s\"]').forEach(s => {\n" ..
        "    s.textContent = (_v !== null && _v !== undefined) ? String(_v) : \"\";\n" ..
        "  });\n" ..
        "}",
        ojs_expr, ojs_expr, ojs_expr
      )
      table.insert(ojs_lines, cell)
    end

    local ojs_code = table.concat(ojs_lines, "\n\n")
    local escaped_ojs = ojs_code:gsub("\\", "\\\\"):gsub("`", "\\`")
    local js_script = string.format(
      '<script type="module">\n' ..
      '  const run = () => {\n' ..
      '    if (window._ojs && window._ojs.runtime) {\n' ..
      '      window._ojs.runtime.interpretQuiet(`%s`);\n' ..
      '    } else {\n' ..
      '      setTimeout(run, 10);\n' ..
      '    }\n' ..
      '  };\n' ..
      '  run();\n' ..
      '</script>',
      escaped_ojs
    )
    table.insert(doc.blocks, pandoc.RawBlock('html', js_script))
  end
  
  return doc
end
