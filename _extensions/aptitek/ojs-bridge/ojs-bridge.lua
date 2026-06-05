--[[
  ojs-bridge.lua  —  Quarto/Pandoc Lua filter
  ===========================================
  Automatically injects the OJS global namespace bridge to map
  window.aptitek functions to the local OJS scope when OJS is active.
--]]

function Pandoc(doc)
  local has_native_ojs = false
  
  -- Check if the document already contains native OJS code blocks or inline code
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

  -- Inject global namespace bridge at the very beginning of the document if native OJS blocks are present
  if has_native_ojs then
    local js_script = [[
<script type="module">
  const run = () => {
    if (window._ojs && window._ojs.runtime) {
      window._ojs.runtime.interpretQuiet(`
        aptitek = {
          if (window.aptitek) return window.aptitek;
          return new Promise(resolve => {
            const check = () =>
              window.aptitek
                ? resolve(window.aptitek)
                : requestAnimationFrame(check);
            check();
          });
        }
        theme = aptitek.theme
        solarizedTemplate = aptitek.solarizedTemplate
        getThemeColor = aptitek.getThemeColor
        resolveCssValue = aptitek.resolveCssValue
        getPlotlyTheme = aptitek.getPlotlyTheme
        utils = aptitek.utils
        parseTableData = aptitek.parseTableData
        renderTemplate = aptitek.renderTemplate
        renderListTemplate = aptitek.renderListTemplate
        renderFeedbackUI = aptitek.renderFeedbackUI
        initTabIcons = aptitek.initTabIcons
        createTabsetWatcher = aptitek.createTabsetWatcher
        initTabActions = aptitek.initTabActions
        StateMachine = aptitek.StateMachine
        createTokenStream = aptitek.createTokenStream
        createVerticalDragToggle = aptitek.createVerticalDragToggle
        encodeValueToBytes = aptitek.encodeValueToBytes
        groupBytesIntoSlots = aptitek.groupBytesIntoSlots
        tokenizeText = aptitek.tokenizeText
        getBackgroundImageUrl = aptitek.getBackgroundImageUrl
        loadInlineSvg = aptitek.loadInlineSvg
        bindSvgElements = aptitek.bindSvgElements
        bindSvgToTabs = aptitek.bindSvgToTabs
        applySvgState = aptitek.applySvgState
        createWordCloud = aptitek.createWordCloud
        createCabling = aptitek.createCabling
        createRamStorageGraph = aptitek.createRamStorageGraph
        renderStateMachineGraph = aptitek.renderStateMachineGraph
        createBar = aptitek.createBar
        createLine = aptitek.createLine
        createFunnel = aptitek.createFunnel
        createPiramid = aptitek.createPiramid
        registerTabset = aptitek.registerTabset
        createDynamicSvg = aptitek.createDynamicSvg
        bindSvgToTabset = aptitek.bindSvgToTabset
        createLever = aptitek.createLever
        initMoboSvg = aptitek.initMoboSvg
        renderMobo = aptitek.renderMobo
        getRamData = aptitek.getRamData
        renderRam = aptitek.renderRam
        createLabeledText = aptitek.createLabeledText
        initInteractiveSvg = aptitek.initInteractiveSvg
      `);
    } else {
      setTimeout(run, 10);
    }
  };
  run();
</script>
]]
    table.insert(doc.blocks, 1, pandoc.RawBlock('html', js_script))
  end

  return doc
end
