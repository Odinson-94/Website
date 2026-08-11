(function () {
  "use strict";

  const ASSET_REVISION = "20260807-blockchat1";
  const CONFIG_URL = `/data/public-calculator-config.json?v=${ASSET_REVISION}`;
  const RESPONSIBILITY_NOTICE = "The user is responsible for verifying every input, assumption, standard, result and its suitability, and for obtaining competent-person review. Adelphos accepts no responsibility for decisions made using this calculation.";

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function setPath(target, path, value) {
    const parts = String(path).split(".");
    let cursor = target;
    parts.forEach((part, index) => {
      const last = index === parts.length - 1;
      const nextIsIndex = !last && /^\d+$/.test(parts[index + 1]);
      if (last) {
        cursor[part] = value;
        return;
      }
      if (cursor[part] === undefined) cursor[part] = nextIsIndex ? [] : {};
      cursor = cursor[part];
    });
  }

  function typedValue(field, control) {
    if (field.type === "empty-array") return control.value === "confirmed_empty" ? [] : undefined;
    if (control.value === "") return undefined;
    if (field.valueType === "boolean") return control.value === "true";
    if (field.type === "number" || field.valueType === "number" || field.valueType === "integer") {
      const value = Number(control.value);
      return field.valueType === "integer" ? Number.parseInt(control.value, 10) : value;
    }
    return control.value;
  }

  function endpoint(template, calculatorId) {
    return String(template || "").replace("{calculatorId}", encodeURIComponent(calculatorId));
  }

  function apiSettings(config) {
    const injected = window.__ADELPHOS_PUBLIC_CALCULATOR_API__ || {};
    return {
      calculateTemplate: injected.calculateEndpointTemplate || config.calculateEndpointTemplate,
      reportTemplate: injected.reportEndpointTemplate || config.reportEndpointTemplate
    };
  }

  function flatten(value, prefix, rows, depth) {
    if (depth > 5) {
      rows.push([prefix, "Nested result"]);
      return;
    }
    if (value === null || value === undefined) {
      rows.push([prefix, "—"]);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => flatten(item, `${prefix} ${index + 1}`.trim(), rows, depth + 1));
      return;
    }
    if (typeof value === "object") {
      Object.entries(value).forEach(([key, item]) => {
        if (["inline_tool_result", "export_request", "report"].includes(key)) return;
        const label = `${prefix} ${key.replaceAll("_", " ")}`.trim();
        flatten(item, label, rows, depth + 1);
      });
      return;
    }
    rows.push([prefix, typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)]);
  }

  function renderResults(container, calculation) {
    container.replaceChildren();
    const heading = element("div", "public-calculator__result-heading");
    heading.append(element("span", "public-calculator__eyebrow", "Protected Adelphos result"));
    heading.append(element("h3", "", calculation.title || "Calculation results"));
    const state = element("span", "public-calculator__state", calculation.state || calculation.overallState || "REVIEW");
    heading.append(state);
    container.append(heading);

    const rows = [];
    flatten(calculation.values || calculation.result || calculation, "", rows, 0);
    const list = element("dl", "public-calculator__results");
    rows.slice(0, 80).forEach(([label, value]) => {
      list.append(element("dt", "", label || "Result"));
      list.append(element("dd", "", value));
    });
    container.append(list);

    const warnings = calculation.warnings || [];
    if (warnings.length) {
      const warningBlock = element("div", "public-calculator__warnings");
      warningBlock.append(element("strong", "", "Warnings and review points"));
      const warningList = element("ul");
      warnings.forEach((warning) => warningList.append(element("li", "", String(warning))));
      warningBlock.append(warningList);
      container.append(warningBlock);
    }
  }

  function fieldControl(field) {
    const wrapper = element("label", "public-calculator__field");
    wrapper.hidden = Boolean(field.hidden);
    const label = element("span", "public-calculator__label", field.label);
    if (field.unit) label.append(element("small", "", field.unit));
    wrapper.append(label);

    let control;
    if (field.type === "select" || field.type === "empty-array") {
      control = element("select");
      if (field.placeholder) {
        const placeholder = element("option", "", field.placeholder);
        placeholder.value = "";
        placeholder.disabled = Boolean(field.required);
        placeholder.selected = field.default === undefined;
        control.append(placeholder);
      }
      (field.options || []).forEach((option) => {
        const node = element("option", "", option.label);
        node.value = String(option.value);
        node.selected = String(option.value) === String(field.default);
        control.append(node);
      });
    } else {
      control = element("input");
      control.type = field.type === "number" ? "number" : (field.type === "date" ? "date" : "text");
      if (field.default !== undefined) control.value = String(field.default);
      ["min", "max", "step"].forEach((name) => {
        if (field[name] !== undefined) control.setAttribute(name, String(field[name]));
      });
    }
    control.name = field.path;
    control.required = Boolean(field.required);
    control.autocomplete = "off";
    wrapper.append(control);
    if (field.hint) wrapper.append(element("small", "public-calculator__hint", field.hint));
    return {
      wrapper,
      control,
      read: () => typedValue(field, control),
      setDisabled: (disabled) => { control.disabled = disabled; }
    };
  }

  function repeaterControl(field) {
    const wrapper = element("fieldset", "public-calculator__repeater");
    const legend = element("legend", "public-calculator__repeater-title", field.label);
    if (field.hint) legend.append(element("small", "public-calculator__hint", field.hint));
    wrapper.append(legend);
    const rowsContainer = element("div", "public-calculator__repeater-rows");
    wrapper.append(rowsContainer);
    const rowControls = [];
    const minimum = Number.isInteger(field.minItems) ? field.minItems : 0;
    const maximum = Number.isInteger(field.maxItems) ? field.maxItems : 20;

    const updateButtons = () => {
      rowControls.forEach(({ removeButton }) => { removeButton.disabled = rowControls.length <= minimum; });
      addButton.disabled = rowControls.length >= maximum;
    };

    const addRow = (initial) => {
      if (rowControls.length >= maximum) return;
      const row = element("div", "public-calculator__repeater-row");
      const rowHeader = element("div", "public-calculator__repeater-row-header");
      const rowTitle = element("strong", "", `${field.itemLabel || "Entry"} ${rowControls.length + 1}`);
      const removeButton = element("button", "public-calculator__remove", "Remove");
      removeButton.type = "button";
      rowHeader.append(rowTitle, removeButton);
      row.append(rowHeader);
      const itemGrid = element("div", "public-calculator__repeater-grid");
      const itemControls = (field.itemFields || []).map((itemField) => {
        const initialField = initial && Object.hasOwn(initial, itemField.path)
          ? { ...itemField, default: initial[itemField.path] }
          : itemField;
        const built = initialField.type === "repeater" ? repeaterControl(initialField) : fieldControl(initialField);
        itemGrid.append(built.wrapper);
        return { field: itemField, ...built };
      });
      const updateItemConditions = () => {
        const values = new Map(itemControls.map(({ field: itemField, control }) => [itemField.path, control.value]));
        itemControls.forEach(({ field: itemField, wrapper: itemWrapper, setDisabled }) => {
          if (!itemField.dependsOn) return;
          const active = (itemField.dependsOn.values || []).map(String).includes(String(values.get(itemField.dependsOn.path)));
          itemWrapper.hidden = !active;
          setDisabled(!active);
        });
      };
      itemControls.forEach(({ control }) => control.addEventListener("change", updateItemConditions));
      updateItemConditions();
      row.append(itemGrid);
      const record = { row, rowTitle, itemControls, removeButton };
      rowControls.push(record);
      rowsContainer.append(row);
      removeButton.addEventListener("click", () => {
        const index = rowControls.indexOf(record);
        if (index < 0 || rowControls.length <= minimum) return;
        rowControls.splice(index, 1);
        row.remove();
        rowControls.forEach((item, rowIndex) => { item.rowTitle.textContent = `${field.itemLabel || "Entry"} ${rowIndex + 1}`; });
        updateButtons();
      });
      updateButtons();
    };

    const addButton = element("button", "signup-btn secondary public-calculator__add", field.addLabel || "Add entry");
    addButton.type = "button";
    addButton.addEventListener("click", () => addRow({}));
    wrapper.append(addButton);

    const initialRows = Array.isArray(field.default) && field.default.length
      ? field.default
      : Array.from({ length: minimum }, () => ({}));
    initialRows.forEach(addRow);

    return {
      wrapper,
      control: wrapper,
      read: () => {
        if (!rowControls.length && !field.required) return undefined;
        return rowControls.map(({ itemControls }) => {
        const item = {};
        itemControls.forEach(({ field: itemField, control, read }) => {
          if (control.disabled) return;
          const value = read();
          if (value !== undefined && value !== "") setPath(item, itemField.path, value);
        });
        return item;
        });
      },
      setDisabled: (disabled) => {
        wrapper.disabled = disabled;
        addButton.disabled = disabled || rowControls.length >= maximum;
      }
    };
  }

  async function readJson(response) {
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = body && (body.detail || body.error || body.message);
      const error = new Error(detail || `Calculation service returned HTTP ${response.status}.`);
      error.status = response.status;
      error.reason = body && body.reason;
      throw error;
    }
    return body;
  }

  function requestHeaders(accept) {
    return { "Content-Type": "application/json", "Accept": accept };
  }

  function showServiceError(status, error) {
    status.replaceChildren(document.createTextNode(`${error.message} This calculator never falls back to browser arithmetic.`));
  }

  function mount(root, config, calculator) {
    root.replaceChildren();
    const api = apiSettings(config);
    const form = element("form", "public-calculator__form");
    form.noValidate = true;
    const controls = [];
    const defaultGrid = element("div", "public-calculator__grid");
    const groupGrids = new Map();
    if (calculator.sectioned) {
      const sectionList = element("div", "public-calculator__sections");
      (calculator.sections || []).forEach((section, index) => {
        const details = element("details", "public-calculator__section");
        details.open = index === 0;
        const summary = element("summary", "public-calculator__section-title");
        const sectionState = element("small", "", details.open ? "Close section" : "Open section");
        summary.append(element("span", "", section.label), sectionState);
        details.addEventListener("toggle", () => { sectionState.textContent = details.open ? "Close section" : "Open section"; });
        const grid = element("div", "public-calculator__grid public-calculator__section-grid");
        details.append(summary, grid);
        sectionList.append(details);
        groupGrids.set(section.key, grid);
      });
      const disclosure = element("p", "public-calculator__section-note", "Every canonical SAP editable field is provided below. Sections collapse for navigation only; no engineering input is hidden or preset.");
      form.append(disclosure, sectionList);
    } else {
      form.append(defaultGrid);
    }
    calculator.fields.forEach((field) => {
      const built = field.type === "repeater" ? repeaterControl(field) : fieldControl(field);
      controls.push({ field, ...built });
      const target = calculator.sectioned ? groupGrids.get(field.group) : defaultGrid;
      if (!target) throw new Error(`Calculator field group was not found: ${field.group || "unassigned"}.`);
      target.append(built.wrapper);
    });

    const modeControl = calculator.modeField
      ? controls.find(({ field }) => field.path === calculator.modeField && !field.modes)
      : null;
    function updateConditionalFields() {
      const selectedMode = modeControl ? modeControl.control.value : null;
      const controlValues = new Map(controls.map(({ field, control }) => [field.path, control.value]));
      controls.forEach(({ field, wrapper, setDisabled }) => {
        const modeActive = !Array.isArray(field.modes) || field.modes.includes(selectedMode);
        const dependencyActive = !field.dependsOn || (field.dependsOn.values || []).map(String).includes(String(controlValues.get(field.dependsOn.path)));
        const active = modeActive && dependencyActive;
        wrapper.hidden = Boolean(field.hidden) || !active;
        setDisabled(!active);
      });
    }
    controls.forEach(({ control }) => control.addEventListener("change", updateConditionalFields));
    updateConditionalFields();

    const actions = element("div", "public-calculator__actions");
    const calculateButton = element("button", "signup-btn primary", "Calculate");
    calculateButton.type = "submit";
    const pdfButton = element("button", "signup-btn secondary", "Download PDF report");
    pdfButton.type = "button";
    pdfButton.disabled = true;
    actions.append(calculateButton, pdfButton);
    form.append(actions);

    const status = element("p", "public-calculator__status", "Ready for inputs. Calculate to return the protected Adelphos result.");
    status.setAttribute("role", "status");
    const result = element("section", "public-calculator__result");
    result.hidden = true;
    const notice = element("aside", "public-calculator__responsibility");
    notice.append(element("strong", "", "Engineering responsibility"));
    notice.append(element("p", "", RESPONSIBILITY_NOTICE));
    root.append(form, status, result, notice);
    let calculationToken = "";
    let reportFilename = `${calculator.slug}-adelphos-report.pdf`;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const invalid = form.querySelector(":invalid");
      if (invalid) {
        const section = invalid.closest("details");
        if (section) section.open = true;
        invalid.reportValidity();
        return;
      }
      const inputs = {};
      controls.forEach(({ field, control, read }) => {
        if (control.disabled) return;
        const value = read();
        if (value !== undefined && value !== "") setPath(inputs, field.path, value);
      });

      calculateButton.disabled = true;
      pdfButton.disabled = true;
      calculationToken = "";
      status.textContent = "Calling the canonical Adelphos calculation service…";
      result.hidden = true;
      try {
        const response = await fetch(endpoint(api.calculateTemplate, calculator.id), {
          method: "POST",
          credentials: "omit",
          headers: requestHeaders("application/json"),
          body: JSON.stringify({ inputs })
        });
        const body = await readJson(response);
        if (!body || body.ok !== true || !body.calculation) {
          throw new Error("The calculation service did not return the required canonical result envelope.");
        }
        renderResults(result, body.calculation);
        result.hidden = false;
        calculationToken = String(body.report && body.report.calculationToken || "");
        reportFilename = String(body.report && body.report.filename || reportFilename);
        pdfButton.disabled = !calculationToken;
        status.textContent = calculationToken
          ? "Calculation complete. The PDF report is ready."
          : "Calculation complete. PDF download was not included in this response.";
      } catch (error) {
        showServiceError(status, error);
      } finally {
        calculateButton.disabled = false;
      }
    });

    pdfButton.addEventListener("click", async () => {
      if (!calculationToken) return;
      pdfButton.disabled = true;
      status.textContent = "Preparing the branded Adelphos PDF…";
      try {
        const response = await fetch(endpoint(api.reportTemplate, calculator.id), {
          method: "POST",
          credentials: "omit",
          headers: requestHeaders("application/pdf"),
          body: JSON.stringify({ calculationToken })
        });
        const contentType = response.headers.get("Content-Type") || "";
        if (!response.ok || !contentType.toLowerCase().startsWith("application/pdf")) {
          if (contentType.toLowerCase().includes("application/json")) await readJson(response);
          throw new Error("The report service did not return an application/pdf response.");
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = element("a");
        link.href = url;
        link.download = reportFilename;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        status.textContent = "PDF report downloaded.";
      } catch (error) {
        showServiceError(status, error);
      } finally {
        pdfButton.disabled = false;
      }
    });
  }

  async function start() {
    const roots = document.querySelectorAll("[data-adelphos-public-calculator]");
    if (!roots.length) return;
    try {
      const response = await fetch(CONFIG_URL, { headers: { "Accept": "application/json" } });
      const config = await readJson(response);
      await Promise.all(Array.from(roots).map(async (root) => {
        let calculator = config.calculators.find((item) => item.id === root.dataset.calculatorId);
        if (!calculator) {
          root.textContent = "Calculator configuration was not found.";
          return;
        }
        if (calculator.fieldsSource) {
          const schemaResponse = await fetch(`${calculator.fieldsSource}?v=${ASSET_REVISION}`, { headers: { "Accept": "application/json" } });
          const schema = await readJson(schemaResponse);
          if (schema.canonicalTool !== calculator.canonicalTool || !Array.isArray(schema.fields)) {
            throw new Error("The calculator field schema does not match its canonical tool.");
          }
          calculator = { ...calculator, ...schema };
        }
        mount(root, config, calculator);
      }));
    } catch (error) {
      roots.forEach((root) => { root.textContent = `Calculator configuration failed: ${error.message}`; });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
}());
