--[[
  ojs-inputs.lua  —  Quarto/Pandoc Lua filter
  ===========================================
  Converts spans carrying class names (.slider, .number, .text, .select, etc.)
  into styled native HTML input elements and binds them to Observable JS (OJS)
  at compile time so they can be referenced reactively (e.g. `${myvar}`).
  
  Also parses links matching `[import #id](path.js)` and converts them into
  HTML container divs (`<div id="id"></div>`) and binds them as reactive
  OJS module imports (`id_var = import("path.js")`).
  
  Additionally, parses occurrences of `${variable}` in text blocks and
  transforms them into reactive `<span class="val ojs-inline-value" data-expr="variable"></span>`
  elements so that values are rendered and updated dynamically by OJS.
  
  Automatically registers the OJS runtime library assets using Quarto's native
  HTML dependency API, making OJS support transparent for the user.
--]]

local input_items = {}
local ojs_imports = {}

-- Base64 Encoder in Pure Lua
local b_chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
local function base64_encode(data)
  return ((data:gsub('.', function(x) 
    local r,b='',x:byte()
    for i=8,1,-1 do r=r..(b%2^i-b%2^(i-1)>0 and '1' or '0') end
    return r;
  end)..'0000'):gsub('%d%d%d?%d?%d?%d?', function(x)
    if (#x < 6) then return '' end
    local c=0
    for i=1,6 do c=c+(x:sub(i,i)=='1' and 2^(6-i) or 0) end
    return b_chars:sub(c+1,c+1)
  end)..({ '', '==', '=' })[#data%3+1])
end

-- Helper to check if a list of classes contains a class
local function has_class(classes, name)
  return classes:includes(name)
end

-- Helper to extract an attribute or return a default
local function get_attr(el, name, default)
  return el.attributes[name] or default
end

-- Walk spans and transform them
local function transform_span(el)
  -- 1. Slider / Range Input
  if has_class(el.classes, 'slider') then
    local id = el.identifier or ""
    if id == "" then id = "slider_" .. tostring(#input_items + 1) end
    table.insert(input_items, { id = id, type = "slider" })
    
    local val = pandoc.utils.stringify(el.content)
    local min = get_attr(el, "min", "0")
    local max = get_attr(el, "max", "100")
    local step = get_attr(el, "step", "1")
    local is_vertical = has_class(el.classes, 'vertical') or get_attr(el, "vertical", nil) ~= nil
    
    local html = ""
    if is_vertical then
      html = string.format(
        '<input type="range" class="form-range slider-inline vertical" id="%s" min="%s" max="%s" step="%s" value="%s" style="writing-mode: vertical-lr; direction: rtl; width: 12px; height: 120px; padding: 0; margin: 0 auto; display: block;" />',
        id, min, max, step, val
      )
    else
      html = string.format(
        '<input type="range" class="form-range slider-inline" id="%s" min="%s" max="%s" step="%s" value="%s" style="display: inline-block; vertical-align: middle; width: 130px; height: 20px; margin: 0 8px;" />',
        id, min, max, step, val
      )
    end
    return pandoc.RawInline('html', html)
  end

  -- 2. Number Input
  if has_class(el.classes, 'number') then
    local id = el.identifier or ""
    if id == "" then id = "number_" .. tostring(#input_items + 1) end
    table.insert(input_items, { id = id, type = "number" })
    
    local val = pandoc.utils.stringify(el.content)
    local min = get_attr(el, "min", "")
    local max = get_attr(el, "max", "")
    local step = get_attr(el, "step", "1")
    
    local min_attr = min ~= "" and string.format(' min="%s"', min) or ""
    local max_attr = max ~= "" and string.format(' max="%s"', max) or ""
    
    local html = string.format(
      '<input type="number" class="form-control number-inline" id="%s" step="%s" value="%s"%s%s style="display: inline-block; width: 70px; height: 26px; padding: 2px 6px; font-size: 0.85rem; vertical-align: middle; margin: 0 4px;" />',
      id, step, val, min_attr, max_attr
    )
    return pandoc.RawInline('html', html)
  end

  -- 3. Text Input
  if has_class(el.classes, 'text') then
    local id = el.identifier or ""
    if id == "" then id = "text_" .. tostring(#input_items + 1) end
    table.insert(input_items, { id = id, type = "text" })
    
    local val = pandoc.utils.stringify(el.content)
    local html = string.format(
      '<input type="text" class="form-control text-inline" id="%s" value="%s" style="display: inline-block; width: 140px; height: 26px; padding: 2px 6px; font-size: 0.85rem; vertical-align: middle; margin: 0 4px;" />',
      id, val
    )
    return pandoc.RawInline('html', html)
  end

  -- 4. Textarea Input
  if has_class(el.classes, 'textarea') then
    local id = el.identifier or ""
    if id == "" then id = "textarea_" .. tostring(#input_items + 1) end
    table.insert(input_items, { id = id, type = "textarea" })
    
    local val = pandoc.utils.stringify(el.content)
    local rows = get_attr(el, "rows", "3")
    local html = string.format(
      '<textarea class="form-control textarea-inline" id="%s" rows="%s" style="font-size: 0.85rem; margin-top: 4px;">%s</textarea>',
      id, rows, val
    )
    return pandoc.RawInline('html', html)
  end

  -- 5. Checkbox / Toggle
  if has_class(el.classes, 'checkbox') or has_class(el.classes, 'toggle') then
    local id = el.identifier or ""
    if id == "" then id = "checkbox_" .. tostring(#input_items + 1) end
    table.insert(input_items, { id = id, type = "checkbox" })
    
    local val = pandoc.utils.stringify(el.content)
    local is_checked = val == "checked" or val == "true" or has_class(el.classes, 'checked')
    local checked_attr = is_checked and " checked" or ""
    
    local html = string.format(
      '<input type="checkbox" class="form-check-input checkbox-inline" id="%s"%s style="width: 16px; height: 16px; margin: 0 6px; vertical-align: middle;" />',
      id, checked_attr
    )
    return pandoc.RawInline('html', html)
  end

  -- 6. Dropdown / Select
  if has_class(el.classes, 'select') then
    local id = el.identifier or ""
    if id == "" then id = "select_" .. tostring(#input_items + 1) end
    table.insert(input_items, { id = id, type = "select" })
    
    local selected_val = pandoc.utils.stringify(el.content)
    local options_str = get_attr(el, "options", "")
    
    local html_opts = {}
    for opt in string.gmatch(options_str, "[^,]+") do
      opt = string.gsub(opt, "^%s*(.-)%s*$", "%1") -- trim whitespace
      local selected_attr = opt == selected_val and " selected" or ""
      table.insert(html_opts, string.format('<option value="%s"%s>%s</option>', opt, selected_attr, opt))
    end
    
    local html = string.format(
      '<select class="form-select select-inline" id="%s" style="display: inline-block; width: auto; height: 26px; padding: 2px 24px 2px 8px; font-size: 0.85rem; vertical-align: middle; margin: 0 4px;">%s</select>',
      id, table.concat(html_opts, "")
    )
    return pandoc.RawInline('html', html)
  end

  -- 7. Color Input
  if has_class(el.classes, 'color') then
    local id = el.identifier or ""
    if id == "" then id = "color_" .. tostring(#input_items + 1) end
    table.insert(input_items, { id = id, type = "color" })
    
    local val = pandoc.utils.stringify(el.content)
    if val == "" then val = "#000000" end
    
    local html = string.format(
      '<input type="color" class="form-control form-control-color color-inline" id="%s" value="%s" style="display: inline-block; width: 40px; height: 26px; padding: 2px; vertical-align: middle; margin: 0 4px;" />',
      id, val
    )
    return pandoc.RawInline('html', html)
  end

  -- 8. Date Input
  if has_class(el.classes, 'date') then
    local id = el.identifier or ""
    if id == "" then id = "date_" .. tostring(#input_items + 1) end
    table.insert(input_items, { id = id, type = "date" })
    
    local val = pandoc.utils.stringify(el.content)
    local html = string.format(
      '<input type="date" class="form-control date-inline" id="%s" value="%s" style="display: inline-block; width: auto; height: 26px; padding: 2px 6px; font-size: 0.85rem; vertical-align: middle; margin: 0 4px;" />',
      id, val
    )
    return pandoc.RawInline('html', html)
  end

  -- 9. Button Input
  if has_class(el.classes, 'button') or has_class(el.classes, 'btn') then
    local id = el.identifier or ""
    if id == "" then id = "button_" .. tostring(#input_items + 1) end
    table.insert(input_items, { id = id, type = "button" })
    
    local val = pandoc.utils.stringify(el.content)
    local html = string.format(
      '<button type="button" class="btn btn-secondary btn-sm button-inline" id="%s" style="padding: 2px 8px; font-size: 0.85rem; vertical-align: middle; margin: 0 4px;">%s</button>',
      id, val
    )
    return pandoc.RawInline('html', html)
  end

  -- 10. Reactive Value Display (.val)
  if has_class(el.classes, 'val') then
    local val_text = pandoc.utils.stringify(el.content)
    local expr = get_attr(el, "for", val_text)
    
    -- Ensure it matches a valid JS identifier (alpha-numeric)
    if string.match(expr, "^[a-zA-Z_][a-zA-Z0-9_]*$") then
      local html = string.format('<span class="val ojs-inline-value" data-expr="%s"></span>', expr)
      return pandoc.RawInline('html', html)
    end
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
      
      local html = string.format('<span class="val ojs-inline-value" data-expr="%s"></span>', var_name)
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
  local has_native_ojs = false
  
  -- Check if the document already contains native OJS code blocks (compiled to js cell-code) or inline code
  doc:walk {
    CodeBlock = function(el)
      if (el.classes:includes('ojs') or el.classes:includes('{ojs}')) or 
         (el.classes:includes('js') and el.classes:includes('cell-code')) then
        has_native_ojs = true
      end
    end,
    Code = function(el)
      if el.classes:includes('ojs') or el.classes:includes('{ojs}') then
        has_native_ojs = true
      end
    end
  }


  
  -- 1. Walk the document to find and transform spans, links, and strings
  doc = doc:walk {
    Span = transform_span,
    Link = transform_link,
    Str = transform_str
  }
  
  -- 2. If inputs, imports or string variables were generated, append base64 encoded silent OJS module scripts
  if #input_items > 0 or #ojs_imports > 0 then
    -- Automatically register the OJS assets as an HTML dependency in Quarto
    if not has_native_ojs then
      if quarto and quarto.doc and quarto.doc.is_format("html") then
        quarto.doc.add_html_dependency({
          name = "quarto-ojs",
          version = "1.0.0",
          stylesheets = { "quarto-ojs.css" },
          scripts = {
            {
              path = "quarto-ojs-runtime.js",
              attribs = { type = "module" }
            }
          }
        })
      end
    end
    
    -- Determine current document's path nesting offset
    local offset = ""
    if quarto and quarto.project and quarto.project.offset then
      offset = quarto.project.offset
    end
    
    local docToRoot = ""
    if offset ~= "" and offset ~= "." then
      docToRoot = offset
      if not string.match(docToRoot, "/$") then
        docToRoot = docToRoot .. "/"
      end
    end

    -- Build standard OJS runtime bindings and imports code
    local ojs_lines = {}
    
    -- A. Process imports
    for _, imp in ipairs(ojs_imports) do
      local var_name = imp.id:gsub("%-", "_")
      table.insert(ojs_lines, string.format('%s = import("%s")', var_name, imp.path))
    end
    
    -- B. Process inputs
    for _, item in ipairs(input_items) do
      local id = item.id
      if item.type == "button" then
        -- Custom click listener returning a reactive counter for button clicks
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
          id, id
        )
        table.insert(ojs_lines, btn_code)
      else
        -- Standard Generators.input for slider, number, text, color, checkbox, date, select
        table.insert(ojs_lines, string.format("%s = Generators.input(document.getElementById('%s'))", id, id))
      end
    end
    
    local ojs_code = table.concat(ojs_lines, "\n\n")
    
    -- Escape backslashes, double quotes, and newlines to safely build JSON source string
    local escaped_source = ojs_code:gsub("\\", "\\\\"):gsub('"', '\\"'):gsub("\n", "\\n"):gsub("\r", "\\r")
    local json_str = string.format(
      '{"contents":[{"methodName":"interpret","cellName":"ojs-inputs-binding","inline":false,"source":"%s"}]}',
      escaped_source
    )
    
    local base64_str = base64_encode(json_str)
    
    -- Write HTML script tag that is loaded by OJS but invisible in DOM
    local raw_html = string.format(
      '<div class="ojs-auto-generated hidden">\n' ..
      '<script type="ojs-module-contents">\n' ..
      '%s\n' ..
      '</script>\n' ..
      '</div>',
      base64_str
    )
    table.insert(doc.blocks, pandoc.RawBlock('html', raw_html))
    
    if not has_native_ojs then
      -- Inject path initializers and start script evaluation
      local docToRootJS = "."
      if docToRoot ~= "" then
        docToRootJS = string.sub(docToRoot, 1, -2)
      end
      
      -- The HTML dependency is copied to site_libs/quarto-contrib/quarto-ojs-1.0.0/ (3 levels deep)
      local runtimeToRoot = "../../.."
      local runtimeToDoc = "../../.."
      if docToRoot ~= "" then
        runtimeToDoc = "../../../" .. string.sub(docToRoot, 1, -2)
      end
      
      local init_html = string.format(
        '<script type="module">\n' ..
        '  if (window.location.protocol === "file:") { alert("The OJS runtime does not work with file:// URLs. Please use a web server to view this document."); }\n' ..
        '  window._ojs = window._ojs || {};\n' ..
        '  window._ojs.paths = window._ojs.paths || {};\n' ..
        '  window._ojs.paths.runtimeToDoc = "%s";\n' ..
        '  window._ojs.paths.runtimeToRoot = "%s";\n' ..
        '  window._ojs.paths.docToRoot = "%s";\n' ..
        '  window._ojs.selfContained = false;\n' ..
        '  window._ojs.runtime = window._ojs.runtime || {};\n' ..
        '  if (typeof window._ojs.runtime.interpretFromScriptTags === "function") {\n' ..
        '    window._ojs.runtime.interpretFromScriptTags();\n' ..
        '  }\n' ..
        '</script>',
        runtimeToDoc, runtimeToRoot, docToRootJS
      )
      table.insert(doc.blocks, pandoc.RawBlock('html', init_html))
    end
  end
  
  return doc
end
